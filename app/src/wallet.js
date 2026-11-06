// Freighter firma el XDR; la llave secreta nunca sale de la extensión.
import { signTransaction } from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "./fondeo.js";

export function firmarConFreighter(publicKey, alFirmar) {
  return async (xdr, opts) => {
    const r = await signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
      address: opts?.address ?? publicKey,
    });
    if (r.error) throw new Error(typeof r.error === "string" ? r.error : r.error.message);
    alFirmar?.(); // para avisar en pantalla que ya se firmó y falta la confirmación de la red
    return { signedTxXdr: r.signedTxXdr, signerAddress: r.signerAddress };
  };
}
