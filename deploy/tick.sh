#!/usr/bin/env bash
# Llamado por cron. Uso: cto-tick automatizaciones|cola
set -euo pipefail; set -a; . /etc/cto/env; set +a
case "${1:-}" in automatizaciones) P=/api/cron/tick;; cola) P=/api/jobs/tick;; *) echo "uso: $0 automatizaciones|cola"; exit 1;; esac
curl -fsS -m 60 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}$P" >/dev/null
