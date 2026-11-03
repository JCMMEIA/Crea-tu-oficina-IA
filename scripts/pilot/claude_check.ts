// Verificación REAL con Claude. Solo corre si hay ANTHROPIC_API_KEY (y tarifas). Datos 100 % ficticios; base en memoria; tope de gasto.
//   ANTHROPIC_API_KEY=... MODEL_INPUT_USD_PER_MTOK=... MODEL_OUTPUT_USD_PER_MTOK=... npm run pilot:claude
import { createPgliteDb } from "../../src/server/db";
import { AnthropicProvider, pricingFromEnv } from "../../src/server/models";
import { createPilotAgency, createPilotClient, hirePilotTeam, createPilotAutomation, EXPECTED, VERDE_VIVO_CSV } from "../../src/server/pilot";
import { importInventory, listDrafts } from "../../src/server/inventory";
import { runDueAutomations } from "../../src/server/automations";
import { listTasks, listApprovals } from "../../src/server/tasks";
import { FakeAdapter } from "../../tests/helpers";

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.log("NO VERIFICADO: falta ANTHROPIC_API_KEY. No se llamó a ningún modelo."); process.exit(2); }
  if (!pricingFromEnv()) { console.log("NO VERIFICADO: faltan MODEL_INPUT_USD_PER_MTOK / MODEL_OUTPUT_USD_PER_MTOK (sin tarifa no se puede acotar el gasto)."); process.exit(2); }
  const db = await createPgliteDb(); const A = await createPilotAgency(db, { email: "nova@piloto.test", password: "clave-piloto-123" }); const { companyId, actor } = await createPilotClient(db, A);
  const team = await hirePilotTeam(db, actor); await importInventory(db, actor, VERDE_VIVO_CSV); await db.query("UPDATE companies SET monthly_budget_usd=1 WHERE id=$1", [companyId]); // tope duro de 1 USD
  const t0 = new Date(); await createPilotAutomation(db, actor, team["controlador-inventario"], t0);
  await runDueAutomations(db, { provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY), adapter: new FakeAdapter() }, new Date(t0.getTime() + 86400_000 + 60_000));
  const tasks = await listTasks(db, actor), drafts = await listDrafts(db, actor), aps = await listApprovals(db, actor);
  const spent = Number((await db.query("SELECT coalesce(sum(cost_usd),0) s FROM usage_events"))[0].s);
  console.log(JSON.stringify({ tareas: tasks.map((t: any) => [t.employee_name, t.status, t.error ?? null]), borradores: drafts.map((d: any) => [d.total_units, d.status]), aprobaciones_pendientes: aps.length, costo_estimado_usd: spent }, null, 1));
  const ok = drafts.length === 1 && drafts[0].total_units === EXPECTED.unidades && aps.length === 1;
  console.log(ok ? "✓ CLAUDE REAL: delegó, el sistema calculó 66 unidades y quedó una aprobación pendiente." : "✗ CLAUDE REAL: el resultado NO coincide con lo esperado (ver detalle arriba)."); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
