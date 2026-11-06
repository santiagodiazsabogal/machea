# Machea · Ruta JaveBlockchain 2026-II

> **Copia pública** del proyecto del equipo Machea, sin el historial de trabajo y sin llaves. Todo corre en la red de práctica (testnet) de Stellar.
>
> Ruta Fundamentos del Semillero JaveBlockchain (Pontificia Universidad Javeriana).
> Equipo Machea. Integrantes: Santiago Diaz Sabogal, Juan Diego Ortiz Guerrero y Carlos Andrés Figueroa Vega.

## Qué es este proyecto

Inversión fraccionada en Stellar: una persona con montos pequeños no puede invertir en un proyecto inmobiliario porque tiene que confiar su dinero a un tercero; con la app, cualquiera compra fracciones del proyecto (un activo de Stellar), el dinero queda bloqueado en un contrato a la vista de todos, y solo se libera a la constructora si se completa la meta: si no, cada inversionista recupera lo suyo.

## Cómo funciona

1. Una **ronda de fondeo** tiene una meta (un número de fracciones), un precio por fracción y un plazo.
2. **Cualquiera invierte:** acepta el activo en su wallet (trustline) y compra fracciones. El contrato recibe el dinero y le entrega las fracciones, un activo de Stellar que ve en Freighter.
3. **Si se venden todas las fracciones,** la fiduciaria libera el dinero a la constructora. **Si pasa el plazo sin completarse,** la ronda falla sola y cada tenedor devuelve sus fracciones y recupera su dinero.
4. **Ganancias:** la fiduciaria reparte un monto (por ejemplo, el arriendo) entre los tenedores, según su porcentaje de fracciones.

| Pantalla | Operación de Stellar | ¿Firma Freighter? |
|---|---|---|
| 0 · Proyectos | Lectura `resumen` de la ronda de cada proyecto del catálogo (avance en vivo) | No |
| 1 · Mi portafolio | Lectura de la cuenta en Horizon: balance de XLM, fracciones y ganancias recibidas | No |
| 2 · Invertir en un proyecto | `changeTrust` para aceptar el activo e `invertir` en el contrato de fondeo | Sí |
| 3 · Seguimiento del proyecto | Lectura `resumen` del contrato; la fiduciaria firma `liberar` y el tenedor `reembolsar` | No al consultar; Sí al liberar o reembolsar |

## Estado actual

| Pieza | Qué es | Estado |
|---|---|---|
| **Contrato de fondeo** (`contracts/fondeo/`) | La ronda: invertir, liberar, reembolsar. El contrato emite y destruye las fracciones | 22 pruebas automáticas; probado en testnet (rondas de éxito y de fracaso) |
| **App** (`app/`) | Las tres pantallas conectadas al contrato | Funciona; falta el ensayo con Freighter en el navegador |
| **Reparto de ganancias** (`demo/repartir.sh`) | La fiduciaria reparte un monto entre los tenedores en una sola transacción | Funciona, **fuera del contrato** (hay que confiar en la fiduciaria) |
| **Modo demostración** (pestaña Demo de la app) | Botones para crear una ronda, completar la meta, liberar fondos y repartir ganancias con cuentas de prueba | Probado en navegador y testnet. En esta copia pública no hay llaves: la pestaña se activa cuando pones las tuyas de testnet |
| **Kit de demo** (`demo/`) | Scripts para crear rondas nuevas y mostrar el ciclo completo | Probado en testnet. Ver [`demo/README.md`](demo/README.md) |

El **CI de GitHub** compila los contratos, corre todas las pruebas y construye la app en cada cambio.

Lo que **no** hace todavía: repartir ganancias dentro del contrato, verificar a los inversionistas, usar pesos reales ni resolver lo legal. Es un prototipo en testnet.

## Probar la app

```bash
cd app
npm install
npm run dev        # muestra el puerto, normalmente http://localhost:5173
```

Requisitos: Node 20 o superior y la extensión **Freighter en TEST NET**, con XLM de prueba (Friendbot). La app trae una ronda por defecto; para crear rondas nuevas y ensayar la demo completa, sigue [`demo/README.md`](demo/README.md).

## El activo de las fracciones

Cada fracción es **1,0000000 de un activo de Stellar** del proyecto. El contrato de fondeo es su administrador: emite los tokens al invertir y los destruye al reembolsar.

| Dato | Valor |
|---|---|
| Ronda por defecto | Mirador de los Cedros, activo `CEDROS2` |
| Emisora | `GCTPRWM3E4JBXIQLFIZJP33HO23G6A6LS7JOPUSDAMRG734ZDEF7VGCU` |
| Contrato de fondeo | `CDFVURKCSANWQ4O4T5AOGIFDBSUSLKVF6CTP7R4ALEBPCY7BLSJWFNBH` |
| Ronda | 120 fracciones de 10 XLM, hasta el 26 de noviembre de 2026 (11:57 p. m.) |
| Explorador | https://stellar.expert/explorer/testnet/asset/CEDROS2-GCTPRWM3E4JBXIQLFIZJP33HO23G6A6LS7JOPUSDAMRG734ZDEF7VGCU |

Cada ronda nueva usa su propio activo y contrato (los crea la pestaña Demo o `demo/ronda.sh`). Las rondas de pruebas anteriores, `ALAMEDA1` y `ALAMEDA2`, quedaron como historial: lo que se escribe en la blockchain no se borra ni se reinicia.

## Proyectos del catálogo

Seis proyectos ficticios de Bogotá (de `Catalogo_Machea.pdf`), cada uno con su propia ronda real en testnet. La app los muestra en la pestaña **Proyectos** y lee el avance directo de la red. El contrato no guarda el nombre ni la imagen del proyecto: eso vive en [`app/src/proyectos.js`](app/src/proyectos.js).

| # | Proyecto | Zona | Fracciones × precio | Meta | Fecha límite | Activo | Contrato de la ronda |
|---|---|---|---|---|---|---|---|
| 1 | Mirador de los Cedros | Cedritos, Usaquén | 120 × 10 XLM | 1.200 XLM | 26 nov 2026 | `CEDROS2` | `CDFVURKCSANWQ4O4T5AOGIFDBSUSLKVF6CTP7R4ALEBPCY7BLSJWFNBH` |
| 2 | Urban 85 | Chapinero Alto | 150 × 8 XLM | 1.200 XLM | 30 nov 2026 | `URBAN852` | `CAYGSFHRXFMFL2EXCZYQA2DLUPGNVPUZCP5NIO5HKKYW2OXEHNZLKN2M` |
| 3 | Reserva del Salitre | Salitre, Fontibón | 80 × 15 XLM | 1.200 XLM | 4 dic 2026 | `SALITRE` | `CCC5QZPVXJ4HUDNK5ICIX73XKOMO6IK7VU6C4RSDZS3NFELI3KZPUHKT` |
| 4 | Horizonte Verde | Bosa | 200 × 5 XLM | 1.000 XLM | 8 dic 2026 | `HORIZONTE2` | `CDYZW6EVYQFVGFHL6ZILZN5FSHAJSCOELD5CVOGC2B5RVSSAPNCWF52D` |
| 5 | Altos de Rosales | Rosales, Chapinero | 100 × 12 XLM | 1.200 XLM | 12 dic 2026 | `ROSALES` | `CCZDNPBKYYVLF4GG2QM733BFJWQDW5IYMACZBGQIRRV6Z6BFD5KHDE2V` |
| 6 | Colina Park Living | Colina Campestre, Suba | 160 × 10 XLM | 1.600 XLM | 18 dic 2026 | `COLINA` | `CANCDH65EBTYZNOKAVKG57KFXQEVFKE6A2QEEBWZF3Z5JNQHWAFBGZPK` |

Datos e imágenes ficticios para el prototipo. No son ofertas de inversión.

## Estructura

```
README.md                      ← esta página
DEBUG_LOG.md                   ← lo que se rompió y cómo lo resolvimos
app/                           ← dApp (React + Vite) conectada al contrato de fondeo
  src/                         ← App.jsx (pantallas), fondeo.js (habla con el contrato),
                                  wallet.js (firma con Freighter), stellar.js (starter)
  scripts/repartir.mjs         ← calcula y envía el reparto de ganancias
contracts/
  fondeo/                      ← inversión fraccionada con un activo de Stellar
demo/                          ← scripts y guion para mostrar el ciclo completo
Docs/
  DISENO_FONDEO.md             ← diseño del contrato de fondeo
  PANTALLAS.md                 ← las tres pantallas y sus imágenes
  Ruta JaveBlockchain/         ← team, getting started y entrevistas
.github/workflows/ci.yml       ← el CI
```

## Historia (sesiones anteriores)

- **Etapa anterior, separación de vivienda con pago bloqueado:** se retiró del repositorio para dejar solo el proyecto definitivo. Sigue guardada en la etiqueta `antes-de-quitar-la-separacion` y en la rama `semana-4/app-separacion`. Para recuperarla: `git checkout antes-de-quitar-la-separacion -- contracts/separacion Docs/DISENO_CONTRATO.md`.
- **Sesión 2:** primer activo del equipo, `INMUEBLE` (emisora `GB6NHYBNEESIBXH4JQFLX7SQYIZUNBAQNGNZCYRFT6RWNHEQIW6RK4ND`, distribuidora `GBHAHSJU2JT7ZIZ7U73CMAPKGK4STVFFCEI7SPAB7SKX6TDD5E233GRG`, 1 000 000 emitidos). [Explorador](https://stellar.expert/explorer/testnet/asset/INMUEBLE-GB6NHYBNEESIBXH4JQFLX7SQYIZUNBAQNGNZCYRFT6RWNHEQIW6RK4ND).
- **Semana 3, pago hecho desde la app:** 10 `INMUEBLE` de la Freighter de Santiago (`GAATGMTDWWWTRSFYMDKCGGV2ALLFFOSWTSJPJGIGDGSU4J2POOGLNFWX`) a `alice` (`GDMXXGNVCOLW3G3QGW3XJSOG7IKIRMJUNPAJHY5WH4EOMPCDNFZUT7GD`), hash `f03796503357db92cf7ee34a61b6a4d68bf4fe5283a446f5d0c8cd8118ff4b0e` ([ver](https://stellar.expert/explorer/testnet/tx/f03796503357db92cf7ee34a61b6a4d68bf4fe5283a446f5d0c8cd8118ff4b0e)). Antes: trustline (`58ce984ef813f63890e89088ea4f560928b557e2cc22de845171ec9506fd4c0d`) y 100 `INMUEBLE` recibidos de la distribuidora (`4390f0810c3f51a37fa8c663f9920caa106bbeb7377ea9c77730d287343beedf`).
- **Getting Started:** `hello_world` e `increment` desplegados en testnet; ver [`Docs/Ruta JaveBlockchain/gettingStarted.md`](<Docs/Ruta JaveBlockchain/gettingStarted.md>).

## Enlaces

- Sitio de la Ruta: https://javeblockchain.pages.dev
- Guía de la sesión 3: https://github.com/Javeriana-Blockchain/ruta-2026-II/blob/main/GUIA_S3.md
