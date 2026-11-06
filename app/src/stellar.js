// Todo lo que habla con la red Stellar vive aquí.
import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import { requestAccess, getAddress, signTransaction } from "@stellar/freighter-api";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER = "https://stellar.expert/explorer/testnet";

const server = new Horizon.Server(HORIZON_URL);

/** Pide permiso a Freighter y devuelve la dirección pública (G...). */
export async function conectarWallet() {
  const acceso = await requestAccess();
  if (acceso.error) throw new Error(acceso.error);
  const { address, error } = await getAddress();
  if (error) throw new Error(error);
  return address;
}

/** Balances de una cuenta: XLM y cada activo con trustline (código + emisor + límite). */
export async function cargarBalances(address) {
  const cuenta = await server.loadAccount(address);
  return cuenta.balances.map((b) => ({
    codigo: b.asset_type === "native" ? "XLM" : b.asset_code,
    emisor: b.asset_type === "native" ? null : b.asset_issuer,
    balance: b.balance,
    limite: b.limit ?? null,
  }));
}

/** Convierte {codigo, emisor} del formulario en un Asset del SDK. */
function aActivo({ codigo, emisor }) {
  return !emisor || codigo === "XLM" ? Asset.native() : new Asset(codigo, emisor);
}

/**
 * Arma una transacción con las operaciones dadas, la manda a firmar a Freighter
 * y la envía a Horizon. Devuelve el hash. Es el mismo "sobre" de la sesión 2.
 */
async function firmarYEnviar({ desde, operaciones, memo }) {
  const cuenta = await server.loadAccount(desde); // trae el número de secuencia
  const builder = new TransactionBuilder(cuenta, {
    fee: String(Number(BASE_FEE) * operaciones.length), // 100 stroops por operación
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  operaciones.forEach((op) => builder.addOperation(op));
  const tx = builder
    .addMemo(memo ? Memo.text(memo.slice(0, 28)) : Memo.none())
    .setTimeout(60)
    .build();

  // La llave secreta nunca sale de Freighter: le pasamos el XDR y nos devuelve el XDR firmado.
  const firmado = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE, address: desde });
  if (firmado.error) throw new Error(typeof firmado.error === "string" ? firmado.error : firmado.error.message);

  const txFirmada = TransactionBuilder.fromXDR(firmado.signedTxXdr, NETWORK_PASSPHRASE);
  try {
    const resultado = await server.submitTransaction(txFirmada);
    return resultado.hash;
  } catch (e) {
    // Horizon devuelve el código de resultado (op_no_trust, op_underfunded, tx_bad_seq…): muéstralo tal cual.
    const codigos = e?.response?.data?.extras?.result_codes;
    throw new Error(codigos ? JSON.stringify(codigos) : e.message);
  }
}

/** Pago en XLM o en cualquier activo para el que ya exista trustline en el destino. */
export async function enviarPago({ desde, hacia, monto, memo, activo }) {
  return firmarYEnviar({
    desde,
    memo,
    operaciones: [Operation.payment({ destination: hacia, asset: aActivo(activo), amount: String(monto) })],
  });
}

/** changeTrust: autoriza a tu cuenta a recibir un activo. Cuesta 0,5 XLM de reserva. */
export async function agregarTrustline({ desde, codigo, emisor, limite }) {
  return firmarYEnviar({
    desde,
    memo: "",
    operaciones: [Operation.changeTrust({ asset: new Asset(codigo, emisor), limit: limite ? String(limite) : undefined })],
  });
}

/**
 * Reto: trustline + pago en una sola transacción (atómica).
 * Útil cuando tú mismo controlas las dos cuentas; si falla una operación, no se aplica ninguna.
 */
export async function trustlineYPago({ desde, hacia, codigo, emisor, monto }) {
  return firmarYEnviar({
    desde,
    memo: "",
    operaciones: [
      Operation.changeTrust({ asset: new Asset(codigo, emisor) }),
      Operation.payment({ destination: hacia, asset: new Asset(codigo, emisor), amount: String(monto) }),
    ],
  });
}
