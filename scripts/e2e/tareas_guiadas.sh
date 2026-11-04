#!/usr/bin/env bash
# E2E de tareas guiadas contra PostgreSQL local y una IA SIMULADA. Uso:  E2E_PGURL=postgres://usuario:clave@127.0.0.1:5544 bash scripts/e2e/tareas_guiadas.sh docs/cerebro-tareas/evidencia
set -uo pipefail; cd "$(dirname "$0")/../.."; OUT="${1:-/tmp/tareas_out}"; PG="${E2E_PGURL:?define E2E_PGURL}"; DB=cto_tareas
limpiar() { ps aux | grep -E "next-server|scripts/e2e/mocks.cjs|next start" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null; sleep 1; }; limpiar
psql "$PG/postgres" -qc "drop database if exists $DB with (force)" -qc "create database $DB" 2>&1 | grep -v NOTICE
export NODE_ENV=production APP_SECRET="$(openssl rand -base64 32)" CRON_SECRET="$(openssl rand -hex 24)" DATABASE_URL="$PG/$DB" NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3113 PUBLIC_SIGNUP=true \
  ANTHROPIC_API_KEY=sk-e2e ANTHROPIC_BASE_URL=http://127.0.0.1:3199 MODEL_INPUT_USD_PER_MTOK=3 MODEL_OUTPUT_USD_PER_MTOK=15 PORT=3113 HOSTNAME=127.0.0.1
unset SIGNUP_ALLOWED_EMAILS BILLING_ENABLED STRIPE_SECRET_KEY
npm run build >/var/tmp/e2e_build.log 2>&1 || { tail -20 /var/tmp/e2e_build.log; exit 1; }
node scripts/e2e/mocks.cjs 3199 >/var/tmp/e2e_mocks.log 2>&1 &
npx next start -H 127.0.0.1 -p 3113 >/var/tmp/e2e_next.log 2>&1 &
for i in $(seq 1 40); do curl -fs http://127.0.0.1:3113/api/health >/dev/null 2>&1 && break; sleep 0.5; done
E2E_DB="$DATABASE_URL" NODE_PATH="$(npm root -g)" node scripts/e2e/tareas_guiadas.cjs "$OUT"; RC=$?; limpiar; exit $RC
