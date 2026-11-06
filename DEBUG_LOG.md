# Debug log

Lo que se rompió, el mensaje exacto y cómo lo resolvimos.

## 2026-10-27 · `stellar.exe` bloqueado en Windows

- **Quién:** Santiago (Windows 11 Home 26H2)
- **Mensaje:** `Una directiva de Control de aplicaciones bloqueó este archivo` al correr `stellar --version` con la CLI instalada por winget.
- **Causa:** Smart App Control de Windows está en modo *enforce* y bloquea ejecutables sin firma o sin reputación.
- **Solución:** instalar la CLI desde el código fuente con `cargo install --locked stellar-cli` y desinstalar la versión de winget para que `stellar` apunte a `~/.cargo/bin/stellar.exe`.

## 2026-10-27 · `stellar contract build` bloqueado

- **Quién:** Santiago
- **Mensaje:** `could not execute process ...\build-script-build (never executed)` · `Una directiva de Control de aplicaciones bloqueó este archivo. (os error 4551)` en `soroban-env-common` y `stellar-xdr`.
- **Qué probamos:** reintentar y cambiar `CARGO_TARGET_DIR`; el bloqueo se mantiene por archivo.
- **Solución:** compilar el `.wasm` en GitHub Actions (Linux) con `stellar contract build` y desplegarlo desde el PC con `stellar contract deploy`. No desactivamos Smart App Control.

## 2026-10-27 a 2026-11-03 · Sin acceso a la organización

- **Mensaje:** `santiagodiazsabogal does not have the correct permissions to execute CloneTemplateRepository`.
- **Solución:** creamos el repo en la cuenta personal y lo transferimos a Javeriana-Blockchain cuando nos agregaron a la organización (3 de noviembre).

## 2026-11-03 · Taller en casa de la sesión 3

- No hubo errores en la app: conectar wallet, trustline a `INMUEBLE` y pago de 10 `INMUEBLE` funcionaron a la primera en Brave con Freighter en TEST NET.
- **Ojo:** el pago de 10 tiene que ir a una cuenta que ya tenga la trustline a `INMUEBLE`; si no, Horizon devuelve `op_no_trust`. Por eso le agregamos la trustline a `alice` antes de pagar.

## 2026-11-04 · El CI de la plantilla no compila con el SDK 28

- **Mensaje:** `soroban-sdk requires stellar-cli v25.2.0+ to build a contract` al correr `cargo build --target wasm32v1-none --release` en el CI.
- **Causa:** con el SDK 28 el contrato solo se compila con `stellar contract build`.
- **Solución:** el CI instala `stellar-cli` y compila con `stellar contract build`; además guarda el `.wasm` como archivo descargable.

## 2026-11-05 · Los errores del contrato llegaban sin mensaje

- **Síntoma:** al rechazar una operación, el cliente de JavaScript devolvía un error con el mensaje vacío, sin saber cuál fue.
- **Causa:** los errores del contrato no tenían descripción.
- **Solución:** documentar cada variante del enum de errores con `///` y redesplegar. Ahora la app muestra el mensaje en español.

## 2026-11-05 · Port 5173 is already in use

- **Mensaje:** `Error: Port 5173 is already in use` al levantar la app, aunque no se veía ningún proceso escuchando.
- **Solución:** levantar la app en otro puerto, por ejemplo `npm run dev -- --port 5180`. Para Freighter el puerto da igual.

## 2026-11-05 · El pago del reparto necesita una nota (memo)

- **Problema:** `stellar tx new payment` no permite poner un memo, y el reparto de ganancias lo necesita para que la app reconozca cada reparto.
- **Solución:** el reparto se hace con un script en Node (`app/scripts/repartir.mjs`), que arma una sola transacción con todos los pagos y la nota `REPARTO <codigo>`.

## 2026-11-05 · La app tardaba unos 17 segundos en conectar

- **Síntoma:** al conectar la wallet y al hacer transacciones, la app se demoraba mucho.
- **Causa:** medida con el código real: cada lectura del contrato (`resumen`, `config`) era una simulación de 5 a 10 segundos, y la app creaba un cliente nuevo (descargando de nuevo la interfaz del contrato) varias veces, todo en fila. El servidor de contratos de testnet además responde de forma irregular (de 0,3 a 4 segundos por llamada).
- **Solución:** `leerRonda` lee lo que el contrato tiene guardado en una sola llamada (0,55 s, mismos datos que el contrato); la interfaz del contrato se descarga una sola vez; las lecturas van en paralelo; la pantalla se actualiza sola cada 15 segundos; y la app avisa cuándo se firmó la transacción y falta la confirmación de la red.

## 2026-11-05 · Un botón de la pestaña Demo completó sin querer la ronda de pruebas

- **Síntoma:** la ronda por defecto (`ALAMEDA1`) apareció con la meta cumplida sin que nadie la hubiera comprado a mano.
- **Causa:** el botón «Comprar lo que falta» de la pestaña Demo actúa sobre la ronda activa, y esa era la ronda por defecto. En la red quedó una sola transacción: `comprador-prueba` invirtió las 79 fracciones restantes. El contrato no hizo nada raro: para marcar la meta hace falta que alguien firme y pague en `invertir`.
- **Lo que no se puede hacer:** reabrir o reiniciar esa ronda. Su contrato no tiene función para borrar lo vendido y lo que queda en la blockchain no se borra.
- **Solución:** (1) una ronda por defecto nueva, `ALAMEDA2`, con plazo de 14 días para cubrir el Demo Day; (2) los botones «Comprar lo que falta», «Liberar fondos» y «Repartir ganancias» ahora piden confirmación con un aviso antes de firmar, y en la ronda por defecto el aviso lo advierte de forma explícita.
- **En esta copia pública:** `app/src/demoKeys.js` va vacío (el equipo usa sus propias llaves de testnet en su repositorio de trabajo). Una app real nunca llevaría llaves secretas en el código.

## 2026-11-05 · El servidor de desarrollo servía un CSS viejo

- **Síntoma:** después de restaurar `styles.css` con `git checkout` y agregarle reglas, el navegador mostraba el diseño sin esas reglas, aunque el archivo y la descarga directa del CSS estaban bien.
- **Causa:** Vite no volvió a procesar el archivo porque el cambio de `git checkout` y la edición siguiente llegaron casi a la vez.
- **Solución:** `touch app/src/styles.css` fuerza que Vite lo vuelva a leer. En el navegador, recargar con Ctrl+F5.

## 2026-11-05 · El plazo de una ronda cae un minuto después de lo calculado

- **Síntoma:** al crear las rondas del catálogo, tres quedaron con plazo a las 12:00 a. m. del día siguiente en vez de las 11:59 p. m. de la fecha del catálogo.
- **Causa:** el plazo se fija dentro del contrato como «hora del bloque + duración» cuando corre `init`, y entre calcular la duración y ejecutar `init` pasan unos 40 a 70 segundos (crear el activo, subir y desplegar el contrato).
- **Solución:** al calcular la duración desde el catálogo se restan 150 segundos (`duracionHasta` en `app/src/proyectos.js`). Las tres rondas afectadas se recrearon con otro código de activo (`CEDROS2`, `URBAN852`, `HORIZONTE2`), porque el plazo de una ronda no se puede cambiar y un activo solo puede tener un contrato como administrador.

