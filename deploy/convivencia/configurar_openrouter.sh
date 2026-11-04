#!/usr/bin/env bash
# Carga la clave de OpenRouter en /etc/crea-oficina/env SIN mostrarla, SIN encender el router y SIN tocar Stripe, Anthropic, Resend, precios ni la base de datos.
#   sudo bash configurar_openrouter.sh             → SIMULACRO: dice qué hay definido (sí/no) y no cambia nada
#   sudo bash configurar_openrouter.sh --aplicar   → pide la clave en privado; respalda antes; revierte si algo protegido cambia
# AI_ROUTER nunca se enciende aquí: solo se deja en «off» si no existía. Reinicia SOLO crea-oficina y solo si escribes SI. No toca OpenClaw.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"
ENV_FILE="${CREA_ENV_FILE:-$ENV_FILE}"; BACKUPS="${CREA_BACKUPS:-$BACKUPS}"; APLICAR=0; [ "${1:-}" = "--aplicar" ] && APLICAR=1
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0 [--aplicar]"; [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE (¿está instalada la aplicación?)."
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }; def() { [ -n "$(val "$1")" ] && echo "definida" || echo "NO definida"; }
huella() { grep -E '^(STRIPE_[A-Z_]*|BILLING_ENABLED|PLAN_PRICE_[A-Z_]*|OFFER_PLAN|ANTHROPIC_[A-Z_]*|MODEL_[A-Z_]*|DATABASE_URL|APP_SECRET|CRON_SECRET|PUBLIC_SIGNUP|SIGNUP_ALLOWED_EMAILS|RESEND_[A-Z_]*|MAIL_[A-Z_]*|PLATFORM_ADMIN_EMAILS|NEXT_PUBLIC_SITE_URL|SITE_URL)=' "$ENV_FILE" | sort | sha256sum | cut -c1-16; }

titulo "Estado actual (solo sí/no; no se muestran valores)"
for k in OPENROUTER_API_KEY OPENROUTER_BASE_URL ANTHROPIC_API_KEY AI_ROUTER; do echo "   $k: $(def $k)"; done
[ "$(val AI_ROUTER)" = "on" ] && warn "AI_ROUTER está en «on». Este script NO lo cambia." || ok "AI_ROUTER no está encendido (apagado o sin definir)"
if [ "$APLICAR" = 0 ]; then echo; echo "SIMULACRO: no se cambió nada. Para cargar la clave:  sudo bash $0 --aplicar"; exit 0; fi

install -d -m 700 "$BACKUPS"; BK="$BACKUPS/env.openrouter.$(date +%Y%m%d-%H%M%S).bak"; cp -p "$ENV_FILE" "$BK" && chmod 600 "$BK" && ok "Respaldo del archivo de configuración (para revertir): $BK"
H0="$(huella)"; K0="$(cut -d= -f1 "$ENV_FILE" | grep -v '^#' | sort -u)"; CAMBIOS=0

titulo "Clave de OpenRouter"
echo "   En openrouter.ai → Keys → Create Key. Ponle un LÍMITE DE CRÉDITO pequeño a la clave (si la opción existe) y ten poco saldo en la cuenta."
read -r -s -p "Pega la clave (no se verá; Enter = no cambiar) " k; echo
if [ -n "$k" ]; then
  if [[ "$k" =~ ^sk-or-[A-Za-z0-9_.-]{16,}$ ]]; then env_set "$ENV_FILE" OPENROUTER_API_KEY "$k"; ok "OPENROUTER_API_KEY guardada (oculta)"; CAMBIOS=1
  else bad "La clave no tiene el formato esperado (sk-or-…; longitud ${#k}). No se guardó. Si estás seguro de que es la correcta, avísame para ajustar la validación."; fi
fi; unset k
if [ -z "$(val AI_ROUTER)" ]; then env_set "$ENV_FILE" AI_ROUTER off; ok "AI_ROUTER=off (apagado explícito)"; CAMBIOS=1; fi

[ "$CAMBIOS" = 0 ] && { echo; echo "Nada que cambiar."; exit 0; }
titulo "Comprobación"
K1="$(cut -d= -f1 "$ENV_FILE" | grep -v '^#' | sort -u)"; [ "$(comm -23 <(echo "$K0") <(echo "$K1") | wc -l)" = 0 ] && ok "No se eliminó ninguna variable" || { bad "Se perdieron variables: se restaura el respaldo."; cp -p "$BK" "$ENV_FILE"; exit 1; }
[ "$(huella)" = "$H0" ] && ok "Stripe, Anthropic, Resend, precios, base de datos y registro público: SIN CAMBIOS" || { bad "Cambió una variable protegida: se restaura el respaldo."; cp -p "$BK" "$ENV_FILE"; exit 1; }
[ "$(val AI_ROUTER)" = "on" ] && { bad "AI_ROUTER quedó en «on»: no es posible desde este script. Se restaura el respaldo."; cp -p "$BK" "$ENV_FILE"; exit 1; } || ok "El router sigue APAGADO"

echo; echo "El archivo ya está actualizado; la aplicación en marcha sigue con la configuración vieja hasta reiniciarla."
read -r -p "¿Reinicio SOLO el servicio crea-oficina? (SI/no): " r
if [ "$r" = "SI" ]; then
  OCF="$STATE/openclaw_antes.txt"; [ -r "$OCF" ] || bash "$AQUI/openclaw_check.sh" --guardar "$OCF" >/dev/null 2>&1
  systemctl restart crea-oficina; sleep 5
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then ok "crea-oficina reiniciado y responde"
  else bad "No responde: se restaura el respaldo y se reinicia otra vez."; cp -p "$BK" "$ENV_FILE"; systemctl restart crea-oficina; sleep 5; curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && ok "Servicio recuperado con la configuración anterior" || die "Sigue sin responder: journalctl -u crea-oficina -n 50"; exit 1; fi
  [ -r "$OCF" ] && { bash "$AQUI/openclaw_check.sh" --comparar "$OCF" || warn "OpenClaw muestra cambios (revisa)."; }
  run_app() { runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && $1"; }
  titulo "¿Está listo el router? (solo lectura; no llama a ningún modelo)"; run_app "npm run -s ia:preparado" || true
  echo; echo "Siguiente paso (NO automático): la prueba de humo de UNA llamada con tope — ver docs/ia-router/CONFIGURAR_OPENROUTER_VPS.md, paso 6."
else warn "No se reinició. Cuando quieras:  sudo systemctl restart crea-oficina"; fi
