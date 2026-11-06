// MODO DEMOSTRACIÓN: hace desde la app lo que antes hacían los scripts de la carpeta demo/.
//   crearRonda      = demo/ronda.sh      (activo + contrato + control del activo + configuración)
//   comprarRestantes = demo/completar.sh --sin-liberar   (un comprador de prueba compra lo que falta)
//   liberarFondos   = demo/completar.sh   (la fiduciaria libera)
//   repartirGanancias = demo/repartir.sh --enviar
// Las llaves de prueba (solo testnet) las pone quien use el proyecto en demoKeys.js (aquí va vacío). Una app real no haría esto:
// cada rol firmaría con su propia wallet.
import { Address, Asset, BASE_FEE, Horizon, Keypair, Operation, TransactionBuilder, contract, hash, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { ACTIVO, NETWORK_PASSPHRASE, RPC_URL, crearCliente, invertir, leerRonda, liberar } from "./fondeo.js";
import { aXlm, enviarReparto, planDeReparto } from "./reparto.js";

export const CONSTRUCTORA = "GA2QOK3VLE2EHD4JOSO2D423YOTZWQMMPQGMI5JCEAHCEJM7JK2OBXDW";
const XLM_CONTRATO = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"; // el XLM de testnet como contrato
const STROOPS = 10_000_000;

const servidor = new rpc.Server(RPC_URL);
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

/** Las tres cuentas de prueba: emisor del activo, fiduciaria y comprador. */
export const SIN_LLAVES = "SIN_LLAVES";

export async function cargarCuentas() {
  const { LLAVES_DEMO } = await import("./demoKeys.js");
  // La copia pública del proyecto no trae llaves: el modo demostración queda desactivado hasta que pongas las tuyas (de testnet).
  if (!LLAVES_DEMO.emisor || !LLAVES_DEMO.fiduciaria || !LLAVES_DEMO.comprador) throw new Error(SIN_LLAVES);
  return {
    emisor: Keypair.fromSecret(LLAVES_DEMO.emisor),
    fiduciaria: Keypair.fromSecret(LLAVES_DEMO.fiduciaria),
    comprador: Keypair.fromSecret(LLAVES_DEMO.comprador),
  };
}

/** Arma, simula (si hace falta), firma y envía UNA operación; espera a que la red la confirme. */
async function enviar(operacion, llave, { soroban = true } = {}) {
  const cuenta = await servidor.getAccount(llave.publicKey());
  let tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operacion)
    .setTimeout(60)
    .build();
  if (soroban) tx = await servidor.prepareTransaction(tx); // simula y calcula costos
  tx.sign(llave);
  const r = await servidor.sendTransaction(tx);
  if (r.status === "ERROR") throw new Error("La red rechazó la transacción.");
  const fin = await servidor.pollTransaction(r.hash, { attempts: 40 });
  if (fin.status !== "SUCCESS") throw new Error("La transacción no se confirmó.");
  return { hash: r.hash, valor: fin.returnValue };
}

const direccion = (g) => new Address(g).toScVal();

/**
 * demo/ronda.sh: crea un activo nuevo, despliega el contrato, le entrega el control del activo
 * y lo configura. `wasm` es el contrato compilado (bytes). `avance(texto)` informa cada paso.
 */
export async function crearRonda({ fracciones, precio, duracion, wasm, codigo: codigoPropio }, avance = () => {}) {
  const { emisor, fiduciaria } = await cargarCuentas();
  const n = new Date();
  const dos = (x) => String(x).padStart(2, "0");
  const codigo = codigoPropio || `DEMO${dos(n.getDate())}${dos(n.getHours())}${dos(n.getMinutes())}${dos(n.getSeconds())}`; // máx. 12 caracteres
  const activo = new Asset(codigo, emisor.publicKey());

  avance(`1/5 Creando el activo ${codigo}…`);
  await enviar(Operation.createStellarAssetContract({ asset: activo }), emisor);
  const sac = activo.contractId(NETWORK_PASSPHRASE);

  avance("2/5 Subiendo el contrato compilado a la red…");
  await enviar(Operation.uploadContractWasm({ wasm }), fiduciaria);

  avance("3/5 Desplegando el contrato de la ronda…");
  const creado = await enviar(
    Operation.createCustomContract({ address: new Address(fiduciaria.publicKey()), wasmHash: hash(wasm), salt: crypto.getRandomValues(new Uint8Array(32)) }),
    fiduciaria,
  );
  const contrato = Address.fromScVal(creado.valor).toString();

  avance("4/5 Entregándole al contrato el control del activo…");
  await enviar(Operation.invokeContractFunction({ contract: sac, function: "set_admin", args: [direccion(contrato)] }), emisor);

  avance(`5/5 Configurando la ronda (${fracciones} fracciones de ${precio} XLM)…`);
  await enviar(
    Operation.invokeContractFunction({
      contract: contrato,
      function: "init",
      args: [
        direccion(fiduciaria.publicKey()),
        direccion(CONSTRUCTORA),
        direccion(XLM_CONTRATO),
        direccion(sac),
        nativeToScVal(BigInt(Math.round(precio * STROOPS)), { type: "i128" }),
        nativeToScVal(Number(fracciones), { type: "u32" }),
        nativeToScVal(BigInt(duracion), { type: "u64" }),
      ],
    }),
    fiduciaria,
  );
  return { contrato, codigo, emisor: emisor.publicKey() };
}

/** Un cliente del contrato de la ronda actual que firma con una llave local (en vez de Freighter). */
const clienteDe = (llave) => crearCliente({ publicKey: llave.publicKey(), signTransaction: contract.basicNodeSigner(llave, NETWORK_PASSPHRASE) });

/** demo/completar.sh --sin-liberar: el comprador de prueba acepta el activo y compra las fracciones que faltan. */
export async function comprarRestantes(avance = () => {}) {
  const { comprador } = await cargarCuentas();
  const { resumen } = await leerRonda();
  const faltan = resumen.total - resumen.vendidas;
  if (resumen.estado !== "Recaudando" || faltan <= 0) throw new Error("A esta ronda ya no le faltan fracciones.");

  const cuenta = await horizon.loadAccount(comprador.publicKey());
  const tiene = cuenta.balances.some((b) => b.asset_code === ACTIVO.codigo && b.asset_issuer === ACTIVO.emisor);
  if (!tiene) {
    avance(`Aceptando el activo ${ACTIVO.codigo} con la cuenta de prueba…`);
    await enviar(Operation.changeTrust({ asset: new Asset(ACTIVO.codigo, ACTIVO.emisor) }), comprador, { soroban: false });
  }
  avance(`Comprando las ${faltan} fracciones que faltan…`);
  const r = await invertir(await clienteDe(comprador), { inversionista: comprador.publicKey(), fracciones: faltan });
  return { hash: r.hash, fracciones: faltan };
}

/** demo/completar.sh: la fiduciaria libera el dinero a la constructora. */
export async function liberarFondos() {
  const { fiduciaria } = await cargarCuentas();
  return liberar(await clienteDe(fiduciaria));
}

/** demo/repartir.sh --enviar: la fiduciaria reparte `monto` XLM entre los tenedores, en una sola transacción. */
export async function repartirGanancias(monto) {
  const { fiduciaria } = await cargarCuentas();
  const plan = await planDeReparto(horizon, { codigo: ACTIVO.codigo, emisor: ACTIVO.emisor, monto });
  const hashTx = await enviarReparto(horizon, fiduciaria, { codigo: ACTIVO.codigo, pagos: plan.pagos });
  return { hash: hashTx, lineas: plan.pagos.map((p) => `${p.cuenta.slice(0, 6)}…${p.cuenta.slice(-6)} recibe ${aXlm(p.parte)} XLM`) };
}
