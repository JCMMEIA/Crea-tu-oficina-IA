#!/usr/bin/env bash
# Configura las claves del modelo de venta en /etc/crea-oficina/env SIN mostrarlas ni dejarlas en el historial. Pregunta cada dato; Enter = no cambiar.
#   sudo bash configurar_ventas.sh
# NO activa cobros reales: solo acepta claves de PRUEBA de Stripe (sk_test_…) y BILLING_ENABLED solo se enciende si lo pides con la palabra exacta.
# Reinicia SOLO crea-oficina (nuestro servicio), nunca OpenClaw ni el servidor.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0"; [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE (¿está instalada la aplicación?)."
cp -p "$ENV_FILE" "$BACKUPS/env.$(date +%Y%m%d-%H%M%S).bak" 2>/dev/null && chmod 600 "$BACKUPS"/env.*.bak 2>/dev/null; CAMBIOS=0
ask_plain() { local k="$1" p="$2" re="$3" v; read -r -p "$p " v; [ -z "$v" ] && return; [[ "$v" =~ $re ]] || { bad "Formato no válido para $k. No se cambió."; return; }; env_set "$ENV_FILE" "$k" "$v"; ok "$k guardado"; CAMBIOS=1; }
ask_secret() { local k="$1" p="$2" re="$3" v; read -r -s -p "$p (no se verá al escribir) " v; echo; [ -z "$v" ] && return; [[ "$v" =~ $re ]] || { bad "Formato no válido para $k (¿pegaste la clave correcta?). No se cambió."; return; }; env_set "$ENV_FILE" "$k" "$v"; ok "$k guardado (oculto)"; CAMBIOS=1; }
titulo "Precio (pesos mexicanos por mes)"; ask_plain PLAN_PRICE_MXN_EMPRENDEDOR "Precio mensual de la oficina IA en MXN (ej. 899):" '^[0-9]+(\.[0-9]{1,2})?$'
titulo "Stripe (SOLO modo pruebas)"; ask_secret STRIPE_SECRET_KEY "Clave secreta de PRUEBAS de Stripe (empieza con sk_test_):" '^sk_test_[A-Za-z0-9]+$'; ask_secret STRIPE_WEBHOOK_SECRET "Secreto del webhook (empieza con whsec_):" '^whsec_[A-Za-z0-9]+$'
titulo "Correo (Resend)"; ask_secret RESEND_API_KEY "Clave de Resend (empieza con re_):" '^re_[A-Za-z0-9_]+$'
read -r -p "Remitente de TU dominio verificado en Resend (recomendado: Crea tu Oficina IA <acceso@mmeia.tech>): " mf
if [ -n "$mf" ]; then if [[ "$mf" =~ ^[^\"\$\`\\]{3,120}$ ]]; then env_set "$ENV_FILE" MAIL_FROM "\"$mf\""; ok "MAIL_FROM guardado (entre comillas, porque lleva espacios)"; CAMBIOS=1; else bad "Remitente no válido. No se cambió."; fi; fi
ask_secret RESEND_WEBHOOK_SECRET "Secreto del webhook de Resend para confirmar ENTREGAS (empieza con whsec_; opcional, Enter = omitir):" '^whsec_[A-Za-z0-9+/=]+$'
titulo "IA (Anthropic)"; ask_secret ANTHROPIC_API_KEY "Clave de Anthropic (empieza con sk-ant-):" '^sk-ant-[A-Za-z0-9_-]+$'; ask_plain MODEL_INPUT_USD_PER_MTOK "Dólares por millón de tokens de ENTRADA (de la página de precios de Anthropic):" '^[0-9]+(\.[0-9]+)?$'; ask_plain MODEL_OUTPUT_USD_PER_MTOK "Dólares por millón de tokens de SALIDA:" '^[0-9]+(\.[0-9]+)?$'
titulo "Cobros"; read -r -p "Escribe ACTIVAR PRUEBAS para encender los cobros en MODO PRUEBA (Enter = no cambiar): " a
[ "$a" = "ACTIVAR PRUEBAS" ] && { grep -q '^STRIPE_SECRET_KEY=sk_test_' "$ENV_FILE" || die "Primero guarda una clave sk_test_ de Stripe."; env_set "$ENV_FILE" BILLING_ENABLED true; ok "BILLING_ENABLED=true (solo con claves de PRUEBA: Stripe real está bloqueado)"; CAMBIOS=1; }
[ "$CAMBIOS" = 0 ] && { echo "Nada que cambiar."; exit 0; }
read -r -p "¿Reinicio SOLO el servicio crea-oficina para aplicar los cambios? (SI/no): " r
if [ "$r" = "SI" ]; then
  [ -r /root/openclaw_antes.txt ] || [ -r "$STATE/openclaw_antes.txt" ] || bash "$AQUI/openclaw_check.sh" --guardar "$STATE/openclaw_antes.txt" >/dev/null
  systemctl restart crea-oficina && sleep 5 && curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null && ok "crea-oficina reiniciado y responde" || die "crea-oficina no responde: journalctl -u crea-oficina -n 50"
  OCF="$STATE/openclaw_antes.txt"; [ -r "$OCF" ] || OCF=/root/openclaw_antes.txt; bash "$AQUI/openclaw_check.sh" --comparar "$OCF" || warn "OpenClaw muestra cambios (revisa)."
  run_app() { runuser -u "$APP_USER" -- env HOME="$HOME_DIR" PATH="$NODE_DIR/bin:/usr/bin:/bin" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && $1"; }
  run_app "npm run -s tienda:estado" || true
  grep -q '^ANTHROPIC_API_KEY=' "$ENV_FILE" && { read -r -p "¿Verificar la IA ahora (hace UNA llamada real, cuesta centavos)? (SI/no): " v; [ "$v" = "SI" ] && { run_app "npm run -s ai:verify" && run_app "npm run -s tienda:estado"; }; }
fi
