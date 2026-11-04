#!/usr/bin/env bash
# Instala en el VPS SOLO el paquete mínimo del router de IA (rama claude/router-ia-minimo) con respaldo, simulacro y reversión automática.
#   sudo bash instalar_router.sh                        → SIMULACRO: verifica y muestra TODO lo que cambiaría. No cambia nada.
#   sudo bash instalar_router.sh --verificar            → solo las comprobaciones de solo lectura (git, archivos permitidos, claves sí/no)
#   sudo bash instalar_router.sh --aplicar --commit SHA → instala EXACTAMENTE ese commit (el que revisaste). Pide escribir SI antes de cada paso que cambia el servidor.
#   sudo bash instalar_router.sh --revertir             → vuelve a la versión anterior guardada y la reconstruye
# QUÉ HACE: respaldo (base de datos + código + env) → fetch de UNA rama → comprueba que solo trae archivos del router → compila con tope de memoria → reinicia SOLO crea-oficina
#           → /api/health → verifica que el router siga APAGADO y que existan las tablas nuevas → compara OpenClaw. Si algo falla vuelve solo a la versión anterior.
# QUÉ NO HACE: no enciende AI_ROUTER (si está «on» se niega), no escribe en /etc/crea-oficina/env, no hace llamadas a OpenRouter, no toca OpenClaw, Stripe, Resend ni datos de clientes, no fusiona nada en GitHub.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /
# Si se ejecuta desde /tmp (antes de que el paquete esté instalado), usa lib.sh y openclaw_check.sh de la instalación actual.
[ -f "$AQUI/lib.sh" ] || AQUI="${CREA_APP_DIR:-/opt/crea-oficina/app}/deploy/convivencia"; [ -f "$AQUI/lib.sh" ] || { echo "No encuentro lib.sh (¿está instalada la aplicación?)"; exit 1; }
. "$AQUI/lib.sh"
APP_DIR="${CREA_APP_DIR:-$APP_DIR}"; ENV_FILE="${CREA_ENV_FILE:-$ENV_FILE}"; STATE="${CREA_STATE:-$STATE}"
RAMA="claude/router-ia-minimo"; COMMIT=""; MODO=simulacro
while [ $# -gt 0 ]; do case "$1" in --aplicar) MODO=aplicar; DRY=0;; --verificar) MODO=verificar;; --revertir) MODO=revertir; DRY=0;; --rama) RAMA="$2"; shift;; --commit) COMMIT="$2"; shift;; *) die "Opción desconocida: $1";; esac; shift; done
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0 [--verificar|--aplicar --commit SHA|--revertir]"
[ -d "$APP_DIR/.git" ] || die "No encuentro la instalación en $APP_DIR."; [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE."
as_app() { if [ -n "${CREA_SIN_USUARIO:-}" ]; then env "$@"; else runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" "$@"; fi; }
g() { as_app git -C "$APP_DIR" "$@"; }
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }; def() { [ -n "$(val "$1")" ] && echo "definida" || echo "NO definida"; }
# Archivos que el paquete puede traer (lo demás aborta la instalación).
PERMITIDOS='^(src/server/ai/|src/server/models/index\.ts$|src/server/tasks/index\.ts$|src/server/db/schema\.sql$|src/app/admin/(ia/page\.tsx|layout\.tsx)$|src/app/admin_actions\.ts$|scripts/ia/(catalogo_openrouter|preparado|prueba_humo)\.ts$|scripts/e2e/compra_directa\.cjs$|deploy/convivencia/(configurar_openrouter|instalar_router)\.sh$|tests/|docs/(ia-router|integracion)/|package\.json$|\.env\.example$)'
TABLAS="ai_models ai_settings ai_plan_limits ai_accounts ai_reservations ai_calls ai_alerts"
build() { systemd-run --wait --pipe --collect -p User="$APP_USER" -p WorkingDirectory="$APP_DIR" -p EnvironmentFile="$ENV_FILE" -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=100% -p CPUWeight=20 -p Nice=10 -E HOME="$HOME_DIR" -E PATH="$NODE_DIR/bin:/usr/bin:/bin" -E NODE_OPTIONS=--max-old-space-size=2048 /usr/bin/bash -c "npm ci --include=dev --no-audit --no-fund && npm run build"; }
salud() { for i in $(seq 1 "${1:-30}"); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }

if [ "$MODO" = revertir ]; then
  [ -r "$STATE/router_anterior.txt" ] || die "No hay versión anterior guardada ($STATE/router_anterior.txt)."; PREV="$(sed -n 1p "$STATE/router_anterior.txt")"; RPREV="$(sed -n 2p "$STATE/router_anterior.txt")"
  paso "Volver a la versión anterior ${PREV:0:7}" "cambia el código a esa versión, reconstruye y reinicia SOLO crea-oficina (el router sigue apagado; las tablas nuevas se quedan vacías, sin efecto)"
  g checkout -q "${RPREV:-main}" || die "No pude volver a la rama ${RPREV:-main}."; g reset -q --hard "$PREV" || die "No pude restaurar $PREV."; build >/dev/null 2>&1 || die "La compilación de la versión anterior falló: revisa journalctl."
  systemctl restart crea-oficina; salud 40 && ok "Versión anterior restaurada y respondiendo." || bad "No responde: journalctl -u crea-oficina -n 50"; exit 0
fi

titulo "1. Estado actual (solo lectura; no se muestran valores)"
[ -z "$(g status --porcelain)" ] && ok "El árbol de trabajo está limpio" || die "Hay cambios locales sin guardar en $APP_DIR (git status). No se instala nada."
PREV="$(g rev-parse HEAD)"; RPREV="$(g rev-parse --abbrev-ref HEAD)"; echo "   Versión instalada: ${PREV:0:7} (rama local: $RPREV)"
for k in OPENROUTER_API_KEY ANTHROPIC_API_KEY AI_ROUTER DATABASE_URL APP_SECRET; do echo "   $k: $(def $k)"; done
[ "$(val AI_ROUTER)" = "on" ] && die "AI_ROUTER está en «on». Este paquete exige que esté APAGADO. No se instala nada."; ok "AI_ROUTER no está encendido"
[ "$(val OPENROUTER_API_KEY)" = "" ] && warn "No hay OPENROUTER_API_KEY (no es necesaria para instalar; sí para la prueba de humo)."

titulo "2. Rama y commit"
g fetch -q origin "$RAMA" 2>/dev/null || die "No pude traer origin/$RAMA (¿está publicada y hay red hacia GitHub?)."; NEW="$(g rev-parse FETCH_HEAD)"; echo "   origin/$RAMA → $NEW"
if [ -n "$COMMIT" ]; then case "$NEW" in "$COMMIT"*) ok "El commit coincide con el que indicaste (${COMMIT})";; *) die "La rama apunta a ${NEW:0:12}, no a $COMMIT. No se instala (quizá cambió desde que la revisaste).";; esac
elif [ "$MODO" = aplicar ]; then die "Para --aplicar indica el commit revisado:  --commit ${NEW:0:12}"; fi
g merge-base --is-ancestor "$PREV" "$NEW" && ok "El paquete avanza limpio desde la versión instalada (fast-forward)" || die "El paquete NO desciende de la versión instalada ($PREV). No se instala."
echo "   Commits que se instalarían:"; g log --oneline "$PREV..$NEW" | sed 's/^/      /' | head -30
g fetch -q origin main 2>/dev/null; BASE="$(g merge-base origin/main "$NEW")"; DESDE_MAIN="$(g rev-list --count "$PREV..$BASE")"
[ "$DESDE_MAIN" -gt 0 ] && warn "Además del router, llegan $DESDE_MAIN commit(s) que ya están en main y tu VPS aún no tiene (se listan arriba)." || ok "Tu VPS ya tiene todo main: solo llega el router"
echo "   Archivos que añade el paquete respecto de main:"; g diff --name-status "$BASE" "$NEW" | sed 's/^/      /' | grep -vE "docs/|tests/" | head -40
FUERA="$(g diff --name-only "$BASE" "$NEW" | grep -vE "$PERMITIDOS" || true)"
[ -z "$FUERA" ] && ok "Todos los archivos del paquete están en la lista permitida (sin landing, afiliados ni Mi Plan de Libertad)" || { bad "El paquete trae archivos fuera de la lista permitida:"; echo "$FUERA" | sed 's/^/      /'; die "No se instala."; }
g diff --quiet "$PREV" "$NEW" -- package-lock.json && ok "Las dependencias (package-lock.json) no cambian" || warn "package-lock.json cambia entre tu versión y el paquete: se instalarán dependencias distintas (npm ci). Revísalo."
g diff --name-only "$PREV" "$NEW" | grep -qE "^src/app/(api/stripe|api/webhooks)|stripe|resend" && warn "El rango toca archivos de pagos/correo (viene de main); revisa la lista de commits."
[ "$MODO" = verificar ] && { echo; ok "Verificación terminada. No se cambió nada."; exit 0; }
if [ "$MODO" = simulacro ]; then titulo "SIMULACRO"; cat <<TXT
   Con --aplicar --commit ${NEW:0:12} haría, en este orden (cada paso cambia algo y pide escribir SI):
   1) Foto «antes» de OpenClaw y respaldo (systemctl start crea-respaldo.service: base de datos + archivos) + copia del env en $BACKUPS (permiso 600).
   2) git checkout -B router-instalado ${NEW:0:7}   (la rama local «$RPREV» queda INTACTA en ${PREV:0:7}: es el punto de retorno)
   3) npm ci + build con tope de memoria (no detiene la app en marcha)
   4) systemctl restart crea-oficina (ÚNICO reinicio; no toca OpenClaw ni el servidor) y /api/health
   5) Verifica: AI_ROUTER sigue apagado, existen las 7 tablas nuevas, OpenClaw igual que antes
   6) Si cualquier cosa falla: vuelve solo a ${PREV:0:7}, reconstruye y reinicia crea-oficina.
   NO se hace: encender AI_ROUTER, escribir en /etc/crea-oficina/env, llamar a OpenRouter, tocar Stripe/Resend/datos de clientes.
TXT
  exit 0; fi

# ---------------- APLICAR ----------------
OC="$STATE/openclaw_antes_router.txt"; install -d -m 700 "$BACKUPS" "$STATE"
paso "Respaldo y foto de OpenClaw" "guarda una foto de OpenClaw (solo lectura), lanza el respaldo de crea-oficina y copia el archivo env a $BACKUPS con permiso 600"
bash "$AQUI/openclaw_check.sh" --guardar "$OC" >/dev/null || warn "No pude guardar la foto de OpenClaw (revisa el puerto con OPENCLAW_PORT)."
systemctl start crea-respaldo.service && ok "Respaldo previo hecho" || die "El respaldo falló: no se instala."
EB="$BACKUPS/env.router.$(date +%Y%m%d-%H%M%S).bak"; cp -p "$ENV_FILE" "$EB" && chmod 600 "$EB" && ok "Copia del env (sin mostrarlo): $EB"
printf '%s\n%s\n' "$PREV" "$RPREV" > "$STATE/router_anterior.txt"; ok "Punto de retorno guardado: ${PREV:0:7} (rama $RPREV)"
volver() { warn "Volviendo a la versión anterior ${PREV:0:7}…"; g checkout -q "$RPREV" 2>/dev/null; g reset -q --hard "$PREV"; build >/dev/null 2>&1; systemctl restart crea-oficina; salud 40 && ok "Versión anterior restaurada y funcionando." || bad "Aun así no responde: journalctl -u crea-oficina -n 50"; bash "$AQUI/openclaw_check.sh" --comparar "$OC" >/dev/null 2>&1 || warn "Revisa OpenClaw."; exit 1; }
paso "Cambiar el código a ${NEW:0:7}" "git checkout -B router-instalado en el commit revisado (la rama $RPREV no se toca)"
g checkout -q -B router-instalado "$NEW" || die "No pude cambiar el código. No se cambió nada más."; [ "$(g rev-parse HEAD)" = "$NEW" ] || volver
paso "Compilar" "npm ci y next build con tope de memoria (la aplicación sigue sirviendo la versión anterior mientras tanto)"
build || { bad "La compilación falló (OpenClaw no se afectó)."; volver; }
paso "Reiniciar SOLO crea-oficina" "es el único reinicio: unos segundos sin servicio en la aplicación; no toca OpenClaw ni el servidor"
systemctl restart crea-oficina; salud 40 || { bad "La aplicación no responde con la versión nueva."; volver; }; ok "La aplicación responde con ${NEW:0:7}"
[ "$(val AI_ROUTER)" = "on" ] && { bad "AI_ROUTER apareció encendido: se revierte."; volver; } || ok "AI_ROUTER sigue apagado"
FALTAN=""; for t in $TABLAS; do [ "$(runuser -u postgres -- psql -d "$DB_NAME" -Atc "select to_regclass('public.$t') is not null" 2>/dev/null)" = "t" ] || FALTAN="$FALTAN $t"; done
[ -z "$FALTAN" ] && ok "Existen las 7 tablas nuevas del router (vacías hasta que se use)" || { bad "Faltan tablas:$FALTAN"; volver; }
bash "$AQUI/openclaw_check.sh" --comparar "$OC" && ok "OpenClaw igual que antes" || warn "OpenClaw muestra cambios que NO provoca este paquete: revisa."
titulo "¿Está listo el router? (solo lectura; no llama a ningún modelo)"
as_app bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && npm run -s ia:preparado" || true
echo; ok "Instalado ${NEW:0:7} con el router APAGADO."; echo "Siguiente paso (NO automático): prueba de humo de UNA llamada con tope de US\$0.01 — docs/ia-router/INSTALAR_ROUTER_VPS.md, sección 5."
echo "Para volver atrás:  sudo bash $0 --revertir"
