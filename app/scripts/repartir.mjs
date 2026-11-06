// La fiduciaria reparte ganancias entre quienes tienen fracciones de una ronda, en UNA sola transacción.
//
// Uso (desde la carpeta app):
//   STELLAR_SECRET=S... node scripts/repartir.mjs <codigo-del-activo> <monto-en-XLM> --fiduciaria G... [--emisor G...] [--enviar]
// Sin --enviar solo muestra el plan, sin mandar nada. Normalmente se corre con demo/repartir.sh.
//
// Cómo funciona: lee de la red quién tiene fracciones en este momento, calcula la parte de cada uno
// (su porcentaje del total) y manda todos los pagos juntos, con la nota "REPARTO <codigo>".
import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { planDeReparto, enviarReparto, aXlm } from "../src/reparto.js";

const EMISOR_POR_DEFECTO = "GCTPRWM3E4JBXIQLFIZJP33HO23G6A6LS7JOPUSDAMRG734ZDEF7VGCU";
const STROOPS = 10_000_000n;

const args = process.argv.slice(2);
const opcion = (nombre) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : undefined; };
const [codigo, montoXlm] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const fiduciaria = opcion("--fiduciaria");
const emisor = opcion("--emisor") || EMISOR_POR_DEFECTO;
const enviar = args.includes("--enviar");
if (!codigo || !montoXlm || !fiduciaria) {
  console.error("Uso: node scripts/repartir.mjs <codigo-del-activo> <monto-en-XLM> --fiduciaria G... [--emisor G...] [--enviar]");
  process.exit(1);
}

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

// 1-2. Quién tiene fracciones ahora mismo y la parte de cada uno.
let plan;
try { plan = await planDeReparto(server, { codigo, emisor, monto: montoXlm }); }
catch (e) { console.error(e.message); process.exit(1); }
const { pagos, total, montoStroops: monto, repartido } = plan;

console.log(`Reparto de ${montoXlm} XLM entre ${pagos.length} tenedores de ${codigo} (${aXlm(total)} fracciones en total)\n`);
for (const p of pagos) {
  const pct = Number((p.fracciones * 10000n) / total) / 100;
  console.log(`  ${p.cuenta.slice(0, 8)}…${p.cuenta.slice(-6)}  ${aXlm(p.fracciones).padStart(14)} fracciones  ${String(pct).padStart(6)} %  →  ${aXlm(p.parte)} XLM`);
}
console.log(`\n  Repartido: ${aXlm(repartido)} XLM · sobran ${aXlm(monto - repartido)} XLM por el redondeo`);

if (!enviar) { console.log("\n(Solo el plan. Agrega --enviar para mandar los pagos.)"); process.exit(0); }

// 3. Todos los pagos juntos, en una sola transacción firmada por la fiduciaria.
const secreto = process.env.STELLAR_SECRET;
if (!secreto) { console.error("Falta STELLAR_SECRET (la llave de la fiduciaria)."); process.exit(1); }
const llave = Keypair.fromSecret(secreto);
if (llave.publicKey() !== fiduciaria) { console.error("La llave no corresponde a la fiduciaria indicada."); process.exit(1); }

const hash = await enviarReparto(server, llave, { codigo, pagos });
console.log(`
✔ Reparto enviado. Transacción: ${hash}`);
console.log(`  https://stellar.expert/explorer/testnet/tx/${hash}`);
