import { useEffect, useState } from "react";
import { PROYECTOS } from "./proyectos.js";
import { CONTRACT_ID, enlaceRonda, leerRonda } from "./fondeo.js";
import { Calendario, Derecha, Pin } from "./icons.jsx";

const ETIQUETA = { Recaudando: "Recaudando", Exitosa: "Meta alcanzada", Liberada: "Completada", Fallida: "No se completó" };
const num = (n) => Number(n).toLocaleString("es-CO");
const fecha = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

/** Catálogo: cada proyecto tiene su ronda de fondeo en Stellar; el avance se lee de la red. */
export default function Proyectos({ irInvertir }) {
  const [rondas, setRondas] = useState({}); // id del proyecto -> resumen de su ronda

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      const lecturas = await Promise.allSettled(PROYECTOS.map((p) => leerRonda(p.contrato)));
      if (!vivo) return;
      const nuevo = {};
      lecturas.forEach((l, i) => {
        if (l.status === "fulfilled") nuevo[PROYECTOS[i].id] = l.value.resumen;
      });
      setRondas(nuevo);
    }
    cargar();
    const cada20s = setInterval(cargar, 20000);
    return () => {
      vivo = false;
      clearInterval(cada20s);
    };
  }, []);

  function elegir(p) {
    if (p.contrato === CONTRACT_ID) return irInvertir();
    // El enlace con ?contrato=… hace que la app recargue y use la ronda de este proyecto.
    window.location.hash = enlaceRonda({ contrato: p.contrato, codigo: p.codigo, proyecto: p.id });
  }

  return (
    <>
      <h1>Proyectos</h1>
      <p className="sub">Elige un proyecto y compra fracciones con una ronda de fondeo en Stellar.</p>

      <div className="catalogo">
        {PROYECTOS.map((p) => {
          const r = rondas[p.id];
          const avance = r && r.total ? (r.vendidas / r.total) * 100 : 0;
          const activa = p.contrato === CONTRACT_ID;
          return (
            <article className={`proy ${activa ? "activa" : ""}`} key={p.id}>
              <div className="proy-foto">
                <img src={p.imagen} alt={`Imagen ilustrativa de ${p.nombre}`} loading="lazy" />
                <span className="proy-tag">Proyecto {String(p.numero).padStart(2, "0")} · Demo</span>
                {activa && <span className="proy-activa">Ronda activa</span>}
              </div>
              <div className="proy-cuerpo">
                <h3>{p.nombre}</h3>
                <p className="proy-zona"><Pin size={16} />{p.zona}</p>
                <p className="proy-desc">{p.descripcion}</p>

                <dl className="proy-datos">
                  <div><dt>Fracciones</dt><dd>{num(p.fracciones)}</dd></div>
                  <div><dt>Precio / fracción</dt><dd>{num(p.precio)} XLM</dd></div>
                  <div><dt>Meta de la ronda</dt><dd>{num(p.fracciones * p.precio)} XLM</dd></div>
                  <div><dt><Calendario size={14} /> Fecha límite</dt><dd>{fecha(p.limite)}</dd></div>
                </dl>

                <div className="proy-avance">
                  <div className="barra"><i style={{ width: `${avance}%` }} /></div>
                  <span>
                    {r ? `${r.vendidas} de ${r.total} fracciones · ${ETIQUETA[r.estado]}` : "Leyendo la ronda en la red…"}
                  </span>
                </div>

                <button className="btn main" onClick={() => elegir(p)}>
                  {activa ? "Ver y invertir" : "Elegir este proyecto"}<Derecha size={18} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="nota">Datos e imágenes ficticios para el prototipo. No son ofertas de inversión.</p>
    </>
  );
}
