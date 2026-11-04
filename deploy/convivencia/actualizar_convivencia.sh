#!/usr/bin/env bash
# Actualiza Crea tu Oficina IA a la última versión de GitHub (modo convivencia): respaldo → bajar código → compilar con tope de memoria → reiniciar SOLO crea-oficina → comprobar.
#   sudo bash actualizar_convivencia.sh            # simulacro (no cambia nada)
#   sudo bash actualizar_convivencia.sh --aplicar
# Si tras reiniciar la aplicación no responde, vuelve automáticamente a la versión anterior. No toca OpenClaw ni reinicia el servidor.
# Las migraciones de base de datos son «CREATE … IF NOT EXISTS»: se aplican solas al arrancar, y hay respaldo previo.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"; [ "${1:-}" = "--aplicar" ] && DRY=0
[ "$(id -u)" = 0 ] || die "Ejecútalo como root."; [ -d "$APP_DIR/.git" ] || die "No encuentro la instalación en $APP_DIR."
[ "$DRY" = 1 ] && warn "SIMULACRO: no se cambia nada. Añade --aplicar."
as_app() { runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" "$@"; }
build() { systemd-run --wait --pipe --collect -p User="$APP_USER" -p WorkingDirectory="$APP_DIR" -p EnvironmentFile="$ENV_FILE" -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=100% -p CPUWeight=20 -p Nice=10 -E HOME="$HOME_DIR" -E PATH="$NODE_DIR/bin:/usr/bin:/bin" -E NODE_OPTIONS=--max-old-space-size=2048 /usr/bin/bash -c "npm ci --include=dev --no-audit --no-fund && npm run build"; }
OC="$STATE/openclaw_antes_actualizacion.txt"; PREV="$(as_app git -C "$APP_DIR" rev-parse HEAD)"; as_app git -C "$APP_DIR" fetch -q origin main; NEW="$(as_app git -C "$APP_DIR" rev-parse origin/main)"
echo "Versión instalada: ${PREV:0:7} → disponible: ${NEW:0:7}"; [ "$PREV" = "$NEW" ] && { ok "Ya estás en la última versión."; exit 0; }
echo "Cambios:"; as_app git -C "$APP_DIR" log --oneline "$PREV..$NEW" | sed 's/^/   /' | head -20
[ "$DRY" = 1 ] && { echo "[SIMULACRO] respaldo → git pull --ff-only → build con tope → systemctl restart crea-oficina → /api/health → comparar OpenClaw (y revertir a ${PREV:0:7} si falla)"; exit 0; }
bash "$AQUI/openclaw_check.sh" --guardar "$OC" >/dev/null; systemctl start crea-respaldo.service && ok "Respaldo previo hecho" || die "El respaldo falló: no se actualiza."
as_app git -C "$APP_DIR" merge --ff-only "$NEW" >/dev/null || die "No se puede avanzar limpio (ff-only). No se cambió nada más."
volver() { warn "Volviendo a la versión anterior ${PREV:0:7}…"; as_app git -C "$APP_DIR" reset --hard "$PREV" >/dev/null; build >/dev/null 2>&1; systemctl restart crea-oficina; sleep 5; curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null && ok "Versión anterior restaurada y funcionando." || bad "Aun así no responde: journalctl -u crea-oficina -n 50"; exit 1; }
build || { bad "La compilación falló (OpenClaw no se afectó)."; volver; }
systemctl restart crea-oficina; for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && ok "La aplicación responde con la versión nueva (${NEW:0:7})" || { bad "No responde con la versión nueva."; volver; }
bash "$AQUI/openclaw_check.sh" --comparar "$OC" || warn "OpenClaw muestra cambios: revisa."
