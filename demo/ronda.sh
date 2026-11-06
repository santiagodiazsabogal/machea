#!/usr/bin/env bash
# Crea una ronda de fondeo NUEVA en testnet y imprime el enlace para abrirla en la app.
#
# Uso:  demo/ronda.sh [--fracciones 100] [--precio 10] [--duracion 604800] [--app http://localhost:5173]
#   --fracciones  cuántas fracciones tiene la ronda            (por defecto 100)
#   --precio      precio de cada fracción, en XLM              (por defecto 10)
#   --duracion    segundos hasta que se acaba el plazo         (por defecto 604800 = 7 días)
#   --app         dirección de la app en tu computador         (por defecto http://localhost:5173)
#
# Demo del REEMBOLSO (la ronda no llega a la meta):  demo/ronda.sh --fracciones 10 --duracion 240
# Demo del ÉXITO (la ronda se completa):             demo/ronda.sh --fracciones 20
set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"

FRACCIONES=100; PRECIO=10; DURACION=604800; APP="http://localhost:5173"
while [ $# -gt 0 ]; do
  case "$1" in
    --fracciones) FRACCIONES=$2; shift 2 ;;
    --precio) PRECIO=$2; shift 2 ;;
    --duracion) DURACION=$2; shift 2 ;;
    --app) APP=$2; shift 2 ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

# Cuentas de prueba del equipo (las guarda stellar-cli en este computador).
EMISOR=emisor-alameda
FIDUCIARIA=fiduciaria-machea
CONSTRUCTORA=GA2QOK3VLE2EHD4JOSO2D423YOTZWQMMPQGMI5JCEAHCEJM7JK2OBXDW
XLM=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC   # contrato del XLM de testnet

silencio() { "$@" >/dev/null 2>&1 || { echo "✗ Falló: $*"; exit 1; }; }

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
WASM="${WASM:-$RAIZ/target/wasm32v1-none/release/fondeo.wasm}"
if [ ! -f "$WASM" ]; then
  echo "Bajando el contrato compilado por GitHub…"
  ID=$(gh run list --branch main --workflow CI --status success --limit 1 --json databaseId -q '.[0].databaseId')
  mkdir -p "$(dirname "$WASM")"
  silencio gh run download "$ID" -n wasm -D "$(dirname "$WASM")"
fi

EMISOR_G=$(stellar keys address "$EMISOR")
FIDUCIARIA_G=$(stellar keys address "$FIDUCIARIA")
CODIGO="DEMO$(date +%d%H%M%S)"          # un activo nuevo por ronda: máximo 12 caracteres
ALIAS="ronda-$(echo "$CODIGO" | tr 'A-Z' 'a-z')"

echo "1/4 Creando el activo $CODIGO…"
SAC=$(stellar contract asset deploy --asset "$CODIGO:$EMISOR_G" --source-account "$EMISOR" --network testnet 2>&1 | grep -oE "C[A-Z0-9]{55}" | head -1)
[ -n "$SAC" ] || { echo "✗ No se pudo crear el activo"; exit 1; }

echo "2/4 Desplegando el contrato…"
silencio stellar contract deploy --wasm "$WASM" --source-account "$FIDUCIARIA" --network testnet --alias "$ALIAS"
CONTRATO=$(stellar contract alias show "$ALIAS" 2>&1 | grep -oE "C[A-Z0-9]{55}" | head -1)

echo "3/4 Entregándole al contrato el control del activo…"
silencio stellar contract invoke --id "$SAC" --source-account "$EMISOR" --network testnet --send=yes -- set_admin --new_admin "$CONTRATO"

echo "4/4 Configurando la ronda ($FRACCIONES fracciones de $PRECIO XLM)…"
silencio stellar contract invoke --id "$CONTRATO" --source-account "$FIDUCIARIA" --network testnet --send=yes -- init \
  --fiduciaria "$FIDUCIARIA_G" --constructora "$CONSTRUCTORA" --token_pago "$XLM" --token_participacion "$SAC" \
  --precio_fraccion "$((PRECIO * 10000000))" --total_fracciones "$FRACCIONES" --duracion "$DURACION"

LIMITE=$(date -d "+${DURACION} seconds" "+%d/%m a las %H:%M:%S" 2>/dev/null || echo "dentro de $DURACION s")
echo
echo "✔ Ronda lista: $FRACCIONES fracciones de $PRECIO XLM del activo $CODIGO."
echo "  El plazo termina el $LIMITE (en $DURACION segundos)."
echo "  Contrato: $CONTRATO   (alias: $ALIAS)"
echo
echo "Ábrela en la app (Brave):"
echo "  $APP/#invertir?contrato=$CONTRATO&activo=$CODIGO&emisor=$EMISOR_G"
echo
echo "Para completarla y liberar los fondos:  demo/completar.sh $ALIAS $CODIGO"
