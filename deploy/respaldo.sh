#!/usr/bin/env bash
# Copia diaria de la base (se conservan 14). Importante: copia también fuera del servidor (snapshot del VPS o descarga periódica).
set -euo pipefail
DATABASE_URL="$(grep -m1 "^DATABASE_URL=" /etc/cto/env | cut -d= -f2-)"
D=/var/backups/cto; mkdir -p "$D"; F="$D/cto-$(date +%Y%m%d-%H%M).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$F"; chmod 600 "$F"
[ -s "$F" ] || { echo "respaldo vacío"; rm -f "$F"; exit 1; }
ls -1t "$D"/cto-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "respaldo: $F"
