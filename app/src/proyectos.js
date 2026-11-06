// Catálogo de proyectos de Machea (ficticios, solo para el prototipo en testnet).
// Cada proyecto tiene su propia ronda de fondeo en la red: un contrato y un activo de Stellar.
// El contrato solo guarda meta, precio y plazo; el nombre, la zona, la descripción y la imagen viven aquí.

const imagen = (archivo) => new URL(`./assets/proyectos/${archivo}`, import.meta.url).href;

// La fecha límite del catálogo se fija al final de ese día, hora de Bogotá (UTC-5).
const finDelDia = (fecha) => Math.floor(new Date(`${fecha}T23:59:00-05:00`).getTime() / 1000);

export const PROYECTOS = [
  {
    id: "cedros",
    numero: 1,
    nombre: "Mirador de los Cedros",
    zona: "Cedritos, Usaquén, Bogotá",
    descripcion: "Apartamentos familiares de 2 y 3 habitaciones, zonas verdes y coworking.",
    fracciones: 120,
    precio: 10,
    limite: "2026-11-26",
    prefijo: "CEDROS",
    imagen: imagen("cedros.jpg"),
    contrato: "CDFVURKCSANWQ4O4T5AOGIFDBSUSLKVF6CTP7R4ALEBPCY7BLSJWFNBH",
    codigo: "CEDROS2",
  },
  {
    id: "urban85",
    numero: 2,
    nombre: "Urban 85",
    zona: "Chapinero Alto, Bogotá",
    descripcion: "Apartaestudios modernos orientados a jóvenes profesionales y alquiler residencial.",
    fracciones: 150,
    precio: 8,
    limite: "2026-11-30",
    prefijo: "URBAN85",
    imagen: imagen("urban85.jpg"),
    contrato: "CAYGSFHRXFMFL2EXCZYQA2DLUPGNVPUZCP5NIO5HKKYW2OXEHNZLKN2M",
    codigo: "URBAN852",
  },
  {
    id: "salitre",
    numero: 3,
    nombre: "Reserva del Salitre",
    zona: "Salitre, Fontibón, Bogotá",
    descripcion: "Proyecto residencial con terrazas, gimnasio y espacios familiares.",
    fracciones: 80,
    precio: 15,
    limite: "2026-12-04",
    prefijo: "SALITRE",
    imagen: imagen("salitre.jpg"),
    contrato: "CCC5QZPVXJ4HUDNK5ICIX73XKOMO6IK7VU6C4RSDZS3NFELI3KZPUHKT",
    codigo: "SALITRE",
  },
  {
    id: "horizonte",
    numero: 4,
    nombre: "Horizonte Verde",
    zona: "Bosa, Bogotá",
    descripcion: "Vivienda de interés social con áreas comunales y comercio cercano.",
    fracciones: 200,
    precio: 5,
    limite: "2026-12-08",
    prefijo: "HORIZ",
    imagen: imagen("horizonte.jpg"),
    contrato: "CDYZW6EVYQFVGFHL6ZILZN5FSHAJSCOELD5CVOGC2B5RVSSAPNCWF52D",
    codigo: "HORIZONTE2",
  },
  {
    id: "rosales",
    numero: 5,
    nombre: "Altos de Rosales",
    zona: "Rosales, Chapinero, Bogotá",
    descripcion: "Apartamentos exclusivos con terrazas privadas y diseño contemporáneo.",
    fracciones: 100,
    precio: 12,
    limite: "2026-12-12",
    prefijo: "ROSALES",
    imagen: imagen("rosales.jpg"),
    contrato: "CCZDNPBKYYVLF4GG2QM733BFJWQDW5IYMACZBGQIRRV6Z6BFD5KHDE2V",
    codigo: "ROSALES",
  },
  {
    id: "colina",
    numero: 6,
    nombre: "Colina Park Living",
    zona: "Colina Campestre, Suba, Bogotá",
    descripcion: "Conjunto residencial con senderos peatonales, gimnasio y zonas sociales.",
    fracciones: 160,
    precio: 10,
    limite: "2026-12-18",
    prefijo: "COLINA",
    imagen: imagen("colina.jpg"),
    contrato: "CANCDH65EBTYZNOKAVKG57KFXQEVFKE6A2QEEBWZF3Z5JNQHWAFBGZPK",
    codigo: "COLINA",
  },
];

// Para las rondas que no están en el catálogo (por ejemplo, la ronda ALAMEDA2 de pruebas).
export const PROYECTO_GENERICO = {
  id: "alameda",
  nombre: "Residencial Alameda",
  zona: "Chapinero, Bogotá",
  descripcion: "Proyecto de ejemplo de las primeras pruebas.",
  imagen: null,
};

export const buscarProyecto = (id) => PROYECTOS.find((p) => p.id === id) || null;
export const proyectoDeContrato = (contrato) => PROYECTOS.find((p) => p.contrato && p.contrato === contrato) || null;

/** Segundos que faltan hasta la fecha límite del catálogo (mínimo 1 hora, para no crear rondas ya vencidas). */
// Se restan 150 s porque la ronda empieza a contar cuando termina de crearse (tarda cerca de un minuto), y así el plazo queda antes de la medianoche.
export const duracionHasta = (proyecto) => Math.max(3600, finDelDia(proyecto.limite) - 150 - Math.floor(Date.now() / 1000));

/** Código de activo único para una ronda de este proyecto (máximo 12 caracteres: prefijo + 5 dígitos). */
export const codigoNuevo = (proyecto) => `${proyecto.prefijo}${String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0")}`.slice(0, 12);
