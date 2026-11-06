#!/usr/bin/env bash
# Compra, con una cuenta de prueba, las fracciones que faltan (la ronda queda "Exitosa")
# y la fiduciaria libera los fondos a la constructora.
#
# Uso:  demo/completar.sh <alias-o-contrato> <codigo-del-activo> [--sin-liberar]
#   --sin-liberar  solo completa la ronda (para mostrar "Meta alcanzada"); vuelve a correr el
#                  script sin esa opción para liberar los fondos.
set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"

[ $# -ge 2 ] || { sed -n '2,7p' "$0"; exit 1; }
RONDA=$1; CODIGO=$2; LIBERAR=1
[ "${3:-}" = "--sin-liberar" ] && LIBERAR=0

COMPRADOR=comprador-prueba
FIDUCIARIA=fiduciaria-machea
EMISOR_G=$(stellar keys address emisor-alameda)
COMPRADOR_G=$(stellar keys address "$COMPRADOR")
silencio() { "$@" >/dev/null 2>&1 || { echo "✗ Falló: $*"; exit 1; }; }
leer() { stellar contract invoke --id "$RONDA" --source-account alice --network testnet -- resumen 2>&1 | grep -vE "Simulating|read-only"; }

RESUMEN=$(leer)
CAMPO() { echo "$RESUMEN" | python -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
ESTADO=$(CAMPO estado); FALTAN=$(( $(CAMPO total) - $(CAMPO vendidas) ))
echo "Estado actual: $ESTADO · faltan $FALTAN fracciones"

if [ "$ESTADO" = "Recaudando" ] && [ "$FALTAN" -gt 0 ]; then
  echo "Aceptando el activo con la cuenta de prueba…"
  stellar tx new change-trust --source-account "$COMPRADOR" --network testnet --line "$CODIGO:$EMISOR_G" >/dev/null 2>&1 || true
  echo "Comprando las $FALTAN fracciones que faltan…"
  silencio stellar contract invoke --id "$RONDA" --source-account "$COMPRADOR" --network testnet --send=yes -- invertir --inversionista "$COMPRADOR_G" --fracciones "$FALTAN"
  echo "✔ Ronda completa: Meta alcanzada."
fi

if [ "$LIBERAR" = 1 ]; then
  ESTADO=$(echo "$(leer)" | python -c "import sys,json; print(json.load(sys.stdin)['estado'])")
  if [ "$ESTADO" = "Exitosa" ]; then
    silencio stellar contract invoke --id "$RONDA" --source-account "$FIDUCIARIA" --network testnet --send=yes -- liberar
    echo "✔ La fiduciaria liberó los fondos a la constructora: Completada."
  else
    echo "La ronda está en estado $ESTADO: no hay nada que liberar."
  fi
fi
