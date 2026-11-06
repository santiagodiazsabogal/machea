// SOLO TESTNET. Esta copia pública NO trae llaves: el modo demostración (pestaña Demo) queda desactivado hasta que pongas las tuyas.
//
// Para activarlo, crea tres cuentas de testnet con fondos (por ejemplo con stellar-cli:
//   stellar keys generate emisor --network testnet --fund   (y lo mismo para fiduciaria y comprador))
// y pega aquí sus llaves secretas (empiezan por S):  stellar keys secret emisor
//
// Usa SIEMPRE cuentas nuevas y de práctica. Nunca pongas la llave de una cuenta con dinero real,
// y no subas este archivo con llaves a un repositorio: una app de verdad no lleva llaves secretas en el código.
export const LLAVES_DEMO = {
  emisor: "",
  fiduciaria: "",
  comprador: "",
};
