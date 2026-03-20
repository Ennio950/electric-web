#!/bin/sh
set -eu

OPENCLAW_HOME="${OPENCLAW_HOME:-/opt/host-openclaw}"
OPENCLAW_ENTRY="$OPENCLAW_HOME/openclaw.mjs"

if [ ! -f "$OPENCLAW_ENTRY" ]; then
  echo "No se encontro OpenClaw montado en $OPENCLAW_HOME" >&2
  exit 1
fi

exec node "$OPENCLAW_ENTRY" "$@"
