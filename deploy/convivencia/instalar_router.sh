#!/usr/bin/env bash
# Instala en el VPS SOLO el paquete mínimo del router de IA (rama claude/router-ia-minimo) con respaldo, simulacro y reversión automática.
#   sudo bash instalar_router.sh                        → SIMULACRO: verifica y muestra TODO lo que cambiaría. No cambia nada.
#   sudo bash instalar_router.sh --verificar            → solo comprobaciones de solo lectura
#   sudo bash instalar_router.sh --aplicar --commit SHA → instala EXACTAMENTE ese commit. Pide escribir SI antes de cada paso que cambia el servidor.
#   sudo bash instalar_router.sh --revertir             → vuelve a la versión anterior guardada (intercambio de carpetas: NO recompila)
#
# DISEÑO (v2, tras el incidente de la primera instalación):
#  · La compilación NUNCA ocurre en la carpeta que sirve la web. Se hace en un RELEASE aparte ($BASE/releases/…), creado con «git archive» del commit revisado:
#    solo archivos del repositorio (sin .data, sin secretos, sin carpetas de root). Si la compilación falla, la versión en marcha no se toca.
#  · Compilación con Turbopack y, si falla, reintento automático con webpack (--webpack).
#  · Activación = intercambio de carpetas por renombrado (.next y, solo si cambia package-lock, node_modules). La anterior queda guardada como .next.prev.<fecha>.
#  · La reversión RESTAURA esas carpetas (no recompila). Nunca se reinicia el servicio si no existe .next/BUILD_ID. Recompilar la versión anterior es el ÚLTIMO recurso y también ocurre en un release aparte.
#  · No se borra, mueve, ni cambia permisos de .data ni de ningún dato. No escribe en /etc/crea-oficina/env, no llama a OpenRouter, no toca OpenClaw, Stripe, Resend ni bases de datos.
# Códigos de salida: 0 instalado · 1 falló pero la versión anterior quedó funcionando · 2 NO se pudo garantizar una versión compilada: el servicio NO se reinició (ver mensaje).
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /
[ -f "$AQUI/lib.sh" ] || AQUI="${CREA_APP_DIR:-/opt/crea-oficina/app}/deploy/convivencia"; [ -f "$AQUI/lib.sh" ] || { echo "No encuentro lib.sh (¿está instalada la aplicación?)"; exit 1; }
. "$AQUI/lib.sh"
APP_DIR="${CREA_APP_DIR:-$APP_DIR}"; ENV_FILE="${CREA_ENV_FILE:-$ENV_FILE}"; STATE="${CREA_STATE:-$STATE}"; REL_DIR="${CREA_RELEASES:-$BASE/releases}"; BACKUPS="${CREA_BACKUPS:-$BACKUPS}"
RAMA="claude/router-ia-minimo"; COMMIT=""; MODO=simulacro
while [ $# -gt 0 ]; do case "$1" in --aplicar) MODO=aplicar; DRY=0;; --verificar) MODO=verificar;; --revertir) MODO=revertir; DRY=0;; --rama) RAMA="$2"; shift;; --commit) COMMIT="$2"; shift;; *) die "Opción desconocida: $1";; esac; shift; done
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0 [--verificar|--aplicar --commit SHA|--revertir]"
[ -d "$APP_DIR/.git" ] || die "No encuentro la instalación en $APP_DIR."; [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE."
as_app() { if [ -n "${CREA_SIN_USUARIO:-}" ]; then env "$@"; else runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" "$@"; fi; }
g() { as_app git -C "$APP_DIR" "$@"; }
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }; def() { [ -n "$(val "$1")" ] && echo "definida" || echo "NO definida"; }
crit() { if [ "$MODO" = aplicar ]; then die "$*"; else warn "$* (en --aplicar esto detendría la instalación)"; fi; }
PERMITIDOS='^(src/server/ai/|src/server/models/index\.ts$|src/server/tasks/index\.ts$|src/server/db/(schema\.sql|index\.ts)$|src/app/admin/(ia/page\.tsx|layout\.tsx)$|src/app/admin_actions\.ts$|scripts/ia/(catalogo_openrouter|preparado|prueba_humo)\.ts$|scripts/e2e/(compra_directa\.cjs|ia_panel\.(sh|cjs)|seed_ia_panel\.ts)$|deploy/convivencia/(configurar_openrouter|instalar_router)\.sh$|tests/|docs/(ia-router|integracion|incidentes)/|package\.json$|\.env\.example$)'
TABLAS="ai_models ai_settings ai_plan_limits ai_accounts ai_reservations ai_calls ai_alerts"
TS="$(date +%Y%m%d-%H%M%S)"; REL=""; PNEXT=""; PNM=""; ACTIVADO=0

salud() { for i in $(seq 1 "${1:-30}"); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0; sleep "${CREA_ESPERA:-1}"; done; return 1; }
# ¿Hay una versión compilada completa lista para arrancar? (sin esto NO se reinicia el servicio)
listo_para_arrancar() { [ -s "$APP_DIR/.next/BUILD_ID" ] && [ -d "$APP_DIR/.next/server" ]; }
# Reinicia SOLO crea-oficina, y solo si hay BUILD_ID. Devuelve 0 si responde; 2 si ni siquiera se intentó por no haber compilado.
reiniciar_y_verificar() {
  listo_para_arrancar || { bad "No existe .next/BUILD_ID (o .next/server): NO se reinicia el servicio."; return 2; }
  systemctl restart crea-oficina || return 1; salud "${1:-40}"
}
limpiar_release() { local d="$1"; [ -n "$d" ] && case "$d" in "$REL_DIR"/*) [ -d "$d" ] && rm -rf -- "$d";; esac; return 0; }
# Compila DENTRO de un release (nunca en la carpeta en marcha). Turbopack primero; si falla, webpack.
build_en() {
  local dir="$1" inst="${CREA_INSTALL_CMD:-npm ci --include=dev --no-audit --no-fund}" b1="${CREA_BUILD_CMD:-npm run build}" b2="${CREA_BUILD_CMD_WEBPACK:-npm run build -- --webpack}"
  local cmd="$inst && { ( $b1 ) || { echo '[Turbopack falló: reintento con webpack]'; rm -rf .next; ( $b2 ); }; }"
  systemd-run --wait --pipe --collect -p User="$APP_USER" -p WorkingDirectory="$dir" -p EnvironmentFile="$ENV_FILE" -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=100% -p CPUWeight=20 -p Nice=10 -E HOME="$HOME_DIR" -E PATH="$NODE_DIR/bin:/usr/bin:/bin" -E NODE_OPTIONS=--max-old-space-size=2048 /usr/bin/bash -c "$cmd" || return 1
  [ -s "$dir/.next/BUILD_ID" ]
}
# Crea un release con SOLO los archivos del commit (git archive): sin .data, sin .env, sin nada de root.
crear_release() {
  local sha="$1"; REL="$REL_DIR/${2}-${sha:0:7}-$TS"; as_app mkdir -p "$REL_DIR" && as_app mkdir -m 700 "$REL" || return 1
  g archive "$sha" | as_app tar -x -C "$REL" || { limpiar_release "$REL"; return 1; }
  [ -e "$REL/.data" ] && { limpiar_release "$REL"; die "El release contiene .data: no debería. Se aborta."; }; return 0
}
guardar_estado() { printf '%s\n' "$PREV" "$RPREV" "$PNEXT" "$PNM" "$TS" > "$STATE/router_anterior.txt"; }
# Intercambio atómico por renombrado dentro de la misma carpeta (mismo sistema de archivos).
activar_artefactos() {   # $1 = release con .next ya compilado ; $2 = 1 si hay que cambiar también node_modules
  PNEXT=".next.prev.$TS"; [ "$2" = 1 ] && PNM="node_modules.prev.$TS" || PNM=""; guardar_estado
  mv "$APP_DIR/.next" "$APP_DIR/$PNEXT" && mv "$1/.next" "$APP_DIR/.next" || return 1
  if [ -n "$PNM" ]; then mv "$APP_DIR/node_modules" "$APP_DIR/$PNM" && mv "$1/node_modules" "$APP_DIR/node_modules" || return 1; fi
}
restaurar_artefactos() {
  local fallo=0
  if [ -n "${PNEXT:-}" ] && [ -d "$APP_DIR/$PNEXT" ]; then [ -e "$APP_DIR/.next" ] && mv "$APP_DIR/.next" "$APP_DIR/.next.failed.$TS"; mv "$APP_DIR/$PNEXT" "$APP_DIR/.next" || fallo=1; fi
  if [ -n "${PNM:-}" ] && [ -d "$APP_DIR/$PNM" ]; then [ -e "$APP_DIR/node_modules" ] && mv "$APP_DIR/node_modules" "$APP_DIR/node_modules.failed.$TS"; mv "$APP_DIR/$PNM" "$APP_DIR/node_modules" || fallo=1; fi
  return $fallo
}
volver_codigo() { g checkout -q "$RPREV" 2>/dev/null; [ "$(g rev-parse HEAD)" = "$PREV" ] || g reset -q --hard "$PREV"; [ "$(g rev-parse HEAD)" = "$PREV" ]; }
# ÚLTIMO recurso: recompilar la versión anterior, también en un release aparte, y solo entonces cambiar las carpetas.
ultimo_recurso() {
  warn "Las carpetas guardadas no sirven. Último recurso: recompilar ${PREV:0:7} en un release aparte (sin tocar .data)."
  limpiar_release "$REL"; crear_release "$PREV" "recuperacion" || return 1
  build_en "$REL" || { bad "La recompilación de la versión anterior también falló."; limpiar_release "$REL"; return 1; }
  [ -e "$APP_DIR/.next" ] && mv "$APP_DIR/.next" "$APP_DIR/.next.failed.$TS"; mv "$REL/.next" "$APP_DIR/.next" || return 1; limpiar_release "$REL"; listo_para_arrancar
}
# Vuelve a la versión anterior y la deja funcionando. NUNCA reinicia sin BUILD_ID.
volver() {
  warn "Volviendo a la versión anterior ${PREV:0:7}…"
  volver_codigo || bad "No pude volver a la rama $RPREV (revisa git status)."
  restaurar_artefactos; listo_para_arrancar || ultimo_recurso || true
  if ! listo_para_arrancar; then
    bad "NO hay una versión compilada: el servicio NO se reinició (si estaba corriendo, sigue con lo que tenía en memoria)."
    echo "   Recuperación manual (como root): cd $APP_DIR && sudo -u $APP_USER env PATH=$NODE_DIR/bin:\$PATH npm run build -- --webpack && sudo systemctl restart crea-oficina"; limpiar_release "$REL"; exit 2
  fi
  reiniciar_y_verificar 40 && ok "Versión anterior restaurada y funcionando." || { bad "Aun así no responde: journalctl -u crea-oficina -n 50"; limpiar_release "$REL"; exit 2; }
  bash "$AQUI/openclaw_check.sh" --comparar "$OC" >/dev/null 2>&1 || warn "Revisa OpenClaw."; limpiar_release "$REL"; exit 1
}
OC="$STATE/openclaw_antes_router.txt"

if [ "$MODO" = revertir ]; then
  [ -r "$STATE/router_anterior.txt" ] || die "No hay versión anterior guardada ($STATE/router_anterior.txt)."
  PREV="$(sed -n 1p "$STATE/router_anterior.txt")"; RPREV="$(sed -n 2p "$STATE/router_anterior.txt")"; PNEXT="$(sed -n 3p "$STATE/router_anterior.txt")"; PNM="$(sed -n 4p "$STATE/router_anterior.txt")"; TS="$(sed -n 5p "$STATE/router_anterior.txt")-rev"
  paso "Volver a la versión anterior ${PREV:0:7}" "intercambia las carpetas guardadas (no recompila), vuelve el código a esa versión y reinicia SOLO crea-oficina si existe BUILD_ID"
  volver_codigo || die "No pude volver el código."; restaurar_artefactos || die "No pude restaurar las carpetas guardadas ($PNEXT)."
  reiniciar_y_verificar 40; rc=$?; [ $rc = 0 ] && { ok "Versión anterior restaurada y respondiendo."; exit 0; }; [ $rc = 2 ] && exit 2; bad "No responde: journalctl -u crea-oficina -n 50"; exit 1
fi

titulo "1. Estado actual (solo lectura; no se muestran valores)"
[ -z "$(g status --porcelain)" ] && ok "El árbol de trabajo está limpio" || die "Hay cambios locales sin guardar en $APP_DIR (git status). No se instala nada."
PREV="$(g rev-parse HEAD)"; RPREV="$(g rev-parse --abbrev-ref HEAD)"; echo "   Versión instalada: ${PREV:0:7} (rama local: $RPREV)"
for k in OPENROUTER_API_KEY ANTHROPIC_API_KEY AI_ROUTER DATABASE_URL APP_SECRET; do echo "   $k: $(def $k)"; done
[ "$(val AI_ROUTER)" = "on" ] && die "AI_ROUTER está en «on». Este paquete exige que esté APAGADO. No se instala nada."; ok "AI_ROUTER no está encendido"
[ "$(val OPENROUTER_API_KEY)" = "" ] && warn "No hay OPENROUTER_API_KEY (no es necesaria para instalar; sí para la prueba de humo)."
titulo "1b. Protección de la versión que funciona"
listo_para_arrancar && ok "Hay una versión compilada en marcha (.next/BUILD_ID: $(head -c 12 "$APP_DIR/.next/BUILD_ID")…)" || crit "No hay .next/BUILD_ID: no hay una versión funcional que proteger."
salud 3 && ok "La aplicación responde ahora (/api/health)" || crit "La aplicación NO responde ahora: no se instala sobre un sistema caído."
if [ -e "$APP_DIR/.data" ]; then echo "   .data existe ($(stat -c '%U:%G %a' "$APP_DIR/.data")): NO se toca; la compilación se hace en un release aparte que no lo contiene."; fi
RP="$REL_DIR"; [ -d "$RP" ] || RP="$(dirname "$REL_DIR")"; DEV_A="$(stat -c %d "$APP_DIR" 2>/dev/null)"; DEV_R="$(stat -c %d "$RP" 2>/dev/null)"
[ -n "$DEV_A" ] && [ "$DEV_A" = "$DEV_R" ] && ok "Release y aplicación están en el mismo sistema de archivos (intercambio atómico)" || crit "$REL_DIR y $APP_DIR no están en el mismo sistema de archivos: no se puede intercambiar por renombrado."
LIBRE="$(df -Pk "$RP" 2>/dev/null | awk 'NR==2{print $4}')"; [ "${LIBRE:-0}" -ge "${CREA_MIN_KB:-2000000}" ] && ok "Espacio libre suficiente para compilar aparte ($((LIBRE/1024)) MB)" || crit "Poco espacio libre (${LIBRE:-?} KB); se necesitan ≥ ${CREA_MIN_KB:-2000000} KB."

titulo "2. Rama y commit"
g fetch -q origin "$RAMA" 2>/dev/null || die "No pude traer origin/$RAMA (¿está publicada y hay red hacia GitHub?)."; NEW="$(g rev-parse FETCH_HEAD)"; echo "   origin/$RAMA → $NEW"
if [ -n "$COMMIT" ]; then case "$NEW" in "$COMMIT"*) ok "El commit coincide con el que indicaste (${COMMIT})";; *) die "La rama apunta a ${NEW:0:12}, no a $COMMIT. No se instala (quizá cambió desde que la revisaste).";; esac
elif [ "$MODO" = aplicar ]; then die "Para --aplicar indica el commit revisado:  --commit ${NEW:0:12}"; fi
g merge-base --is-ancestor "$PREV" "$NEW" && ok "El paquete avanza limpio desde la versión instalada (fast-forward)" || die "El paquete NO desciende de la versión instalada ($PREV). No se instala."
echo "   Commits que se instalarían:"; g log --oneline "$PREV..$NEW" | sed 's/^/      /' | head -30
g fetch -q origin main 2>/dev/null; BASE_C="$(g merge-base origin/main "$NEW")"; DESDE_MAIN="$(g rev-list --count "$PREV..$BASE_C")"
[ "$DESDE_MAIN" -gt 0 ] && warn "Además del router, llegan $DESDE_MAIN commit(s) que ya están en main y tu VPS aún no tiene (se listan arriba)." || ok "Tu VPS ya tiene todo main: solo llega el router"
echo "   Archivos que añade el paquete respecto de main:"; g diff --name-status "$BASE_C" "$NEW" | sed 's/^/      /' | grep -vE "docs/|tests/" | head -40
FUERA="$(g diff --name-only "$BASE_C" "$NEW" | grep -vE "$PERMITIDOS" || true)"
[ -z "$FUERA" ] && ok "Todos los archivos del paquete están en la lista permitida (sin landing, afiliados ni Mi Plan de Libertad)" || { bad "El paquete trae archivos fuera de la lista permitida:"; echo "$FUERA" | sed 's/^/      /'; die "No se instala."; }
LOCK_CAMBIA=0; g diff --quiet "$PREV" "$NEW" -- package-lock.json && ok "Las dependencias (package-lock.json) no cambian: node_modules no se reemplaza" || { LOCK_CAMBIA=1; warn "package-lock.json cambia entre tu versión y el paquete: se instalarán dependencias nuevas EN EL RELEASE y se intercambiará node_modules (la anterior queda guardada)."; }
g diff --name-only "$PREV" "$NEW" | grep -qE "^src/app/(api/stripe|api/webhooks)|stripe|resend" && warn "El rango toca archivos de pagos/correo (viene de main); revisa la lista de commits."
[ "$MODO" = verificar ] && { echo; ok "Verificación terminada. No se cambió nada."; exit 0; }
if [ "$MODO" = simulacro ]; then titulo "SIMULACRO"; cat <<TXT
   Con --aplicar --commit ${NEW:0:12} haría, en este orden (cada paso que cambia algo pide escribir SI):
   1) Foto «antes» de OpenClaw, respaldo (systemctl start crea-respaldo.service) y copia del env en $BACKUPS (600).
   2) Crear un RELEASE aparte con «git archive» del commit en $REL_DIR (sin .data) y compilar ALLÍ (Turbopack; si falla, webpack). La web en marcha NO se toca.
      Si la compilación falla: se borra solo ese release y termina. Nada cambió.
   3) Activar por renombrado: .next → .next.prev.<fecha>; el .next nuevo ocupa su lugar$([ "$LOCK_CAMBIA" = 1 ] && echo " (y node_modules igual)"); git checkout -B router-instalado ${NEW:0:7} (la rama «$RPREV» queda en ${PREV:0:7}).
   4) Comprobar que existe .next/BUILD_ID y reiniciar SOLO crea-oficina (único reinicio); /api/health.
   5) Verificar AI_ROUTER apagado, las 7 tablas nuevas y OpenClaw igual.
   6) Si algo falla: restaurar .next.prev (sin recompilar), volver el código, comprobar BUILD_ID, reiniciar y verificar. Si no hubiera BUILD_ID, NO se reinicia y se indica la recuperación manual.
   NO se hace: encender AI_ROUTER, escribir en el env, llamar a OpenRouter, tocar .data, bases de datos, Stripe, Resend ni OpenClaw.
TXT
  exit 0; fi

# ---------------- APLICAR ----------------
install -d -m 700 "$BACKUPS" "$STATE"
paso "Respaldo y foto de OpenClaw" "guarda una foto de OpenClaw (solo lectura), lanza el respaldo de crea-oficina y copia el archivo env a $BACKUPS con permiso 600"
bash "$AQUI/openclaw_check.sh" --guardar "$OC" >/dev/null || warn "No pude guardar la foto de OpenClaw (revisa el puerto con OPENCLAW_PORT)."
systemctl start crea-respaldo.service && ok "Respaldo previo hecho" || die "El respaldo falló: no se instala."
EB="$BACKUPS/env.router.$(date +%Y%m%d-%H%M%S).bak"; cp -p "$ENV_FILE" "$EB" && chmod 600 "$EB" && ok "Copia del env (sin mostrarlo): $EB"
paso "Compilar en un release aparte" "crea $REL_DIR/… con los archivos del commit (sin .data), instala dependencias y compila allí. La aplicación en marcha NO se toca; si falla se borra solo ese release"
crear_release "$NEW" "router" || die "No pude crear el release (nada cambió)."; ok "Release creado: $REL"
build_en "$REL" || { bad "La compilación falló (Turbopack y webpack). La aplicación en marcha NO se tocó."; limpiar_release "$REL"; exit 1; }
ok "Compilación lista en el release (BUILD_ID $(head -c 12 "$REL/.next/BUILD_ID")…)"; [ "$LOCK_CAMBIA" = 1 ] && { [ -d "$REL/node_modules" ] || { bad "El release no trae node_modules."; limpiar_release "$REL"; exit 1; }; }
paso "Activar ${NEW:0:7}" "intercambia .next$([ "$LOCK_CAMBIA" = 1 ] && echo ' y node_modules') por renombrado (la anterior queda como .next.prev.$TS), cambia el código con git checkout -B router-instalado y REINICIA SOLO crea-oficina (único reinicio; unos segundos sin servicio)"
printf '%s\n' "$PREV" "$RPREV" "" "" "$TS" > "$STATE/router_anterior.txt"; ACTIVADO=1
if ! activar_artefactos "$REL" "$LOCK_CAMBIA"; then bad "No pude intercambiar las carpetas."; volver; fi
g checkout -q -B router-instalado "$NEW" || { bad "No pude cambiar el código."; volver; }; [ "$(g rev-parse HEAD)" = "$NEW" ] || volver
reiniciar_y_verificar 40; rc=$?; [ $rc = 0 ] || { bad "La aplicación no responde con la versión nueva."; volver; }; ok "La aplicación responde con ${NEW:0:7}"
[ "$(val AI_ROUTER)" = "on" ] && { bad "AI_ROUTER apareció encendido: se revierte."; volver; } || ok "AI_ROUTER sigue apagado"
FALTAN=""; for t in $TABLAS; do [ "$(runuser -u postgres -- psql -d "$DB_NAME" -Atc "select to_regclass('public.$t') is not null" 2>/dev/null)" = "t" ] || FALTAN="$FALTAN $t"; done
[ -z "$FALTAN" ] && ok "Existen las 7 tablas nuevas del router (vacías hasta que se use)" || { bad "Faltan tablas:$FALTAN"; volver; }
bash "$AQUI/openclaw_check.sh" --comparar "$OC" && ok "OpenClaw igual que antes" || warn "OpenClaw muestra cambios que NO provoca este paquete: revisa."
limpiar_release "$REL"; ok "Release temporal eliminado. Carpetas anteriores conservadas: $APP_DIR/$PNEXT${PNM:+ y $APP_DIR/$PNM} (bórralas cuando estés tranquilo)."
titulo "¿Está listo el router? (solo lectura; no llama a ningún modelo)"
as_app bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && npm run -s ia:preparado" || true
echo; ok "Instalado ${NEW:0:7} con el router APAGADO."; echo "Siguiente paso (NO automático): prueba de humo de UNA llamada con tope de US\$0.01 — docs/ia-router/INSTALAR_ROUTER_VPS.md, sección 5."
echo "Para volver atrás:  sudo bash $0 --revertir"
