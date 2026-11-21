#!/bin/sh
# Start a throw-away server on a free port, run the front-end smoke test against it, and stop it again.
set -eu
KC="${KINGCOBRA:-kingcobra}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$TMP"' EXIT INT TERM
cp "$ROOT"/models/snake_ddqn.* "$TMP"/
KC_PORT_FILE="$TMP/port" "$KC" run "$ROOT/src/main.kc" serve --out "$TMP" --port 0 \
  --set server.allow_shutdown=true --set server.log=false >"$TMP/server.log" 2>&1 &
PID=$!
i=0; while [ ! -s "$TMP/port" ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i+1)); done
[ -s "$TMP/port" ] || { echo "server did not start"; cat "$TMP/server.log"; exit 1; }
node "$ROOT/tests/web/smoke.test.js" "http://127.0.0.1:$(cat "$TMP/port")"
