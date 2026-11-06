// Reparto de ganancias: quién tiene fracciones, cuánto le toca a cada uno y el envío en UNA sola transacción.
// Lo usan el modo demostración de la app y el script scripts/repartir.mjs.
import { Asset, BASE_FEE, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const STROOPS = 10_000_000n;
export const aStroops = (texto) => {
  const [e, d = ""] = String(texto).replace(",", ".").split(".");
  return BigInt(e) * STROOPS + BigInt(d.padEnd(7, "0").slice(0, 7));
};
export const aXlm = (s) => `${s / STROOPS}.${String(s % STROOPS).padStart(7, "0")}`;

/** Lee de la red quién tiene fracciones ahora mismo y calcula la parte de cada uno (su % del total, hacia abajo). */
export async function planDeReparto(horizon, { codigo, emisor, monto }) {
  const pagina = await horizon.accounts().forAsset(new Asset(codigo, emisor)).limit(200).call();
  const tenedores = pagina.records
    .map((c) => ({ cuenta: c.id, fracciones: aStroops(c.balances.find((b) => b.asset_code === codigo && b.asset_issuer === emisor)?.balance ?? "0") }))
    .filter((t) => t.fracciones > 0n);
  const total = tenedores.reduce((s, t) => s + t.fracciones, 0n);
  if (total === 0n) throw new Error(`Nadie tiene fracciones de ${codigo}.`);
  const montoStroops = aStroops(monto);
  const pagos = tenedores
    .map((t) => ({ ...t, parte: (montoStroops * t.fracciones) / total }))
    .filter((p) => p.parte > 0n);
  const repartido = pagos.reduce((s, p) => s + p.parte, 0n);
  return { pagos, total, montoStroops, repartido };
}

/** Todos los pagos juntos, firmados por la fiduciaria, con la nota "REPARTO <codigo>". Devuelve el hash. */
export async function enviarReparto(horizon, llave, { codigo, pagos }) {
  const cuenta = await horizon.loadAccount(llave.publicKey());
  const constructor = new TransactionBuilder(cuenta, { fee: String(Number(BASE_FEE) * pagos.length), networkPassphrase: Networks.TESTNET });
  for (const p of pagos) constructor.addOperation(Operation.payment({ destination: p.cuenta, asset: Asset.native(), amount: aXlm(p.parte) }));
  const tx = constructor.addMemo(Memo.text(`REPARTO ${codigo}`)).setTimeout(60).build();
  tx.sign(llave);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}
