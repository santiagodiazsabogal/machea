#!/usr/bin/env bash
# La fiduciaria reparte ganancias (por ejemplo, "el arriendo del mes") entre quienes tienen fracciones
# de una ronda, según su porcentaje. Todos reciben su parte en UNA sola transacción.
#
# Uso:  demo/repartir.sh <codigo-del-activo> <monto-en-XLM> [--enviar]
#   Sin --enviar solo muestra el plan (quién recibiría cuánto), sin mandar nada.
#   Se puede correr varias veces (por ejemplo, un reparto por mes).
set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"
[ $# -ge 2 ] || { sed -n '2,8p' "$0"; exit 1; }

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
FIDUCIARIA_G=$(stellar keys address fiduciaria-machea)
EMISOR_G=$(stellar keys address emisor-alameda)
export STELLAR_SECRET="$(stellar keys show fiduciaria-machea)"   # la llave no se imprime
cd "$RAIZ/app" && node scripts/repartir.mjs "$@" --fiduciaria "$FIDUCIARIA_G" --emisor "$EMISOR_G"
