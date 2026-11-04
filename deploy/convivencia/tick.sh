#!/usr/bin/env bash
# Lo llaman los temporizadores systemd. Uso: tick.sh automatizaciones|cola. Lee solo las claves necesarias (no ejecuta el archivo).
set -euo pipefail; ENV_FILE="${CREA_ENV_FILE:-/etc/crea-oficina/env}"
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2-; }
S="$(val CRON_SECRET)"; P="$(val PORT)"
case "${1:-}" in automatizaciones) U=/api/cron/tick;; cola) U=/api/jobs/tick;; *) echo "uso: $0 automatizaciones|cola"; exit 64;; esac
curl -fsS -m 300 -X POST -H "Authorization: Bearer $S" "http://127.0.0.1:${P:-3100}$U" >/dev/null
