// Íconos de línea (stroke) para igualar el diseño de las pantallas.
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const I = ({ size = 22, children, ...p }) => <svg {...base} width={size} height={size} {...p}>{children}</svg>;

export const Edificio = (p) => <I {...p}><path d="M4 21V7l8-4v18M12 9h8v12M3 21h18M7.5 10h1M7.5 14h1M7.5 18h1M15.5 13h1M15.5 17h1" /></I>;
export const Grafico = (p) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12h8.5M12 12 6.2 18" /></I>;
export const Billetera = (p) => <I {...p}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-9Z" /><path d="M4 9V7a2 2 0 0 1 2-2h9M16 14h4v3h-4a1.5 1.5 0 0 1 0-3Z" /></I>;
export const Externo = (p) => <I {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></I>;
export const Info = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>;
export const Pin = (p) => <I {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></I>;
export const Persona = (p) => <I {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></I>;
export const Calendario = (p) => <I {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></I>;
export const Escudo = (p) => <I {...p}><path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></I>;
export const Derecha = (p) => <I {...p}><path d="m9 6 6 6-6 6" /></I>;
export const Atras = (p) => <I {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></I>;
export const Copiar = (p) => <I {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></I>;
export const Check = (p) => <I {...p} strokeWidth={2.6}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const Equis = (p) => <I {...p} strokeWidth={2.6}><path d="M6 6l12 12M18 6 6 18" /></I>;

export const Monedas = (p) => <I {...p}><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5" /></I>;
export const Documento = (p) => <I {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></I>;
export const Matraz = (p) => <I {...p}><path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3M8 15h8" /></I>;
export const Carrito = (p) => <I {...p}><path d="M3 4h2.4l2 11h10.2l1.9-8H6.2" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></I>;
export const Reloj = (p) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>;

export const Cuadricula = (p) => <I {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></I>;
export const Capas = (p) => <I {...p}><path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" /><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" /></I>;
export const Tendencia = (p) => <I {...p}><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></I>;
export const Jugar = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="m10 8.5 6 3.5-6 3.5v-7Z" /></I>;

// Símbolo de Stellar: círculo con dos trazos.
export const Stellar = ({ size = 22, ...p }) => (
  <svg {...base} width={size} height={size} strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M3.5 10.5 20.5 5.5M3.5 18.5 20.5 13.5" />
  </svg>
);

// Marca de Machea en línea: casa, visto bueno y flecha de crecimiento (como en el diseño de las pantallas).
export function Marca({ alto = 28 }) {
  return (
    <svg width={alto * 1.3} height={alto} viewBox="0 0 52 40" fill="none" stroke="#FF6259" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 36V19L22 5l8 7" />
      <path d="M40 36v-6" />
      <path d="M14 26l7 7L45 9" />
      <path d="M34 8h11v11" />
    </svg>
  );
}
