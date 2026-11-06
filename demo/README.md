# Kit de demo

Dos scripts y la app preparada para mostrar **todo el ciclo** en vivo: invertir, completar la ronda, liberar los fondos y recuperar el dinero cuando una ronda falla.

La duración de una ronda se fija **cuando se crea**. Por eso la ronda del reembolso se crea unos minutos antes de presentar, con un plazo corto.

## Modo demostración dentro de la app (sin terminal)

La app trae una pestaña **Demo** que hace lo mismo que los scripts, con botones:

| Botón | Equivale a |
|---|---|
| Crear ronda (fracciones, precio y plazo) | `ronda.sh` |
| Comprar lo que falta | `completar.sh --sin-liberar` |
| Liberar fondos a la constructora | `completar.sh` |
| Repartir ganancias | `repartir.sh --enviar` |

En «Crear una ronda nueva» eliges **uno de los seis proyectos** del catálogo: se rellenan las fracciones y el precio, y el plazo por defecto es la fecha límite del catálogo. Cada ronda nueva se abre sola en la app, con el nombre del proyecto elegido. **El reembolso se sigue haciendo con tu Freighter** en «Seguimiento» (crea la ronda con plazo de 6 minutos o menos, invierte y espera a que venza).

Los botones «Comprar lo que falta», «Liberar fondos» y «Repartir ganancias» **piden confirmación** antes de firmar con las cuentas de prueba, porque no se pueden deshacer. Si la ronda activa es la ronda por defecto, el aviso lo advierte de forma explícita: crea una ronda nueva para jugar sin riesgo.

> **Importante (solo testnet):** para que los botones puedan firmar como fiduciaria, emisor y comprador, hacen falta llaves de tres cuentas de prueba en [`app/src/demoKeys.js`](../app/src/demoKeys.js). **En esta copia pública el archivo va vacío**, así que los botones están desactivados hasta que pongas las tuyas (cuentas nuevas de testnet, nunca de dinero real). **Una app real nunca lleva llaves secretas en el código**: cada rol firmaría con su propia wallet. Es un atajo para la demo.

## Antes de la demo (la víspera, y 15 minutos antes)

- [ ] Brave con **Freighter en TEST NET** y XLM suficientes (a la cuenta le sirve Friendbot).
- [ ] Una terminal **Git Bash** en la carpeta del repo, donde `stellar --version` funcione.
- [ ] La app corriendo: `cd app && npm install && npm run dev` (anota el puerto que muestra).
- [ ] **Ensayar el ciclo completo una vez.**

## Los scripts

| Script | Qué hace |
|---|---|
| `demo/ronda.sh` | Crea una ronda **nueva** en testnet (activo, contrato y configuración) y imprime el enlace para abrirla en la app |
| `demo/completar.sh` | Compra con una cuenta de prueba las fracciones que faltan y la fiduciaria libera los fondos |
| `demo/repartir.sh` | La fiduciaria reparte ganancias (por ejemplo, «el arriendo del mes») entre quienes tienen fracciones, según su porcentaje, en una sola transacción |

Opciones de `ronda.sh`: `--fracciones` (por defecto 100), `--precio` en XLM (10), `--duracion` en segundos (604800 = 7 días) y `--app` con la dirección de tu app (por defecto `http://localhost:5173`).

Cada vez que corre crea un activo nuevo. La primera vez tarda unos 2 minutos porque baja el contrato compilado de GitHub; después, cerca de 1 minuto.

## Demo A · La ronda se completa (unos 2 minutos)

**Preparar, antes de presentar** (la ronda dura 7 días, sin prisa):

```bash
demo/ronda.sh --fracciones 20 --app http://localhost:5173
```

Abre el enlace que imprime. En la terminal anota el **alias** y el **código del activo** que aparecen.

**En vivo:**
1. **Conectar wallet.** Se ve el portafolio.
2. **«Invertir en el proyecto»** → 5 fracciones → **«1. Aceptar el activo»** (Freighter) → **«Invertir con Freighter»** (Freighter). El activo aparece en la wallet.
3. **Seguimiento:** sube la barra de avance.
4. En la terminal: `demo/completar.sh <alias> <codigo> --sin-liberar` → la app muestra **«Meta alcanzada»**.
5. Luego `demo/completar.sh <alias> <codigo>` → la fiduciaria libera: **«Completada»**.
6. **Ganancias:** `demo/repartir.sh <codigo> 100` muestra el plan (quién recibiría cuánto). Con `--enviar` la fiduciaria reparte de verdad; en **Mi portafolio** aparece **«Ganancias recibidas»**.

## Demo B · La ronda fracasa y se recupera el dinero (unos 3 minutos)

**Preparar 6 minutos antes de presentar:**

```bash
demo/ronda.sh --fracciones 10 --duracion 360 --app http://localhost:5173
```

El plazo cuenta desde que el script termina. Abre el enlace que imprime y deja la pestaña lista.

**En vivo:**
1. **Conectar wallet** → **Invertir** 2 fracciones (aceptar el activo + invertir).
2. Mientras pasa el plazo, explica la regla: «si no se llega a la meta, cada inversionista recupera lo suyo».
3. Cuando vence el plazo, en **Seguimiento** aparece **«No se completó»** con los pasos en rojo.
4. Pulsa **«Recuperar mi dinero»** → Freighter → tu saldo vuelve y el activo queda en 0.

> Calcula el tiempo: crear la ronda toma cerca de 1 minuto, y aceptar el activo e invertir otro minuto. Con 360 segundos de plazo sobra margen para hablar antes de que venza.

## Cómo funciona el reparto de ganancias

`demo/repartir.sh <codigo> <monto-en-XLM>` mira en la red **quién tiene fracciones en ese momento**, calcula la parte de cada uno (su porcentaje del total) y, con `--enviar`, la fiduciaria manda todos los pagos juntos en **una sola transacción**. Así nadie puede cobrar dos veces pasando sus fracciones a otra cuenta.

- Sin `--enviar` solo muestra el plan, sin mandar nada. Úsalo antes para revisar.
- Se puede repetir (por ejemplo, un reparto por mes): la app suma todos los repartos de esa ronda.
- **Límites del prototipo:** el reparto lo hace la fiduciaria **fuera del contrato** (hay que confiar en ella), solo le paga a cuentas de Stellar normales y cabe hasta unas 100 personas por transacción. El reparto automático dentro del contrato queda para la siguiente etapa.

## Si algo falla

- **Freighter no se abre:** revisa que esté en TEST NET y desbloqueada; recarga la página.
- **La app no muestra la ronda nueva:** abre el enlace de nuevo, o recarga. Se puede volver a la ronda por defecto con el enlace «usar la ronda por defecto» del pie de la página.
- **Un script falla:** vuelve a correrlo. Crea un activo nuevo cada vez, así que no estorba lo que quedó de antes.
- **Plan B:** ten a mano capturas o una grabación de pantalla del ciclo completo, hecha en el ensayo.

## Referencia

- La app acepta cualquier ronda con un enlace: `#invertir?contrato=C…&activo=CODIGO` (y recuerda la elección en el navegador).
- Cuentas de prueba usadas por los scripts: `emisor-alameda` (emite el activo), `fiduciaria-machea` (libera), `comprador-prueba` (completa la ronda) y la constructora `GA2QOK3V…`. Son alias de `stellar-cli` guardados en este computador.
- Diseño del contrato: [`Docs/DISENO_FONDEO.md`](../Docs/DISENO_FONDEO.md).
