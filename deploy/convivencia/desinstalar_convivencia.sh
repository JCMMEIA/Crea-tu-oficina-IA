#!/usr/bin/env bash
# REVERSIÓN: quita SOLO lo que anotó el instalador en /var/lib/crea-oficina/manifest.txt. No toca OpenClaw ni nada ajeno.
#   Simulacro (predeterminado):  sudo bash desinstalar_convivencia.sh
#   Aplicar:                     sudo bash desinstalar_convivencia.sh --aplicar [--borrar-base] [--quitar-paquetes] [--quitar-certificado]
set -euo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; . "$AQUI/lib.sh"
BORRAR_BASE=0; QUITAR_PQ=0; QUITAR_CERT=0
for a in "$@"; do case "$a" in --aplicar) DRY=0;; --borrar-base) BORRAR_BASE=1;; --quitar-paquetes) QUITAR_PQ=1;; --quitar-certificado) QUITAR_CERT=1;; *) die "Opción desconocida $a";; esac; done
[ "$(id -u)" = 0 ] || die "Ejecútalo como root."; [ -r "$MANIFEST" ] || die "No hay manifiesto ($MANIFEST): no sé qué instaló este modo. No se borra nada."
[ "$DRY" = 1 ] && warn "SIMULACRO: no se borra nada."
titulo "Se va a quitar (según el manifiesto)"; sed 's/^/   /' "$MANIFEST"
[ "$DRY" = 0 ] && { read -r -p "Escribe QUITAR para continuar: " a; [ "$a" = "QUITAR" ] || die "Cancelado."; }
if [ "$DRY" = 0 ] && grep -q '^base_pg|' "$MANIFEST"; then
  F="$BACKUPS/ultimo-antes-de-desinstalar-$(date +%Y%m%d-%H%M%S).sql.gz"; URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
  [ -n "$URL" ] && pg_dump "$URL" | gzip > "$F" && ok "Respaldo final (sin cifrar, solo root): $F"; chmod 600 "$F" 2>/dev/null || true
fi
for u in crea-tick-automatizaciones.timer crea-tick-cola.timer crea-respaldo.timer crea-oficina.service; do run systemctl disable --now "$u" 2>/dev/null || true; done   # SOLO unidades propias
while IFS='|' read -r tipo valor; do case "$tipo" in
  unidad) run rm -f "$valor";; archivo) case "$valor" in */backup.key) echo "   (se CONSERVA $valor: sin ella los respaldos cifrados no se pueden abrir)";; "$ETC"*|/etc/nginx/*crea-oficina*|/etc/postgresql/*/conf.d/crea-oficina.conf) run rm -f "$valor";; esac;;
esac; done < "$MANIFEST"
run rmdir /etc/systemd/system/postgresql@16-main.service.d 2>/dev/null || true; run systemctl daemon-reload
[ -L /etc/nginx/sites-enabled/crea-oficina ] && run rm -f /etc/nginx/sites-enabled/crea-oficina
if [ "$DRY" = 0 ] && command -v nginx >/dev/null; then nginx -t && systemctl reload nginx; fi
[ "$QUITAR_CERT" = 1 ] && grep -q '^certificado|' "$MANIFEST" && while IFS='|' read -r t d; do [ "$t" = certificado ] && run certbot delete --cert-name "$d" -n; done < "$MANIFEST"
[ "$BORRAR_BASE" = 1 ] && { run runuser -u postgres -- psql -qAt -c "DROP DATABASE IF EXISTS $DB_NAME"; run runuser -u postgres -- psql -qAt -c "DROP ROLE IF EXISTS $DB_ROLE"; } || echo "   (La base $DB_NAME se CONSERVA; añade --borrar-base para borrarla. Hay respaldo final.)"
run rm -rf "$APP_DIR" "$NODE_DIR" "$HOME_DIR"; run rmdir "$BASE" 2>/dev/null || true
run userdel "$APP_USER" 2>/dev/null || true
[ "$QUITAR_PQ" = 1 ] && PQ="$(grep '^paquetes|' "$MANIFEST" | cut -d'|' -f2 | tr '\n' ' ')" && [ -n "$PQ" ] && warn "Quitando SOLO los paquetes que instaló este modo: $PQ" && run apt-get remove -y $PQ
echo; echo "Se conservan: respaldos en $BACKUPS y la clave $ETC/backup.key (necesaria para abrirlos)."
[ "$DRY" = 0 ] && "$AQUI/openclaw_check.sh" --comparar "$STATE/openclaw_antes.txt" || true
