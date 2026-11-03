#!/usr/bin/env bash
# Llamado por cron. Uso: cto-tick automatizaciones|cola   (lee solo las claves que necesita; NO ejecuta el archivo de configuración)
set -euo pipefail
val() { grep -m1 "^$1=" /etc/cto/env | cut -d= -f2-; }
CRON_SECRET="$(val CRON_SECRET)"; PORT="$(val PORT)"
case "${1:-}" in automatizaciones) P=/api/cron/tick;; cola) P=/api/jobs/tick;; *) echo "uso: $0 automatizaciones|cola"; exit 1;; esac
curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}$P" >/dev/null
