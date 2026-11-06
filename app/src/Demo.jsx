import { useEffect, useState } from "react";
import { ACTIVO, CONTRACT_ID, EXPLORER, PROYECTO, RONDA_PERSONALIZADA, enlaceRonda, fechaCorta, formatXlm, mensajeDeError } from "./fondeo.js";
import { Calendario, Carrito, Derecha, Edificio, Escudo, Matraz, Reloj, Stellar } from "./icons.jsx";
import { PROYECTOS, buscarProyecto, codigoNuevo, duracionHasta, proyectoDeContrato } from "./proyectos.js";
import { SIN_LLAVES, cargarCuentas, comprarRestantes, crearRonda, liberarFondos, repartirGanancias } from "./demo.js";

const PLAZOS = [
  [604800, "7 días"],
  [3600, "1 hora"],
  [360, "6 minutos (para mostrar el reembolso)"],
  [180, "3 minutos"],
];

/** Aviso antes de firmar con una cuenta de prueba: estas acciones no se pueden deshacer. */
function Confirmar({ texto, alConfirmar, alCancelar, ocupado }) {
  return (
    <div className="confirmar" role="alertdialog" aria-label="Confirmar acción">
      <b>Atención, esto no se puede deshacer</b>
      <p>{texto}</p>
      {(!RONDA_PERSONALIZADA || proyectoDeContrato(CONTRACT_ID)) && (
        <p className="extra">
          Estás en una <b>ronda del catálogo ({PROYECTO.nombre})</b>, la que usas para probar con tu Freighter. Si sigues, queda hecho para siempre.
          Para jugar sin riesgo, crea una ronda nueva arriba.
        </p>
      )}
      <div className="dos">
        <button className="btn" onClick={alCancelar} disabled={ocupado}>Cancelar</button>
        <button className="btn warn" onClick={alConfirmar} disabled={ocupado}>Sí, continuar</button>
      </div>
    </div>
  );
}

/**
 * Modo demostración: lo que antes se hacía con los scripts de la carpeta demo/, ahora con botones.
 * Las cuentas de prueba (solo testnet) hacen de emisor, fiduciaria y otros inversionistas.
 */
export default function Demo({ resumen, config, refrescar }) {
  const [fracciones, setFracciones] = useState(20);
  const [precio, setPrecio] = useState(10);
  const [plazo, setPlazo] = useState("catalogo"); // "catalogo" = hasta la fecha límite del proyecto
  const [proyectoId, setProyectoId] = useState(PROYECTOS[0].id);
  const [monto, setMonto] = useState(100);
  const [trabajando, setTrabajando] = useState(false);
  const [registro, setRegistro] = useState([]); // líneas de texto; las de transacción llevan hash
  const [fiduciaria, setFiduciaria] = useState("");
  const [sinLlaves, setSinLlaves] = useState(false);
  const [pendiente, setPendiente] = useState(null); // acción que espera confirmación: comprar | liberar | repartir

  useEffect(() => {
    cargarCuentas()
      .then((c) => setFiduciaria(c.fiduciaria.publicKey()))
      .catch((e) => setSinLlaves(e?.message === SIN_LLAVES));
  }, []);

  const anotar = (texto, hash) => setRegistro((r) => [...r, { texto, hash }]);

  async function correr(fn) {
    setTrabajando(true);
    setRegistro([]);
    try {
      await fn();
    } catch (e) {
      anotar(`✗ ${mensajeDeError(e)}`);
    } finally {
      setTrabajando(false);
      refrescar().catch(() => {});
    }
  }

  const crear = () =>
    correr(async () => {
      const wasm = new Uint8Array(await (await fetch(`${import.meta.env.BASE_URL}fondeo.wasm`)).arrayBuffer());
      const proyecto = buscarProyecto(proyectoId);
      const duracion = plazo === "catalogo" ? duracionHasta(proyecto) : Number(plazo);
      const r = await crearRonda({ fracciones, precio, duracion, wasm, codigo: codigoNuevo(proyecto) }, anotar);
      anotar(`✔ Ronda lista: ${r.codigo}. Abriéndola en la app…`);
      // El enlace con ?contrato=… hace que la app recargue y use la ronda nueva.
      setTimeout(() => {
        window.location.hash = enlaceRonda({ contrato: r.contrato, codigo: r.codigo, emisor: r.emisor, proyecto: proyecto.id, vista: "demo" });
      }, 1200);
    });

  const comprar = () =>
    correr(async () => {
      const r = await comprarRestantes(anotar);
      anotar(`✔ Ronda completa: el comprador de prueba compró ${r.fracciones} fracciones.`, r.hash);
    });

  const liberar = () =>
    correr(async () => {
      const r = await liberarFondos();
      anotar("✔ La fiduciaria liberó los fondos a la constructora.", r.hash);
    });

  const repartir = () =>
    correr(async () => {
      const r = await repartirGanancias(monto);
      r.lineas.forEach((l) => anotar(`  ${l}`));
      anotar(`✔ Reparto de ${monto} XLM enviado en una sola transacción.`, r.hash);
    });

  const bloqueado = trabajando || sinLlaves; // sin llaves de prueba, los botones de la demo no pueden firmar
  const faltan = resumen ? resumen.total - resumen.vendidas : 0;
  const estado = resumen?.estado;
  const mismaFiduciaria = Boolean(config && fiduciaria && config.fiduciaria === fiduciaria);
  const etiqueta = { Recaudando: "recaudando", Exitosa: "meta alcanzada", Liberada: "completada", Fallida: "no se completó" }[estado];

  return (
    <>
      <h1>Modo demostración</h1>
      <p className="sub">Cuentas de prueba simulan la fiduciaria y a otros inversionistas, para mostrar el ciclo completo desde aquí. Solo testnet.</p>

      <div className="banner">
        <span className="tile"><Matraz size={34} /></span>
        <div>
          <small>Demo en Testnet</small>
          <b>Prueba el ciclo completo</b>
          <span>Crea una ronda, simula inversiones, libera fondos y reparte ganancias.</span>
        </div>
      </div>

      {sinLlaves && (
        <div className="aviso error">
          Esta copia del proyecto no incluye llaves de prueba, así que los botones de la demo están desactivados. Para usarlos, crea tres cuentas de
          testnet (emisor, fiduciaria y comprador) y pon sus llaves en <code>app/src/demoKeys.js</code>. Ver el README.
        </div>
      )}

      <div className="dos-col">
        <div className="col">
          <div className="panel">
            <div className="panel-cab">
              <span className="tile rosa"><Edificio size={26} /></span>
              <div>
                <h3>1 · Crear una ronda nueva</h3>
                <small>Crea el activo, despliega el contrato y lo configura (tarda cerca de 30 segundos).</small>
              </div>
            </div>
            <label className="campo">
              Proyecto
              <select
                value={proyectoId}
                onChange={(e) => {
                  const p = buscarProyecto(e.target.value);
                  setProyectoId(p.id);
                  setFracciones(p.fracciones);
                  setPrecio(p.precio);
                }}
                disabled={trabajando}
              >
                {PROYECTOS.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} · {p.zona.split(",")[0]}</option>
                ))}
              </select>
            </label>
            <div className="campos">
              <label>
                Fracciones
                <input type="number" min="1" max="1000" value={fracciones} onChange={(e) => setFracciones(Number(e.target.value))} disabled={trabajando} />
              </label>
              <label>
                Precio (XLM)
                <input type="number" min="1" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} disabled={trabajando} />
              </label>
            </div>
            <label className="campo">
              Plazo
              <select value={plazo} onChange={(e) => setPlazo(e.target.value)} disabled={trabajando}>
                <option value="catalogo">Hasta la fecha del catálogo ({buscarProyecto(proyectoId).limite})</option>
                {PLAZOS.map(([s, t]) => (
                  <option key={s} value={s}>{t}</option>
                ))}
              </select>
            </label>
            <button className="btn main" onClick={crear} disabled={bloqueado || fracciones < 1 || precio < 1}>Crear ronda</button>
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-cab">
              <span className="tile azul"><Reloj size={26} /></span>
              <div>
                <h3>2 · Ronda actual: {PROYECTO.nombre}</h3>
                <small>
                  {resumen
                    ? `${etiqueta} · ${resumen.vendidas} de ${resumen.total} fracciones · ${formatXlm(resumen.recaudado)} XLM · plazo hasta ${fechaCorta(resumen.fechaLimite)}`
                    : "Leyendo la ronda…"}
                </small>
              </div>
            </div>

            {resumen && (
              <div className="mini">
                <div><span className="tile verde"><Escudo size={22} /></span><span><small>Fracciones vendidas</small><b>{resumen.vendidas} de {resumen.total}</b></span></div>
                <div><span className="tile verde"><Stellar size={22} /></span><span><small>Recaudado</small><b>{formatXlm(resumen.recaudado)} XLM</b></span></div>
                <div><span className="tile rosa"><Calendario size={22} /></span><span><small>Vencimiento</small><b>{fechaCorta(resumen.fechaLimite)}</b></span></div>
              </div>
            )}

            {RONDA_PERSONALIZADA && (
              <a className="volver" href="#demo?ronda=reset">Volver a la ronda por defecto</a>
            )}

            {config && fiduciaria && !mismaFiduciaria && (
              <p className="nota">Esta ronda tiene otra fiduciaria: el modo demostración no puede firmar por ella. Crea una ronda nueva.</p>
            )}

            <button className="accion azul" onClick={() => setPendiente("comprar")} disabled={bloqueado || estado !== "Recaudando" || faltan <= 0}>
              <span className="tile"><Carrito size={24} /></span>
              <span className="txt">
                <b>Comprar lo que falta{estado === "Recaudando" && faltan > 0 ? ` (${faltan} fracciones)` : ""}</b>
                <small>Hace de «otros inversionistas»: una cuenta de prueba compra las fracciones restantes.</small>
              </span>
              <span className="flecha"><Derecha size={18} /></span>
            </button>

            {pendiente === "comprar" && (
              <Confirmar
                ocupado={trabajando}
                texto={`Una cuenta de prueba va a pagar ${faltan} fracciones de esta ronda y la va a completar.`}
                alCancelar={() => setPendiente(null)}
                alConfirmar={() => { setPendiente(null); comprar(); }}
              />
            )}

            <button className="accion verde" onClick={() => setPendiente("liberar")} disabled={bloqueado || estado !== "Exitosa" || !mismaFiduciaria}>
              <span className="tile"><Escudo size={24} /></span>
              <span className="txt">
                <b>Liberar fondos a la constructora</b>
                <small>Hace de fiduciaria. Solo cuando la ronda llegó a la meta.</small>
              </span>
              <span className="flecha"><Derecha size={18} /></span>
            </button>

            {pendiente === "liberar" && (
              <Confirmar
                ocupado={trabajando}
                texto="La fiduciaria de prueba va a enviar todo el dinero recaudado a la constructora."
                alCancelar={() => setPendiente(null)}
                alConfirmar={() => { setPendiente(null); liberar(); }}
              />
            )}

            <div className="campos reparto">
              <label>
                Ganancias a repartir (XLM)
                <input type="number" min="1" value={monto} onChange={(e) => setMonto(Number(e.target.value))} disabled={trabajando} />
              </label>
            </div>
            <button className="accion" onClick={() => setPendiente("repartir")} disabled={bloqueado || estado !== "Liberada" || !mismaFiduciaria || !(monto > 0)}>
              <span className="tile"><Stellar size={24} /></span>
              <span className="txt">
                <b>Repartir ganancias</b>
                <small>Hace de fiduciaria: reparte entre quienes tienen fracciones, según su porcentaje. Solo con la ronda completada.</small>
              </span>
              <span className="flecha"><Derecha size={18} /></span>
            </button>

            {pendiente === "repartir" && (
              <Confirmar
                ocupado={trabajando}
                texto={`La fiduciaria de prueba va a enviar ${monto} XLM a las personas que tienen fracciones, en una sola transacción.`}
                alCancelar={() => setPendiente(null)}
                alConfirmar={() => { setPendiente(null); repartir(); }}
              />
            )}

            <p className="nota">
              Para mostrar el reembolso: crea una ronda con plazo corto, invierte desde tu wallet y espera a que venza. Luego, en «Seguimiento»,
              pulsa «Recuperar mi dinero».
            </p>
          </div>
        </div>
      </div>

      {registro.length > 0 && (
        <div className="registro">
          {registro.map((l, i) => (
            <div key={i}>
              {l.texto}
              {l.hash && (
                <>
                  {" "}
                  <a href={`${EXPLORER}/tx/${l.hash}`} target="_blank" rel="noreferrer">Ver transacción</a>
                </>
              )}
            </div>
          ))}
          {trabajando && <div className="espera">Trabajando…</div>}
        </div>
      )}
      <p className="nota">
        Contrato de la ronda:{" "}
        <a href={`${EXPLORER}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">ver en stellar.expert</a>
      </p>
    </>
  );
}
