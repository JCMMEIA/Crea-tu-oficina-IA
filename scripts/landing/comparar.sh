#!/usr/bin/env bash
# Genera capturas de la landing con la TIENDA ABIERTA (servidores simulados de Stripe/Resend/Anthropic) y las compara con la referencia (docs/diseno/referencia.webp).
#   E2E_PGURL=postgres://usuario:clave@127.0.0.1:5544 bash scripts/landing/comparar.sh
set -uo pipefail; cd "$(dirname "$0")/../.."; PG="${E2E_PGURL:?define E2E_PGURL}"; DB=cto_cmp; OUT=docs/diseno/capturas
limpiar() { ps aux | grep -E "next-server|scripts/e2e/mocks.cjs|next start" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null; sleep 1; }; limpiar
psql "$PG/postgres" -qc "drop database if exists $DB with (force)" -qc "create database $DB" 2>&1 | grep -v NOTICE
export NODE_ENV=production APP_SECRET="$(openssl rand -base64 32)" CRON_SECRET="$(openssl rand -hex 24)" DATABASE_URL="$PG/$DB" NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3116 NEXT_PUBLIC_CONTACT_EMAIL=contacto@ejemplo.test BILLING_ENABLED=true STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e STRIPE_API_BASE=http://127.0.0.1:3199 PLAN_PRICE_MXN_EMPRENDEDOR=899 RESEND_API_KEY=re_e2e MAIL_FROM="Crea <hola@ejemplo.test>" MAIL_API_BASE=http://127.0.0.1:3199 ANTHROPIC_API_KEY=sk-e2e ANTHROPIC_BASE_URL=http://127.0.0.1:3199 MODEL_INPUT_USD_PER_MTOK=3 MODEL_OUTPUT_USD_PER_MTOK=15 PORT=3116 HOSTNAME=127.0.0.1
node scripts/e2e/mocks.cjs 3199 >/dev/null 2>&1 &
npx tsx scripts/ai_verify.ts >/dev/null 2>&1 || { echo "no se pudo verificar la IA simulada"; limpiar; exit 1; }
npx next start -H 127.0.0.1 -p 3116 >/var/tmp/cmp_next.log 2>&1 &
for i in $(seq 1 40); do curl -fs http://127.0.0.1:3116/api/health >/dev/null 2>&1 && break; sleep 0.5; done
cat > /var/tmp/cmp_shots.cjs <<'JS'
const { chromium } = require("playwright"); const base = "http://127.0.0.1:3116", out = process.argv[2];
(async () => { const b = await chromium.launch();
  let p = await (await b.newContext({ viewport: { width: 1672, height: 941 } })).newPage(); await p.goto(base + "/", { waitUntil: "networkidle" }); await p.screenshot({ path: out + "/abierta-escritorio-arriba.png" });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, 0); }); await p.waitForTimeout(500); await p.screenshot({ path: out + "/abierta-escritorio-completa.png", fullPage: true });
  p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage(); await p.goto(base + "/", { waitUntil: "networkidle" }); await p.screenshot({ path: out + "/abierta-movil-arriba.png" });
  await b.close(); })();
JS
NODE_PATH="$(npm root -g)" node /var/tmp/cmp_shots.cjs "$OUT"; limpiar
python3 scripts/landing/comparar.py
