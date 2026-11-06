# Diseño del contrato de fondeo · Equipo Machea

> Una página. Contrato de **inversión fraccionada con un activo de Stellar**: un proyecto abre una ronda de fondeo, cualquiera puede comprar fracciones, el dinero queda bloqueado en el contrato y solo se libera si se llega a la meta. Se revisa **antes** de escribir código.

## 1. El problema en una frase

Una persona con montos pequeños no puede invertir en un proyecto inmobiliario porque tiene que confiar su dinero a un tercero que lo administra sin que ella vea qué pasa; con el contrato, cualquiera compra fracciones del proyecto, el dinero queda bloqueado a la vista de todos, y solo se libera a la constructora si se completa la meta: si no, cada inversionista recupera lo suyo.

## 2. ¿Por qué un contrato y no una base de datos?

Las partes no se conocen ni confían entre sí:

- **Muchos inversionistas desconocidos** entre sí, cada uno con poco dinero.
- **La constructora**, que necesita los fondos solo si el proyecto se financia completo.
- **La fiduciaria**, que autoriza la liberación a la constructora.

En una base de datos, quien la administra puede cambiar cuánto puso cada uno o retener el dinero. Con el contrato: el dinero lo tiene el contrato; la regla «meta completa o devolución» la cumple el código y no una persona; y cualquiera ve cuántas fracciones hay y cuánto se ha recaudado en stellar.expert.

Límite que decimos en voz alta: el contrato no sabe si la constructora usa bien el dinero después de recibirlo. Eso es de la fiduciaria y de la obra, y queda como siguiente paso.

## 3. El token: un activo de Stellar

Cada **fracción** es **1,0000000 de un activo de Stellar** del proyecto (por ejemplo `ALAMEDA`), emitido por una cuenta emisora. Es el mismo tipo de activo que ya emitiste con `INMUEBLE` en la sesión 2. Decisión de diseño: la documentación de Stellar recomienda usar un activo de Stellar y el contrato SAC (el contrato que viene integrado en la red) siempre que sea posible, y reservar los «tokens de contrato» para cuando el activo no alcance. Aquí alcanza.

Qué significa en la práctica:
- **El propio contrato emite los tokens**: la cuenta emisora le entrega al contrato el rol de administrador del activo (`set_admin` del SAC), y así el contrato puede crear tokens cuando alguien invierte y destruirlos cuando alguien se reembolsa.
- **Freighter y stellar.expert lo muestran solos**, con su suministro y sus tenedores.
- **Pasarle fracciones a otra persona es un pago normal de Stellar.** No hace falta una función del contrato.
- **El inversionista necesita aceptar el activo antes (trustline)**, igual que con `INMUEBLE`. La app se lo pide con Freighter.
- **El token es el derecho**: quien tiene tokens es quien puede pedir el reembolso si la ronda falla. Así, si alguien le pasó sus fracciones a otra persona, el reembolso va para quien las tiene (como una cesión de derechos).

## 4. Estado: qué guarda y dónde

| Dato | Tipo (Rust) | Storage | Clave | Quién lo cambia | TTL: ¿por qué ese? |
|---|---|---|---|---|---|
| Configuración (fiduciaria, constructora, token de pago, activo de participación, precio por fracción, total de fracciones, fecha límite) | struct `Config` | instance | `Config` | solo en `init` | vive con el contrato |
| Estado de la ronda (`Recaudando`, `Exitosa`, `Liberada`) | enum `Estado` | instance | `Estado` | `invertir` (al venderse todo) y `liberar` | vive con el contrato |
| Fracciones vendidas y aún en circulación | u32 | instance | `Vendidas` | `invertir`, `reembolsar` | vive con el contrato |

**No hay tabla de saldos**: quién tiene cuántas fracciones lo dice el propio activo de Stellar, no nuestro contrato. Eso hace el contrato más pequeño y más difícil de equivocar.

**La ronda fallida no se guarda: se calcula.** Una ronda está *fallida* si sigue en `Recaudando` y ya pasó la fecha límite. Así nadie tiene que «declarar» el fracaso, y nadie puede impedir los reembolsos.

Dinero: el precio va en la unidad mínima del token de pago. Para XLM son stroops: 1 XLM = 10 000 000. Con 1 fracción = 10 000 000 unidades del activo, 5 fracciones son 50 000 000.

Ejemplo de la demo (números inventados): meta de 10 000 XLM = 1 000 fracciones de 10 XLM, plazo de 7 días. Quien compra 5 fracciones tiene el 0,5 %.

## 5. Preparación (antes del contrato)

1. Crear la cuenta emisora y el activo `ALAMEDA` (con stellar-cli).
2. Desplegar el contrato SAC de ese activo.
3. Desplegar el contrato de fondeo y entregarle el rol de administrador del activo (`set_admin`, firmado por la emisora).
4. Llamar `init`. El contrato se queda con el control de la emisión.

## 6. Funciones

| Función | Parámetros | Devuelve | Quién puede llamarla (`require_auth`) | Qué valida antes de escribir | Error tipado si falla |
|---|---|---|---|---|---|
| `init` | fiduciaria, constructora, token_pago, token_participacion: Address; precio_fraccion: i128; total_fracciones: u32; duracion: u64 | () | `fiduciaria.require_auth()` (solo una vez) | no inicializado; precio, total y duración > 0 | `AlreadyInitialized`, `ParametroInvalido` |
| `invertir` | inversionista: Address, fracciones: u32 | u32 (fracciones vendidas hasta ahora) | `inversionista.require_auth()` (**cualquiera**) | ronda en `Recaudando` y antes de la fecha límite; fracciones > 0; que queden tantas disponibles | `RondaCerrada`, `FraccionesInvalidas`, `NoHayFracciones` |
| `liberar` | — | () | `fiduciaria.require_auth()` | ronda `Exitosa` y no liberada | `RondaNoExitosa`, `YaLiberada` |
| `reembolsar` | tenedor: Address, fracciones: u32 | () | `tenedor.require_auth()` | ronda fallida; fracciones > 0; que el tenedor tenga esos tokens | `RondaNoFallida`, `FraccionesInvalidas`, `SaldoInsuficiente` |
| `resumen` | — | `Resumen` (estado, vendidas, total, precio, fecha límite, recaudado) | nadie (lectura) | — | `NoInicializado` |
| `config` | — | `Config` | nadie (lectura) | — | `NoInicializado` |

Reglas importantes:
- **Cualquiera puede invertir**: no hay lista de aprobados. La verificación de inversionistas queda como siguiente paso (con las opciones de autorización que ya trae Stellar para los activos).
- `invertir` pasa el dinero del inversionista al contrato **y le entrega los tokens en el mismo paso**. No deja comprar más fracciones de las que quedan; la que completa el total pone la ronda en `Exitosa`.
- `reembolsar` **destruye** los tokens que devuelve el tenedor y le paga `fracciones × precio`.
- El contrato no tiene `transfer`, `balance` ni `total_supply`: eso lo da el activo de Stellar.

Checklist por función:
- [ ] Toda función que **escribe** tiene un `require_auth()`.
- [ ] Toda entrada de usuario se valida **antes** de tocar storage o mover dinero.
- [ ] Ningún `panic!` ni `unwrap()` sobre datos de usuario: errores tipados con `#[contracterror]`.
- [ ] Las lecturas no cambian estado.
- [ ] El estado se actualiza **antes** de mover dinero o tokens.

## 7. Errores

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NoInicializado = 2,
    ParametroInvalido = 3,
    FraccionesInvalidas = 4,
    NoHayFracciones = 5,
    RondaCerrada = 6,
    RondaNoExitosa = 7,
    YaLiberada = 8,
    RondaNoFallida = 9,
    SaldoInsuficiente = 10,
}
```

Cada error lleva su descripción en español, para que la app la muestre.

## 8. Flujo principal (quién llama qué, en orden)

1. La emisora crea el activo `ALAMEDA`; la fiduciaria despliega el contrato y le entrega la administración del activo; luego llama `init(...)`: 1 000 fracciones de 10 XLM y 7 días de plazo.
2. Ana acepta el activo en su wallet (trustline) y llama `invertir(Ana, 5)`: Freighter le pide firmar, el contrato recibe 50 XLM y **le entrega 5 `ALAMEDA`**, que ya aparecen en su Freighter.
3. Otras personas invierten. La app muestra la barra de avance con `resumen()`.
4. **Si se venden las 1 000 fracciones:** la ronda pasa a `Exitosa`. La fiduciaria llama `liberar()` y los 10 000 XLM van a la constructora.
5. **Si pasan los 7 días sin completar la meta:** la ronda es fallida y cada tenedor llama `reembolsar` para devolver sus tokens y recuperar su dinero, sin pedir permiso.
6. En cualquier momento Ana puede mandarle fracciones a otra persona con un **pago normal de Stellar** (la otra persona debe haber aceptado el activo).

## 9. Pruebas que escribimos (antes del código)

| Prueba | Qué garantiza |
|---|---|
| `init_solo_una_vez` | segundo `init` → `AlreadyInitialized` |
| `init_con_valores_en_cero_falla` | `ParametroInvalido` |
| `invertir_bloquea_fondos_y_entrega_tokens` | el dinero sale del inversionista, entra al contrato, y recibe los tokens |
| `invertir_cero_falla` | `FraccionesInvalidas` |
| `invertir_mas_de_las_disponibles_falla` | `NoHayFracciones` |
| `invertir_sin_firma_falla` | sin la firma del inversionista → panic de auth |
| `invertir_despues_del_plazo_falla` | `RondaCerrada` |
| `la_ultima_fraccion_cierra_la_ronda` | al venderse todo, estado `Exitosa` |
| `invertir_con_la_ronda_exitosa_falla` | `RondaCerrada` |
| `cualquiera_puede_invertir` | una wallet cualquiera, sin autorización previa, compra fracciones |
| `liberar_envia_a_la_constructora` | la constructora recibe el total y el estado pasa a `Liberada` |
| `liberar_sin_firma_de_la_fiduciaria_falla` | sin su firma → panic de auth |
| `liberar_antes_de_la_meta_falla` | `RondaNoExitosa` |
| `liberar_dos_veces_falla` | `YaLiberada` |
| `reembolsar_tras_fallar_destruye_tokens_y_devuelve_dinero` | el tenedor recupera `fracciones × precio` y sus tokens desaparecen |
| `reembolsar_antes_del_plazo_falla` | `RondaNoFallida` |
| `reembolsar_con_la_ronda_exitosa_falla` | `RondaNoFallida` |
| `reembolsar_mas_tokens_de_los_que_tiene_falla` | `SaldoInsuficiente` |
| `reembolsa_quien_recibio_los_tokens_por_transferencia` | los tokens movidos a otra wallet llevan el derecho de reembolso |
| `los_tokens_se_pueden_transferir` | un pago normal del activo funciona entre dos wallets |
| `invertir_funciona_solo_con_la_firma_del_inversionista` | firmas reales: solo firma el inversionista y el contrato emite los tokens por su cuenta |
| `reembolsar_funciona_solo_con_la_firma_del_tenedor` | firmas reales: solo firma el tenedor y el contrato destruye los tokens por su cuenta |

## 10. ¿Todo sobre Stellar?

| Pieza | Dónde corre |
|---|---|
| El dinero de la inversión (XLM) | Red de Stellar |
| El token de participación (`ALAMEDA`) | Red de Stellar: activo clásico |
| Las reglas de la ronda | Contrato Soroban, en la red de Stellar |
| Quién tiene cuántas fracciones | El propio activo de Stellar |
| La firma de cada operación | Freighter, wallet de Stellar |
| La lectura de balances y del contrato | Horizon y RPC de Stellar |
| Lo que **no** está en la red | La página (React), el código en GitHub, el nombre y la foto del proyecto, y los pesos de ejemplo |

## 11. Qué NO hace la versión del Demo Day

- **El contrato no reparte ganancias** (arriendos o venta). En la demo la fiduciaria las reparte con un script (`demo/repartir.sh`), fuera del contrato; el reparto dentro del contrato se diseña como siguiente paso.
- **No verifica a los inversionistas**: cualquiera con una wallet puede invertir (decisión tomada para la demo).
- **No controla cómo la constructora usa el dinero** después de recibirlo, ni libera por hitos de obra.
- **No hay un mercado** para vender fracciones: se pueden pasar con un pago normal, pero el precio se acuerda aparte.
- **Una ronda por contrato**: un contrato por proyecto.
- **Pesos reales y lo legal** (tokens como valores, fiducia real): es un prototipo en testnet; se dice en voz alta.

## 12. Pantallas (una línea por pantalla, qué función llama cada botón)

| Pantalla | Qué ve el usuario | Botón → función |
|---|---|---|
| Mi portafolio | sus fracciones de `ALAMEDA` (balance del activo) y su participación (`fracciones ÷ total`) | — (lectura de la cuenta) |
| Invertir en un proyecto | meta, recaudado, plazo y precio por fracción | «Aceptar el activo» (trustline) y luego «Invertir con Freighter» → `invertir`; si falló la ronda, «Recuperar mi dinero» → `reembolsar` |
| Seguimiento del proyecto | pasos (inversión realizada → recaudando → meta alcanzada → fondos a la constructora) y barra de avance | — (`resumen`); la fiduciaria usa `liberar` |

## 13. Cómo se conecta con Machea, y el mapa de ruta

Según los datos de Machea, con el ingreso más bajo (1,5 SMMLV) ningún proyecto del catálogo se puede pagar: son compradores que hoy no se pueden convertir. La inversión fraccionada les da un camino para empezar con poco.

| Etapa | Qué incluye | Estado |
|---|---|---|
| **1. Fondeo con activo de Stellar** | Invertir, meta, reembolso, liberación, portafolio | Este diseño |
| **2. Reparto de ganancias** | El arriendo o la venta se reparte según las fracciones | Mapa de ruta |
| **3. Camino a la casa** | Convertir las fracciones en cuota inicial de un apartamento | Mapa de ruta |
| **4. Inversionistas verificados** | La fiduciaria aprueba cada wallet con las opciones de autorización de los activos de Stellar | Mapa de ruta |
| **5. Información pública del activo** | Publicar nombre, emisor y descripción con un archivo `stellar.toml` (SEP-1) | Mapa de ruta |

## 14. Probado en testnet

El contrato puede ser administrador de un activo de Stellar y emitir y destruir tokens (confirmado con las pruebas de firmas reales y en la red).

| Dato | Valor |
|---|---|
| Activo | `ALAMEDA` · emisora `GCTPRWM3E4JBXIQLFIZJP33HO23G6A6LS7JOPUSDAMRG734ZDEF7VGCU` |
| Contrato del activo (SAC) | `CABJSAZIF76KR6DZJKX74U5UFQAKMAZKXFBGDETRBAKDCYKHOAC2RYXW` |
| Contrato de fondeo, ronda A | `CCRXHBP5H6D2NK4BD7KFMY6W5PZA7ZOLGGUSGQCPU5I743IATTKXKWBD` |
| Contrato de fondeo, ronda B | `CB4DZDSZ7B2W5AN4OJUTVRJ7IJMJZMOQRGP5HXAZZESQIXM7EQFWOIUV` (activo `ALAMEDB`, plazo de 90 s) |
| Wasm (sha256, compilado por el CI) | `cad211687176cf75a7b3a00005882d2e60fbde5e4bd6967a6853b0d80b6890f6` |

Rondas de prueba de 5 fracciones de 10 XLM, con cuentas de prueba:

| Paso | Resultado | Hash |
|---|---|---|
| A · `init` | ronda configurada | `cfb887d27d026fb03e6d32fa2da08824527d1671b2a926f9a94e9f574956d1da` |
| A · `invertir` 2 fracciones | el comprador paga 20 XLM y **recibe `ALAMEDA 2.0000000` en su wallet** | `d43cbcbbbd5c3aae6b9dd7d1ce191e800f8b28a713475484d4a53a2f7558360c` |
| A · `liberar` antes de la meta | rechazado con `Error(Contract, #7)` | sin transacción |
| A · `invertir` 3 fracciones | se vende todo: estado `Exitosa` | `5c8dd202096288c4b27f2d301ea3817ac5c4e936811a0d8c3dca0cdcf908622a` |
| A · `liberar` | la constructora recibe 50 XLM; estado `Liberada` | `82893e4e4c493536502755744798ea79feaf17caa90e616bc3e72784d2bf6a7e` |
| B · `invertir` 2 fracciones | el comprador paga 20 XLM y recibe `ALAMEDB 2.0000000` | `6ba6ef20b7793819eabf7341591d88e271d1234f0e2b6e8c3cf79d3571f0f258` |
| B · `reembolsar` antes del plazo | rechazado con `Error(Contract, #9)` | sin transacción |
| B · `reembolsar` tras vencer el plazo | los tokens se destruyen (`ALAMEDB 0`) y el comprador recupera sus 20 XLM | `833489baef685af3e27862b19a55c87f1696f9d99afa10c4abd3755cb827730a` |
| B · `invertir` tras el fracaso | rechazado con `Error(Contract, #6)` | sin transacción |

Todavía sin probar: la app conectada al contrato de fondeo, y el reparto de ganancias (mapa de ruta).

---

Revisado en office hours el [fecha] por [mentor]. Cambios pedidos: [ ].
