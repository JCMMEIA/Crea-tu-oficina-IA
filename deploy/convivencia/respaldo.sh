#!/usr/bin/env bash
# Respaldo diario: volcado de PostgreSQL → comprimido → CIFRADO (AES-256) → carpeta local → copia externa si hay destino configurado.
# La clave de cifrado vive en /etc/crea-oficina/backup.key. SIN ESA CLAVE LOS RESPALDOS NO SE PUEDEN ABRIR: guarda una copia fuera del servidor (gestor de contraseñas).
set -euo pipefail
ENV_FILE="${CREA_ENV_FILE:-/etc/crea-oficina/env}"; KEY="${CREA_BACKUP_KEY:-/etc/crea-oficina/backup.key}"; DIR="${CREA_BACKUP_DIR:-/var/backups/crea-oficina}"; STATE="${CREA_STATE_DIR:-/var/lib/crea-oficina}"
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2-; }
DB="$(val DATABASE_URL)"; [ -n "$DB" ] || { echo "sin DATABASE_URL"; exit 1; }
mkdir -p "$DIR"; F="$DIR/crea-$(date +%Y%m%d-%H%M%S).sql.gz.enc"; umask 077
pg_dump "$DB" | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$KEY" > "$F"
[ -s "$F" ] || { rm -f "$F"; echo "respaldo vacío"; exit 1; }
# verificación inmediata: se puede descifrar y descomprimir
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$KEY" -in "$F" | gunzip -t || { echo "respaldo CORRUPTO"; exit 1; }
ls -1t "$DIR"/crea-*.sql.gz.enc | tail -n +15 | xargs -r rm -f   # solo borra SUS propios respaldos viejos (conserva 14)
mkdir -p "$STATE" 2>/dev/null && date -Is > "$STATE/ultimo_respaldo" 2>/dev/null || true
REMOTE="$(val BACKUP_RCLONE_REMOTE || true)"
if [ -n "${REMOTE:-}" ] && command -v rclone >/dev/null; then rclone copyto "$F" "$REMOTE/$(basename "$F")" && { date -Is > "$STATE/ultima_copia_externa" 2>/dev/null || true; echo "copia externa OK → $REMOTE"; }
else echo "AVISO: sin copia externa configurada (BACKUP_RCLONE_REMOTE). Descarga los respaldos desde tu computadora o activa una copia externa."; fi
echo "respaldo: $F"
