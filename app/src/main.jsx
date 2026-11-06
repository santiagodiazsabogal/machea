import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.jsx";
import "./styles.css";

// El SDK de Stellar usa Buffer (API de Node); en el navegador hay que proveerlo.
if (!window.Buffer) window.Buffer = Buffer;

// Si abres un enlace con otra ronda (#...?contrato=...) en una pestaña que ya estaba abierta,
// se recarga para que la app use esa ronda.
window.addEventListener("hashchange", () => {
  if (/[?&](contrato=|ronda=reset)/.test(window.location.hash)) window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
