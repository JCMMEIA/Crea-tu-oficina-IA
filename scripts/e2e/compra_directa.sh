#!/usr/bin/env bash
# Corre el E2E de compra directa contra PostgreSQL local y servidores SIMULADOS de Stripe/Resend/Anthropic. Uso:
#   E2E_PGURL=postgres://usuario:clave@127.0.0.1:5544 bash scripts/e2e/compra_directa.sh docs/comercial/evidencia_compra
set -uo pipefail; cd "$(dirname "$0")/../.."; OUT="${1:-/tmp/compra_directa}"; PG="${E2E_PGURL:?define E2E_PGURL=postgres://usuario:clave@host:puerto}"; DB=cto_com
limpiar() { ps aux | grep -E "next-server|scripts/e2e/mocks.cjs|next start" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null; sleep 1; }   # mata procesos de corridas anteriores (por PID, nunca por nombre amplio)
limpiar
psql "$PG/postgres" -qc "drop database if exists $DB with (force)" -qc "create database $DB" 2>&1 | grep -v NOTICE
export NODE_ENV=production APP_SECRET="$(openssl rand -base64 32)" CRON_SECRET="$(openssl rand -hex 24)" DATABASE_URL="$PG/$DB" NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3112 NEXT_PUBLIC_CONTACT_EMAIL=privacidad@ejemplo.test \
  PLATFORM_ADMIN_EMAILS=jose@ejemplo.test BILLING_ENABLED=true STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e STRIPE_API_BASE=http://127.0.0.1:3199 PLAN_PRICE_MXN_EMPRENDEDOR=899 OFFER_PLAN=emprendedor \
  RESEND_API_KEY=re_e2e MAIL_FROM="Crea tu Oficina IA <hola@ejemplo.test>" MAIL_API_BASE=http://127.0.0.1:3199 ANTHROPIC_API_KEY=sk-e2e ANTHROPIC_BASE_URL=http://127.0.0.1:3199 MODEL_INPUT_USD_PER_MTOK=3 MODEL_OUTPUT_USD_PER_MTOK=15 PORT=3112 HOSTNAME=127.0.0.1
unset SIGNUP_ALLOWED_EMAILS PUBLIC_SIGNUP
npm run build >/var/tmp/e2e_build.log 2>&1 || { tail -20 /var/tmp/e2e_build.log; exit 1; }
node scripts/e2e/mocks.cjs 3199 >/var/tmp/e2e_mocks.log 2>&1 & MPID=$!
npx next start -H 127.0.0.1 -p 3112 >/var/tmp/e2e_next.log 2>&1 & NPID=$!
for i in $(seq 1 40); do curl -fs http://127.0.0.1:3112/api/health >/dev/null 2>&1 && break; sleep 0.5; done
E2E_DB="$DATABASE_URL" NODE_PATH="$(npm root -g)" node scripts/e2e/compra_directa.cjs "$OUT"; RC=$?
limpiar; exit $RC
