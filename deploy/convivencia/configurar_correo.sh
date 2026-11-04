#!/usr/bin/env bash
# Configura SOLO el correo (Resend) en /etc/crea-oficina/env. No toca Stripe, precios, Anthropic, base de datos ni registros públicos.
#   sudo bash configurar_correo.sh             → SIMULACRO: muestra qué está definido (sí/no, nunca valores) y no cambia nada
#   sudo bash configurar_correo.sh --aplicar   → pregunta cada dato; Enter = no cambiar; respalda antes y revierte si falla
# Nunca imprime claves, secretos, correos de operador completos ni enlaces. Reinicia SOLO crea-oficina, y solo si tú escribes SI.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"
ENV_FILE="${CREA_ENV_FILE:-$ENV_FILE}"; SITE="https://app.mmeia.tech"; APLICAR=0; [ "${1:-}" = "--aplicar" ] && APLICAR=1
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0 [--aplicar]"; [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE (¿está instalada la aplicación?)."
val() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
def() { [ -n "$(val "$1")" ] && echo "definida" || echo "NO definida"; }
mask() { local e="$1"; echo "${e:0:2}***@${e#*@}"; }
huella() { grep -E '^(STRIPE_[A-Z_]*|BILLING_ENABLED|PLAN_PRICE_[A-Z_]*|OFFER_PLAN|ANTHROPIC_[A-Z_]*|MODEL_[A-Z_]*|DATABASE_URL|APP_SECRET|CRON_SECRET|PUBLIC_SIGNUP|SIGNUP_ALLOWED_EMAILS)=' "$ENV_FILE" | sort | sha256sum | cut -c1-16; }

titulo "Estado actual del correo (solo sí/no; no se muestran valores)"
for k in RESEND_API_KEY MAIL_FROM RESEND_WEBHOOK_SECRET MAIL_REPLY_TO NEXT_PUBLIC_SITE_URL SITE_URL PLATFORM_ADMIN_EMAILS; do echo "   $k: $(def $k)"; done
NADM=0; [ -n "$(val PLATFORM_ADMIN_EMAILS)" ] && NADM=$(val PLATFORM_ADMIN_EMAILS | tr ',' '\n' | sed '/^\s*$/d' | wc -l); echo "   Correos de operador en PLATFORM_ADMIN_EMAILS: $NADM"
[ "$(val BILLING_ENABLED)" = true ] && warn "BILLING_ENABLED=true (cobros en modo prueba encendidos; este script NO lo cambia)." || echo "   BILLING_ENABLED: apagado o no definido (este script no lo cambia)"
[ "$(val PUBLIC_SIGNUP)" = true ] && warn "PUBLIC_SIGNUP=true: el registro público está ABIERTO (este script no lo cambia; ciérralo antes de las pruebas finales)." || ok "Registro público: restringido (PUBLIC_SIGNUP no está en true)"
if [ "$APLICAR" = 0 ]; then echo; echo "SIMULACRO: no se cambió nada. Para configurar:  sudo bash $0 --aplicar"; exit 0; fi

install -d -m 700 "$BACKUPS"; BK="$BACKUPS/env.correo.$(date +%Y%m%d-%H%M%S).bak"; cp -p "$ENV_FILE" "$BK" && chmod 600 "$BK" && ok "Respaldo del archivo de configuración creado (para revertir): $BK"
H0="$(huella)"; K0="$(cut -d= -f1 "$ENV_FILE" | grep -v '^#' | sort -u)"; CAMBIOS=0
ask_secret() { local k="$1" p="$2" re="$3" v; read -r -s -p "$p (no se verá al escribir; Enter = no cambiar) " v; echo; [ -z "$v" ] && return; [[ "$v" =~ $re ]] || { bad "Formato no válido para $k. No se cambió nada."; return; }; env_set "$ENV_FILE" "$k" "$v"; ok "$k guardado (oculto)"; CAMBIOS=1; }

titulo "1/5 · Clave de Resend"; echo "   Resend → API Keys → Create API Key → permiso «Sending access» → Add. Cópiala y pégala aquí (nadie la verá)."
ask_secret RESEND_API_KEY "Pega la clave de Resend (empieza con re_):" '^re_[A-Za-z0-9_]+$'

titulo "2/5 · Remitente (solo cuando Resend muestre el dominio como Verified)"
read -r -p "¿En Resend → Domains, mmeia.tech aparece como «Verified»? (SI/no): " vd
if [ "$vd" = "SI" ]; then env_set "$ENV_FILE" MAIL_FROM '"Crea tu Oficina IA <acceso@mmeia.tech>"'; ok "MAIL_FROM = Crea tu Oficina IA <acceso@mmeia.tech>"; CAMBIOS=1
else warn "MAIL_FROM NO se cambió. Sin remitente verificado la aplicación no enviará correos (los deja en cola con el motivo visible). Vuelve a correr este script cuando diga Verified."; fi

titulo "3/5 · Dirección pública del sitio"
if [ "$(val NEXT_PUBLIC_SITE_URL)" = "$SITE" ] && [ "$(val SITE_URL)" = "$SITE" ]; then ok "NEXT_PUBLIC_SITE_URL y SITE_URL ya son $SITE"
else read -r -p "¿Fijo NEXT_PUBLIC_SITE_URL y SITE_URL en $SITE? (SI/no): " s; [ "$s" = "SI" ] && { env_set "$ENV_FILE" NEXT_PUBLIC_SITE_URL "$SITE"; env_set "$ENV_FILE" SITE_URL "$SITE"; ok "Dirección pública guardada"; CAMBIOS=1; }; fi

titulo "4/5 · Correos de operador (PLATFORM_ADMIN_EMAILS) — nunca se reemplaza la lista"
read -r -s -p "Correo de operador a AGREGAR (Enter = dejar la lista como está; no se verá): " ae; echo
if [ -n "$ae" ]; then ae="$(echo "$ae" | tr 'A-Z' 'a-z' | tr -d ' ')"
  if [[ "$ae" =~ ^[^@,\"[:space:]]+@[^@,\"[:space:]]+\.[^@,\"[:space:]]+$ ]]; then
    cur="$(val PLATFORM_ADMIN_EMAILS)"; if echo ",$cur," | tr 'A-Z' 'a-z' | tr -d ' ' | grep -q ",$ae,"; then ok "Ese correo ya estaba en la lista (sin cambios)"
    else new="${cur:+$cur,}$ae"; env_set "$ENV_FILE" PLATFORM_ADMIN_EMAILS "$new"; ok "Correo agregado (${ae:0:2}***). Ahora hay $(echo "$new" | tr ',' '\n' | sed '/^\s*$/d' | wc -l) en la lista"; CAMBIOS=1; fi
  else bad "Correo no válido. La lista no se cambió."; fi; fi

titulo "5/5 · Webhook de Resend (confirma la ENTREGA con firma)"
echo "   En Resend → Webhooks → Add Endpoint:  URL  $SITE/api/email/webhook   Eventos: email.delivered, email.bounced, email.complained, email.delivery_delayed"
echo "   Al crearlo, Resend muestra un «Signing secret» (whsec_…). Pégalo aquí. La aplicación rechaza todo evento sin firma válida."
ask_secret RESEND_WEBHOOK_SECRET "Pega el Signing secret (whsec_…):" '^whsec_[A-Za-z0-9+/=]+$'

[ "$CAMBIOS" = 0 ] && { echo; echo "Nada que cambiar."; exit 0; }
titulo "Comprobación de que no se perdió ni cambió nada más"
K1="$(cut -d= -f1 "$ENV_FILE" | grep -v '^#' | sort -u)"; PERDIDAS="$(comm -23 <(echo "$K0") <(echo "$K1") | wc -l)"
[ "$PERDIDAS" = 0 ] && ok "No se eliminó ninguna variable" || { bad "Se perdieron $PERDIDAS variables: se restaura el respaldo."; cp -p "$BK" "$ENV_FILE"; exit 1; }
[ "$(huella)" = "$H0" ] && ok "Stripe, precios, Anthropic, base de datos y registro público: SIN CAMBIOS" || { bad "Cambió una variable protegida: se restaura el respaldo."; cp -p "$BK" "$ENV_FILE"; exit 1; }

echo; echo "El archivo ya está actualizado, pero la aplicación en marcha SIGUE con la configuración vieja hasta reiniciarla."
read -r -p "¿Reinicio SOLO el servicio crea-oficina para aplicar los cambios? (SI/no): " r
if [ "$r" = "SI" ]; then
  OCF="$STATE/openclaw_antes.txt"; [ -r "$OCF" ] || bash "$AQUI/openclaw_check.sh" --guardar "$OCF" >/dev/null 2>&1
  systemctl restart crea-oficina; sleep 5
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then ok "crea-oficina reiniciado y responde"
  else bad "crea-oficina NO responde: se restaura el respaldo y se reinicia otra vez."; cp -p "$BK" "$ENV_FILE"; systemctl restart crea-oficina; sleep 5; curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && ok "Servicio recuperado con la configuración anterior" || die "Sigue sin responder: journalctl -u crea-oficina -n 50"; exit 1; fi
  [ -r "$OCF" ] && { bash "$AQUI/openclaw_check.sh" --comparar "$OCF" || warn "OpenClaw muestra cambios (revisa)."; }
  run_app() { runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && $1"; }
  titulo "La aplicación SÍ carga la configuración (sin mostrar secretos)"; run_app "npm run -s correo:diagnostico" || true
  echo; echo "ETAPAS: (1) tu servidor aceptó  (2) Resend ACEPTÓ el envío  (3) Resend confirmó ENTREGA al servidor del destinatario  (4) tú VES el correo en tu bandeja."
  echo "Solo (4) lo confirmas tú; (2) y (3) las muestra /admin/correos. «Aceptado» NO significa «entregado»."
  read -r -p "¿Envío AHORA un correo real de prueba al primer correo de operador? (SI/no): " t
  [ "$t" = "SI" ] && { run_app "npm run -s correo:diagnostico -- --admin --esperar" || true; echo; echo "Revisa tu bandeja y la carpeta de spam. Luego abre $SITE/admin/correos para ver aceptado/entregado."; }
else warn "No se reinició. Cuando quieras:  sudo systemctl restart crea-oficina"; fi
