// Todo lo que habla con el contrato de fondeo vive aquí (sin interfaz, para poder probarlo en la terminal).
import { contract, Horizon, Networks, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { PROYECTOS, PROYECTO_GENERICO, buscarProyecto, proyectoDeContrato } from "./proyectos.js";

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER = "https://stellar.expert/explorer/testnet";
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

// Ronda por defecto y activo de Stellar que representa sus fracciones.
// Ronda por defecto: el primer proyecto del catálogo. Se puede cambiar con un archivo .env (ver .env.example).
const EMISOR_DE_LAS_RONDAS = "GCTPRWM3E4JBXIQLFIZJP33HO23G6A6LS7JOPUSDAMRG734ZDEF7VGCU";
const RONDA_POR_DEFECTO = {
  contrato: import.meta.env?.VITE_CONTRACT_ID || PROYECTOS[0].contrato,
  codigo: import.meta.env?.VITE_ACTIVO_CODIGO || PROYECTOS[0].codigo,
  emisor: import.meta.env?.VITE_ACTIVO_EMISOR || EMISOR_DE_LAS_RONDAS,
};

/**
 * Para las demos: un enlace como  #seguimiento?contrato=C...&activo=CODIGO  hace que la app use esa
 * ronda y la recuerda en el navegador. Con  ?ronda=reset  vuelve a la ronda por defecto.
 */
function rondaElegida() {
  if (typeof window === "undefined") return null; // en la terminal (pruebas) no hay navegador
  const q = new URLSearchParams(window.location.hash.split("?")[1] || "");
  try {
    if (q.get("ronda") === "reset") localStorage.removeItem("machea.ronda");
    else if (q.get("contrato") && q.get("activo")) {
      localStorage.setItem(
        "machea.ronda",
        JSON.stringify({
          contrato: q.get("contrato"),
          codigo: q.get("activo"),
          emisor: q.get("emisor") || RONDA_POR_DEFECTO.emisor,
          proyecto: q.get("proyecto") || undefined,
        }),
      );
    }
    return JSON.parse(localStorage.getItem("machea.ronda") || "null");
  } catch {
    return null; // sin almacenamiento: se usa la ronda por defecto
  }
}
const ELEGIDA = rondaElegida();
export const RONDA_PERSONALIZADA = Boolean(ELEGIDA);
export const CONTRACT_ID = ELEGIDA?.contrato || RONDA_POR_DEFECTO.contrato;
export const ACTIVO = {
  codigo: ELEGIDA?.codigo || RONDA_POR_DEFECTO.codigo,
  emisor: ELEGIDA?.emisor || RONDA_POR_DEFECTO.emisor,
};
// Cuenta pública (no secreta) que solo sirve para simular lecturas cuando no hay wallet conectada.
export const LECTOR =
  import.meta.env?.VITE_LECTOR || "GDXFYLJKYBXOL3ZWJ2YYZL4WPCTQY7C3WOQVYOEIDQTBITQDAF2GXNBM";

// Proyecto de ejemplo (inventado) y tasa de EJEMPLO a pesos: el XLM de testnet no vale nada.
// El contrato no sabe de qué proyecto es: lo deducimos del enlace que eligió la ronda o del catálogo.
export const PROYECTO = buscarProyecto(ELEGIDA?.proyecto) || proyectoDeContrato(CONTRACT_ID) || PROYECTO_GENERICO;

/** Enlace que activa una ronda en la app: recuerda contrato, activo, emisor y proyecto. */
export function enlaceRonda({ contrato, codigo, emisor = EMISOR_DE_LAS_RONDAS, proyecto, vista = "invertir" }) {
  const q = new URLSearchParams({ contrato, activo: codigo, emisor });
  if (proyecto) q.set("proyecto", proyecto);
  return `${vista}?${q.toString()}`;
}
export const TASA_COP_EJEMPLO = 3000;

const ERRORES = {
  1: "El contrato ya estaba configurado.",
  2: "El contrato todavía no está configurado.",
  3: "El precio, el total de fracciones y la duración deben ser mayores que cero.",
  4: "Debes indicar al menos una fracción.",
  5: "No quedan tantas fracciones disponibles.",
  6: "La ronda ya no recibe inversiones.",
  7: "La ronda todavía no alcanza su meta.",
  8: "Los fondos ya fueron liberados.",
  9: "La ronda no ha fallado: no hay reembolso.",
  10: "No tienes tantas fracciones.",
};

/** Stroops (BigInt o texto) a XLM con dos decimales. 1 XLM = 10 000 000 stroops. */
export function formatXlm(stroops) {
  return (Number(BigInt(stroops)) / 1e7).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCop(xlm) {
  return Math.round(Number(xlm) * TASA_COP_EJEMPLO).toLocaleString("es-CO");
}

/** "5 nov 2026 · 11:13 a. m." */
export function fechaCorta(segundos) {
  const f = new Date(Number(segundos) * 1000);
  const mes = f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  const hora = f.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return `${f.getDate()} ${mes} ${f.getFullYear()} · ${hora}`;
}

/** Traduce cualquier error (del contrato, de Freighter o de la red) a un mensaje legible. */
export function mensajeDeError(e) {
  const m = String(e?.message ?? e);
  const c = m.match(/Error\(Contract, #(\d+)\)/);
  if (c) return ERRORES[Number(c[1])] ?? `Error del contrato #${c[1]}`;
  return m || "Ocurrió un error.";
}

/** El contrato devuelve Result: Ok(valor) o Err(descripción). */
function abrir(resultado) {
  if (resultado.isErr()) throw new Error(resultado.unwrapErr().message || "El contrato rechazó la operación.");
  return resultado.unwrap();
}

function hashDe(enviado) {
  return enviado.sendTransactionResponse?.hash ?? enviado.getTransactionResponse?.txHash ?? "";
}

const servidor = new rpc.Server(RPC_URL);
let especificacion = null; // la interfaz del contrato: se descarga una sola vez

/** Cliente del contrato. Sin wallet sirve para leer; con publicKey y signTransaction puede escribir. */
export async function crearCliente({ publicKey, signTransaction } = {}) {
  const opciones = {
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: publicKey || LECTOR,
    signTransaction,
  };
  if (!especificacion) especificacion = (await contract.Client.from(opciones)).spec;
  return new contract.Client(especificacion, opciones);
}

// Segundos de margen para no mostrar una ronda como fallida antes de que el reloj de la red lo confirme.
const MARGEN_RELOJ = 6;

/**
 * Lectura: la ronda completa (resumen y configuración) en UNA sola llamada a la red.
 * En vez de simular dos funciones del contrato, lee lo que el contrato tiene guardado
 * (Config, Estado y Vendidas) y calcula lo mismo que calcula `resumen` en el contrato.
 */
export async function leerRonda(contrato = CONTRACT_ID) {
  const dato = await servidor.getContractData(contrato, xdr.ScVal.scvLedgerKeyContractInstance());
  const guardado = {};
  for (const e of dato.val.contractData().val().instance().storage() ?? []) {
    const clave = scValToNative(e.key()); // las claves son enums del contrato: ["Config"], ["Estado"], ["Vendidas"]
    guardado[Array.isArray(clave) ? clave[0] : clave] = scValToNative(e.val());
  }
  const c = guardado.Config;
  if (!c) throw new Error("El contrato todavía no está configurado.");
  const vendidas = Number(guardado.Vendidas ?? 0);
  const fechaLimite = Number(c.fecha_limite);
  let estado = guardado.Estado?.[0] ?? "Recaudando"; // Recaudando | Exitosa | Liberada
  // La ronda fallida no se guarda: es la que sigue recaudando cuando ya pasó el plazo.
  if (estado === "Recaudando" && Date.now() / 1000 >= fechaLimite + MARGEN_RELOJ) estado = "Fallida";
  const precio = BigInt(c.precio_fraccion);
  return {
    resumen: { estado, vendidas, total: Number(c.total_fracciones), precio, fechaLimite, recaudado: BigInt(vendidas) * precio },
    config: { fiduciaria: c.fiduciaria, constructora: c.constructora, tokenParticipacion: c.token_participacion },
  };
}

/** Escritura: cualquiera compra fracciones. Simula primero (aquí aparecen los errores) y luego firma. */
export async function invertir(client, { inversionista, fracciones }) {
  const tx = await client.invertir({ inversionista, fracciones: Number(fracciones) });
  abrir(tx.result);
  const enviado = await tx.signAndSend();
  return { vendidas: Number(abrir(enviado.result)), hash: hashDe(enviado) };
}

/** Escritura: la fiduciaria libera el dinero a la constructora cuando la ronda fue exitosa. */
export async function liberar(client) {
  const tx = await client.liberar();
  abrir(tx.result);
  const enviado = await tx.signAndSend();
  return { hash: hashDe(enviado) };
}

/** Escritura: si la ronda falló, el tenedor devuelve sus fracciones y recupera su dinero. */
export async function reembolsar(client, { tenedor, fracciones }) {
  const tx = await client.reembolsar({ tenedor, fracciones: Number(fracciones) });
  abrir(tx.result);
  const enviado = await tx.signAndSend();
  return { hash: hashDe(enviado) };
}

/**
 * Lectura: lo que la fiduciaria le ha repartido a esta cuenta como ganancias de la ronda (en stroops).
 * Cada reparto es un pago de la fiduciaria con la nota "REPARTO <codigo del activo>" (ver demo/repartir.sh).
 */
export async function leerGanancias(address, fiduciaria, codigo = ACTIVO.codigo) {
  const pagina = await horizon.payments().forAccount(address).join("transactions").order("desc").limit(100).call();
  const deLaFiduciaria = pagina.records.filter(
    (p) => p.type === "payment" && p.to === address && p.from === fiduciaria && p.asset_type === "native",
  );
  let total = 0n;
  for (const p of deLaFiduciaria) {
    const tx = await p.transaction(); // ya viene incluida en la respuesta: no hace otra consulta
    if (tx.memo === `REPARTO ${codigo}`) total += BigInt(p.amount.replace(".", "")); // "20.0000000" = 200000000 stroops
  }
  return total;
}
