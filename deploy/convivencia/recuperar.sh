#!/usr/bin/env bash
# Recuperación de un respaldo.
#   recuperar.sh --probar    ARCHIVO.enc    restaura en una base TEMPORAL, cuenta filas y la borra (no toca la base real)
#   recuperar.sh --restaurar ARCHIVO.enc    reemplaza la base real (detiene SOLO crea-oficina; guarda antes un respaldo de seguridad; pide escribir RESTAURAR)
set -euo pipefail
ENV_FILE="${CREA_ENV_FILE:-/etc/crea-oficina/env}"; KEY="${CREA_BACKUP_KEY:-/etc/crea-oficina/backup.key}"; DB_NAME="${CREA_DB_NAME:-crea_oficina}"; DB_ROLE="${CREA_DB_ROLE:-crea_oficina_app}"
ADMIN="${CREA_PSQL_ADMIN:-runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qAt}"; UNIT="${CREA_UNIT:-crea-oficina}"
MODO="${1:-}"; ARCH="${2:-}"; [ -r "$ARCH" ] || { echo "uso: $0 --probar|--restaurar ARCHIVO.sql.gz.enc"; exit 64; }
dec() { openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$KEY" -in "$ARCH" | gunzip; }
dec >/dev/null 2>&1 || { echo "No se puede abrir el respaldo (¿clave equivocada?)"; exit 1; }
cargar() { # base destino
  $ADMIN -c "CREATE DATABASE $1 OWNER $DB_ROLE" postgres
  dec | $ADMIN -f - "$1" >/dev/null 2>/var/tmp/restore_err.log || { echo "Error al restaurar (ver /var/tmp/restore_err.log)"; return 1; }
}
case "$MODO" in
  --probar) T="${DB_NAME}_prueba_$$"; trap '$ADMIN -c "DROP DATABASE IF EXISTS $T" postgres >/dev/null 2>&1 || true' EXIT
    cargar "$T"; echo "Restaurado en base temporal $T. Contenido:"
    $ADMIN -F'|' -c "select 'tablas', count(*) from information_schema.tables where table_schema='public' union all select 'agencias', count(*) from agencies union all select 'empresas', count(*) from companies union all select 'prospectos', count(*) from leads" "$T" | sed 's/^/   /'
    echo "✅ El respaldo se puede restaurar. (La base temporal se borra al terminar; la real no se tocó.)";;
  --restaurar) read -r -p "Esto REEMPLAZA la base real '$DB_NAME'. Escribe RESTAURAR para continuar: " a; [ "$a" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
    SEG="${CREA_BACKUP_DIR:-/var/backups/crea-oficina}/antes-de-restaurar-$(date +%Y%m%d-%H%M%S).sql.gz"; umask 077
    URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"; pg_dump "$URL" | gzip > "$SEG"; echo "Respaldo de seguridad de la base actual: $SEG"
    systemctl stop "$UNIT" 2>/dev/null || true   # solo NUESTRO servicio
    $ADMIN -c "DROP DATABASE IF EXISTS $DB_NAME" postgres; cargar "$DB_NAME"
    systemctl start "$UNIT" 2>/dev/null || true; sleep 4; curl -fsS "http://127.0.0.1:$(grep -m1 '^PORT=' "$ENV_FILE" | cut -d= -f2-)/api/health" && echo " ✅ restaurado y funcionando";;
  *) echo "uso: $0 --probar|--restaurar ARCHIVO"; exit 64;;
esac
