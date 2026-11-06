# App de fondeo (React + Vite)

La interfaz de Machea para invertir en fracciones de un proyecto. Conecta Freighter, lee la ronda de fondeo desde su contrato en Stellar y te deja **invertir**, ver el **seguimiento**, **recuperar tu dinero** si la ronda fracasa y ver las **ganancias** que te reparte la fiduciaria.

```bash
npm install
npm run dev        # muestra el puerto, normalmente http://localhost:5173
npm run build      # compila para producción
```

Requisitos: Node 20 o superior y la extensión Freighter en modo TEST NET, con XLM de prueba.

## Qué hay en `src/`

| Archivo | Qué hace |
|---|---|
| `App.jsx` | Las tres pantallas (Mi portafolio, Invertir, Seguimiento) y todo el estado |
| `fondeo.js` | Todo lo que habla con el contrato de fondeo: leer la ronda, invertir, liberar, reembolsar y leer ganancias. No tiene interfaz, así que se puede probar desde la terminal |
| `Demo.jsx`, `demo.js`, `reparto.js`, `demoKeys.js` | La pestaña **Demo**: crea rondas, completa la meta, libera fondos y reparte ganancias con cuentas de prueba (hace lo de los scripts de `demo/`). `demoKeys.js` va **vacío** en esta copia pública: pon ahí tus propias llaves de testnet para activar la pestaña (solo testnet) |
| `wallet.js` | Le pide a Freighter que firme. La llave secreta nunca sale de la extensión |
| `stellar.js` | Del starter de la sesión 3: conectar la wallet, leer balances (Horizon) y aceptar un activo (`changeTrust`) |
| `icons.jsx`, `styles.css` | Íconos y estilo de Machea |

`scripts/repartir.mjs` calcula y envía el reparto de ganancias; se corre con `demo/repartir.sh`.

## Qué ronda usa

La ronda por defecto se define en `fondeo.js` y se puede cambiar con un archivo `.env` (copia `.env.example`). Para una demo, la app también acepta una ronda por enlace:

```
#invertir?contrato=C…&activo=CODIGO
```

La recuerda en el navegador; el enlace «usar la ronda por defecto» del pie de página la borra. Las rondas nuevas se crean con `demo/ronda.sh` (ver `../demo/README.md`).

## Cómo agregar una operación nueva

1. En `fondeo.js`, una función que simule la llamada al contrato (aquí aparecen los errores) y luego la firme y envíe.
2. En `App.jsx`, el botón que la llama y muestra el hash.
3. Pruébala en testnet y busca el hash en stellar.expert.
