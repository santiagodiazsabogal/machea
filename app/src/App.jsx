import { useEffect, useState } from "react";
import { conectarWallet, cargarBalances, agregarTrustline } from "./stellar.js";
import { firmarConFreighter } from "./wallet.js";
import {
  CONTRACT_ID,
  EXPLORER,
  ACTIVO,
  PROYECTO,
  crearCliente,
  leerRonda,
  leerGanancias,
  invertir,
  liberar,
  reembolsar,
  formatXlm,
  formatCop,
  fechaCorta,
  mensajeDeError,
} from "./fondeo.js";
import { Marca, Edificio, Grafico, Billetera, Externo, Info, Pin, Calendario, Escudo, Derecha, Atras, Copiar, Check, Equis, Stellar, Documento, Cuadricula, Capas, Tendencia, Jugar } from "./icons.jsx";
import fotoProyecto from "./assets/proyecto.jpg";
import Demo from "./Demo.jsx";
import Proyectos from "./Proyectos.jsx";

const VISTAS = [
  ["portafolio", "Mi portafolio", Cuadricula],
  ["proyectos", "Proyectos", Edificio],
  ["invertir", "Invertir", Capas],
  ["seguimiento", "Seguimiento", Tendencia],
  ["demo", "Demo", Jugar],
];

function leerHash() {
  const [v, q = ""] = window.location.hash.replace("#", "").split("?");
  return { vista: VISTAS.some(([k]) => k === v) ? v : "portafolio", muestra: new URLSearchParams(q).has("muestra") };
}
const corto = (g, n = 6) => `${g.slice(0, n)}…${g.slice(-n)}`;
const num2 = (n) => Number(n).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

// Solo en desarrollo: #portafolio?muestra pinta datos de ejemplo para revisar el diseño sin wallet.
const MUESTRA = [
  { codigo: "XLM", emisor: null, balance: "1983.90" },
  { codigo: ACTIVO.codigo, emisor: ACTIVO.emisor, balance: "5.0000000" },
];
const WALLET_MUESTRA = "GAATGMTDWWWTRSFYMDKCGGV2ALLFFOSWTSJPJGIGDGSU4J2POOGLNFWX";

export default function App() {
  const inicial = leerHash();
  const [vista, setVista] = useState(inicial.vista);
  const [address, setAddress] = useState("");
  const [balances, setBalances] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [config, setConfig] = useState(null);
  const [ganancias, setGanancias] = useState(0n);
  const [fracciones, setFracciones] = useState(5);
  const [aviso, setAviso] = useState(null); // { tipo: info | ok | error, texto, hash? }
  const [ocupado, setOcupado] = useState(false);

  const muestra = import.meta.env.DEV && inicial.muestra;
  const wallet = muestra ? WALLET_MUESTRA : address;
  const filas = muestra ? MUESTRA : balances;
  const fila = filas.find((b) => b.codigo === ACTIVO.codigo && b.emisor === ACTIVO.emisor);
  const tieneTrustline = Boolean(fila);
  const misFracciones = fila ? Math.floor(Number(fila.balance)) : 0;

  const error = (e) => setAviso({ tipo: "error", texto: mensajeDeError(e) });

  // Lecturas, sin firma y en paralelo: la ronda y los balances salen a la vez, y las ganancias
  // (que necesitan saber quién es la fiduciaria) en cuanto llega la ronda.
  async function refrescar() {
    const tareas = [
      leerRonda().then(async ({ resumen, config }) => {
        setResumen(resumen);
        setConfig(config);
        if (address) setGanancias(await leerGanancias(address, config.fiduciaria));
      }),
    ];
    if (address) tareas.push(cargarBalances(address).then(setBalances));
    const resultados = await Promise.allSettled(tareas);
    const fallo = resultados.find((r) => r.status === "rejected");
    if (fallo) error(fallo.reason);
  }

  // Al abrir, al conectar la wallet y cada 15 segundos (así el seguimiento se actualiza solo).
  useEffect(() => {
    refrescar();
    const cada15s = setInterval(refrescar, 15000);
    return () => clearInterval(cada15s);
  }, [address]);

  function ir(v) {
    setVista(v);
    setAviso(null);
    window.location.hash = v;
  }

  async function conectar() {
    try {
      setOcupado(true);
      setAviso({ tipo: "info", texto: "Conectando con Freighter…" });
      setAddress(await conectarWallet());
      setAviso(null);
    } catch (e) {
      error(e);
    } finally {
      setOcupado(false);
    }
  }

  const avisoFirmada = () => setAviso({ tipo: "info", texto: "Firmada. Esperando a que la red la confirme (puede tardar unos segundos)…" });
  const clienteConFirma = () => crearCliente({ publicKey: address, signTransaction: firmarConFreighter(address, avisoFirmada) });

  // Para recibir un activo de Stellar hay que aceptarlo antes (trustline).
  async function aceptarActivo() {
    try {
      setOcupado(true);
      setAviso({ tipo: "info", texto: "Esperando tu firma en Freighter para aceptar el activo…" });
      const hash = await agregarTrustline({ desde: address, codigo: ACTIVO.codigo, emisor: ACTIVO.emisor });
      setAviso({ tipo: "info", texto: "Activo aceptado. Actualizando tu cuenta…" });
      await refrescar();
      setAviso({ tipo: "ok", texto: `Listo: ya puedes recibir ${ACTIVO.codigo}.`, hash });
    } catch (e) {
      error(e);
    } finally {
      setOcupado(false);
    }
  }

  async function accion(texto, fn) {
    try {
      setOcupado(true);
      setAviso({ tipo: "info", texto: "Simulando la transacción y esperando tu firma en Freighter…" });
      const { hash } = await fn(await clienteConFirma());
      await refrescar();
      setAviso({ tipo: "ok", texto, hash });
    } catch (e) {
      error(e);
    } finally {
      setOcupado(false);
    }
  }

  const disponibles = resumen ? resumen.total - resumen.vendidas : 0;
  const cantidad = Math.max(1, Math.min(Number(fracciones) || 1, Math.max(disponibles, 1)));

  return (
    <div className="app">
      <div className="tarjeta">
        <div className="top">
          <div className="logo"><Marca alto={30} />Machea</div>
          <div className="red"><Stellar size={19} /><span><b>Stellar</b></span><em><i />Testnet</em></div>
        </div>

        {vista === "portafolio" && (
          <Portafolio wallet={wallet} filas={filas} misFracciones={misFracciones} resumen={resumen} ganancias={muestra ? 50000000n : ganancias} conectar={conectar} irInvertir={() => ir("invertir")} ocupado={ocupado} />
        )}

        {vista === "invertir" && (
          <Invertir
            wallet={wallet}
            resumen={resumen}
            cantidad={cantidad}
            setFracciones={setFracciones}
            misFracciones={misFracciones}
            tieneTrustline={tieneTrustline}
            ocupado={ocupado}
            atras={() => ir("portafolio")}
            conectar={conectar}
            aceptarActivo={aceptarActivo}
            invertir={() =>
              accion(`Invertiste ${cantidad} fracciones: ya las ves en tu wallet.`, (c) => invertir(c, { inversionista: address, fracciones: cantidad }))
            }
          />
        )}

        {vista === "seguimiento" && (
          <Seguimiento
            resumen={resumen}
            config={config}
            wallet={wallet}
            misFracciones={misFracciones}
            ocupado={ocupado}
            conectar={conectar}
            liberar={() => accion("Fondos liberados a la constructora.", (c) => liberar(c))}
            reembolsar={() => accion("Recuperaste tu dinero.", (c) => reembolsar(c, { tenedor: address, fracciones: misFracciones }))}
          />
        )}

        {vista === "proyectos" && <Proyectos irInvertir={() => ir("invertir")} />}

        {vista === "demo" && <Demo resumen={resumen} config={config} refrescar={refrescar} />}

        {aviso && (
          <div className={`aviso ${aviso.tipo}`}>
            {aviso.texto}
            {aviso.hash && (
              <>
                {" "}<a href={`${EXPLORER}/tx/${aviso.hash}`} target="_blank" rel="noreferrer">Ver transacción</a>
                <br /><code>{aviso.hash}</code>
              </>
            )}
          </div>
        )}
      </div>

      <div className="nav">
        {VISTAS.map(([k, nombre, Icono]) => (
          <button key={k} className={vista === k ? "on" : ""} onClick={() => ir(k)}><Icono size={19} />{nombre}</button>
        ))}
      </div>
    </div>
  );
}

function Portafolio({ wallet, filas, misFracciones, resumen, ganancias, conectar, irInvertir, ocupado }) {
  const xlm = Number(filas.find((b) => b.codigo === "XLM")?.balance ?? 0);
  const participacion = resumen && resumen.total ? (misFracciones / resumen.total) * 100 : 0;
  return (
    <>
      <h1>Mi portafolio</h1>
      <p className="sub">Tu cartera en Stellar y tus fracciones de proyectos inmobiliarios</p>

      <div className="hero">
        <div className="hero-id">
          <span className="tile"><Stellar size={34} /></span>
          <div>
            <small>Balance en Stellar</small>
            <div className="monto">{num2(xlm)}<span>XLM</span></div>
            <div className="cop">≈ ${formatCop(xlm)} COP <em>(ejemplo)</em></div>
          </div>
        </div>
        <div className="hero-acciones">
          {!wallet ? (
            <button className="hbtn" onClick={conectar} disabled={ocupado}><Billetera size={22} />Conectar wallet</button>
          ) : (
            <button className="hbtn" onClick={irInvertir}><Edificio size={22} />Invertir en el proyecto</button>
          )}
          <a className="hlink" href={wallet ? `${EXPLORER}/account/${wallet}` : `${EXPLORER}/asset/${ACTIVO.codigo}-${ACTIVO.emisor}`} target="_blank" rel="noreferrer">
            <Externo size={18} />Ver en stellar.expert
          </a>
        </div>
      </div>

      <div className="rejilla">
        <div className="fila">
          <span className="ico rosa"><Edificio size={30} /></span>
          <span className="txt">Fracciones {ACTIVO.codigo}</span>
          <span className="valor">{misFracciones.toLocaleString("es-CO")}</span>
          <span className="flecha"><Derecha size={20} /></span>
        </div>

        <div className="fila part">
          <span className="ico azul"><Grafico size={30} /></span>
          <span className="txt">
            Mi participación
            <b>{pct(participacion)} %</b>
            <small>del proyecto {PROYECTO.nombre}</small>
          </span>
          <span className="flecha"><Derecha size={20} /></span>
        </div>

        <div className="fila">
          <span className="ico verde"><Stellar size={28} /></span>
          <span className="txt">Ganancias recibidas<small>repartidas por la fiduciaria</small></span>
          <span className="valor">{formatXlm(ganancias)} XLM</span>
        </div>
      </div>

      <div className="caja verde">
        <Info size={26} />
        <div><b>¿Qué es esto?</b>Administra tu balance en XLM, tus fracciones del proyecto (un activo de Stellar) y tu participación en él.</div>
      </div>
    </>
  );
}

function Invertir({ wallet, resumen, cantidad, setFracciones, misFracciones, tieneTrustline, ocupado, atras, conectar, aceptarActivo, invertir }) {
  const precioXlm = resumen ? Number(resumen.precio) / 1e7 : 0;
  const total = precioXlm * cantidad;
  const avance = resumen && resumen.total ? (resumen.vendidas / resumen.total) * 100 : 0;
  const abierta = resumen?.estado === "Recaudando";
  const nuevaParticipacion = resumen && resumen.total ? ((misFracciones + cantidad) / resumen.total) * 100 : 0;

  let boton;
  if (!wallet) boton = <button className="btn main" onClick={conectar} disabled={ocupado}><Billetera size={24} />Conectar wallet para invertir</button>;
  else if (!abierta) boton = <button className="btn" disabled>La ronda ya no recibe inversiones</button>;
  else if (!tieneTrustline) boton = <button className="btn main" onClick={aceptarActivo} disabled={ocupado}><Billetera size={24} />1. Aceptar el activo {ACTIVO.codigo}</button>;
  else boton = <button className="btn main" onClick={invertir} disabled={ocupado}><Billetera size={24} />Invertir con Freighter</button>;

  return (
    <>
      <div className="titulo">
        <button className="atras" onClick={atras} aria-label="Volver"><Atras size={20} /></button>
        <h1>Invertir en un proyecto</h1>
      </div>
      <p className="sub">Compra fracciones del proyecto con un pago seguro en Stellar.</p>

      <div className="dos-col">
      <div className="col">
      <div className="proyecto">
        <img src={PROYECTO.imagen || fotoProyecto} alt={`Imagen ilustrativa de ${PROYECTO.nombre}`} />
        <div className="dato">
          <small>Proyecto</small>
          <h2>{PROYECTO.nombre}</h2>
          <div className="zona"><Pin size={17} />{PROYECTO.zona}</div>
          <span className="unidad"><select disabled aria-label="Ronda"><option>Ronda de fondeo</option></select></span>
        </div>
        <span className="flecha"><Derecha size={20} /></span>
      </div>

      {resumen && (
        <div className="resumen">
          <h3>La ronda</h3>
          <div className="dato-fila">
            <span className="ico"><Escudo size={24} /></span>
            <span className="et">Meta</span>
            <span className="val"><b>{num2(precioXlm * resumen.total)} XLM</b><small>≈ ${formatCop(precioXlm * resumen.total)} COP</small></span>
          </div>
          <div className="avance">
            <div className="barra"><i style={{ width: `${avance}%` }} /></div>
            <span>{resumen.vendidas} de {resumen.total} fracciones · {pct(avance)} %</span>
          </div>
          <div className="dato-fila">
            <span className="ico"><Calendario size={24} /></span>
            <span className="et">Plazo</span>
            <span className="val">Hasta {fechaCorta(resumen.fechaLimite)}</span>
          </div>
          <div className="dato-fila">
            <span className="ico"><Edificio size={24} /></span>
            <span className="et">Precio por fracción</span>
            <span className="val"><b>{num2(precioXlm)} XLM</b><small>≈ ${formatCop(precioXlm)} COP</small></span>
          </div>
        </div>
      )}

      </div>
      <div className="col compra">
      {abierta && (
        <div className="comprar">
          <label htmlFor="frac"><span className="tile rosa"><Stellar size={24} /></span>Fracciones a comprar</label>
          <div className="stepper">
            <button onClick={() => setFracciones(Math.max(1, cantidad - 1))} aria-label="Menos">−</button>
            <input id="frac" inputMode="numeric" value={cantidad} onChange={(e) => setFracciones(e.target.value.replace(/\D/g, ""))} />
            <button onClick={() => setFracciones(cantidad + 1)} aria-label="Más">+</button>
          </div>
        </div>
        )}

        {abierta && (
        <div className="totales">
          <div className="dato-fila"><span className="et">Total a pagar</span><span className="val"><b>{num2(total)} XLM</b></span></div>
          <div className="dato-fila"><span className="et">Tu participación</span><span className="val"><b>{pct(nuevaParticipacion)} %</b></span></div>
        </div>
      )}

      {boton}

      <div className="caja verde">
        <Info size={26} />
        <div><b>¿Qué sucede con mi dinero?</b>Tu dinero queda bloqueado en un contrato en Stellar. Si no se completa la meta, lo recuperas tú mismo.</div>
      </div>
      </div>
      </div>
    </>
  );
}

function Seguimiento({ resumen, config, wallet, misFracciones, ocupado, conectar, liberar, reembolsar }) {
  const [copiado, setCopiado] = useState(false);
  if (!resumen) return (<><h1>Seguimiento del proyecto</h1><p className="sub">Leyendo la ronda en la red…</p></>);

  const { estado } = resumen;
  const exito = estado === "Exitosa" || estado === "Liberada";
  const avance = resumen.total ? (resumen.vendidas / resumen.total) * 100 : 0;
  const esFiduciaria = wallet && config && wallet === config.fiduciaria;
  const etiqueta = { Recaudando: "En proceso", Exitosa: "Meta alcanzada", Liberada: "Completada", Fallida: "No se completó" }[estado];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(CONTRACT_ID);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* el navegador no dejó copiar */ }
  }

  return (
    <>
      <h1>Seguimiento del proyecto</h1>
      <p className="sub">Consulta el estado y la trazabilidad en la red.</p>

      <div className="dos-col">
      <div className="col">
      <div className="linea">
        <span className={`estado ${exito ? "ok" : ""}`}>{etiqueta}</span>
        <ul className="pasos">
          <Paso estado="hecho" titulo="Ronda abierta" detalle={`Plazo hasta ${fechaCorta(resumen.fechaLimite)}`} fecha />
          <Paso
            estado={estado === "Recaudando" ? "activo" : exito ? "hecho" : "no"}
            titulo="Recaudando fondos"
            detalle={`${resumen.vendidas} de ${resumen.total} fracciones vendidas`}
          />
          <Paso
            estado={exito ? "hecho" : estado === "Fallida" ? "no" : "pendiente"}
            titulo="Meta alcanzada"
            detalle={exito ? "Se vendieron todas las fracciones" : estado === "Fallida" ? "No se alcanzó la meta a tiempo" : "Faltan fracciones por vender"}
          />
          <Paso
            estado={estado === "Liberada" ? "hecho" : estado === "Fallida" ? "no" : "pendiente"}
            titulo="Fondos a la constructora"
            detalle={estado === "Liberada" ? "La fiduciaria los liberó" : estado === "Fallida" ? "Cada inversionista recupera su dinero" : "La fiduciaria los libera al alcanzar la meta"}
          />
        </ul>
        <div className="avance sola">
          <div className="barra"><i style={{ width: `${avance}%` }} /></div>
          <span>{pct(avance)} % de la meta</span>
        </div>
      </div>

      </div>
      <div className="col">
      <div className="tira">
        <div><span className="tile azul"><Stellar size={26} /></span><span className="dato"><small>Recaudado</small><b>{formatXlm(resumen.recaudado)} XLM</b></span></div>
        <div>
          <span className="tile rosa"><Documento size={26} /></span>
          <span className="dato">
            <small>Contrato</small>
            <span className="c">{corto(CONTRACT_ID, 4)}<button onClick={copiar} aria-label="Copiar contrato">{copiado ? <Check size={18} /> : <Copiar size={18} />}</button></span>
          </span>
        </div>
        <div>
          <span className="tile azul"><Stellar size={26} /></span>
          <span className="dato">
            <small>Ver en Stellar</small>
            <span className="c"><a href={`${EXPLORER}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">stellar.expert<Externo size={17} /></a></span>
          </span>
        </div>
      </div>

      <div className="que">
        <h3><Escudo size={28} />¿Qué puede pasar?</h3>
        <p><b>Se llega a la meta:</b> la fiduciaria libera el dinero a la constructora y tus fracciones son tu participación en el proyecto.</p>
        <p className="malo"><b>No se llega a la meta:</b> devuelves tus fracciones y recuperas tu dinero, sin pedirle permiso a nadie.</p>
      </div>

      {!wallet && <button className="btn" onClick={conectar} disabled={ocupado}><Billetera size={22} />Conectar wallet para actuar</button>}

      {estado === "Fallida" && misFracciones > 0 && (
        <button className="btn warn" onClick={reembolsar} disabled={ocupado}>Recuperar mi dinero ({misFracciones} fracciones)</button>
      )}

      {esFiduciaria && estado === "Exitosa" && (
        <div className="fiduciaria">
          <h3>Panel de la fiduciaria</h3>
          <small>La meta se alcanzó. Solo la fiduciaria ve esto.</small>
          <button className="btn ok" onClick={liberar} disabled={ocupado}>Liberar fondos a la constructora</button>
        </div>
      )}
      </div>
      </div>
    </>
  );
}

function Paso({ estado, titulo, detalle, fecha }) {
  return (
    <li className={`paso ${estado}`}>
      <div className={`punto ${estado}`}>{estado === "hecho" ? <Check size={18} /> : estado === "no" ? <Equis size={16} /> : null}</div>
      <div><b>{titulo}</b><span className={fecha ? "fecha" : ""}>{detalle}</span></div>
    </li>
  );
}
