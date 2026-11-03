// Verificación REAL con Claude. Solo corre si hay ANTHROPIC_API_KEY (y tarifas). Datos 100 % ficticios; base en memoria; tope de gasto.
//   ANTHROPIC_API_KEY=... MODEL_INPUT_USD_PER_MTOK=... MODEL_OUTPUT_USD_PER_MTOK=... npm run pilot:claude
import { createPgliteDb } from "../../src/server/db";
import { AnthropicProvider, pricingFromEnv } from "../../src/server/models";
import { createPilotAgency, createPilotClient, hirePilotTeam, createPilotAutomation, EXPECTED, VERDE_VIVO_CSV } from "../../src/server/pilot";
import { importInventory, listDrafts } from "../../src/server/inventory";
import { runDueAutomations } from "../../src/server/automations";
import { listTasks, listApprovals } from "../../src/server/tasks";
import { FakeAdapter } from "../../tests/helpers";
import fs from "node:fs";

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.log("NO VERIFICADO: falta ANTHROPIC_API_KEY. No se llamó a ningún modelo."); process.exit(2); }
  if (!pricingFromEnv()) { console.log("NO VERIFICADO: faltan MODEL_INPUT_USD_PER_MTOK / MODEL_OUTPUT_USD_PER_MTOK (sin tarifa no se puede acotar el gasto)."); process.exit(2); }
  const db = await createPgliteDb(); const A = await createPilotAgency(db, { email: "nova@piloto.test", password: "clave-piloto-123" }); const { companyId, actor } = await createPilotClient(db, A);
  const team = await hirePilotTeam(db, actor); await importInventory(db, actor, VERDE_VIVO_CSV); await db.query("UPDATE companies SET monthly_budget_usd=1 WHERE id=$1", [companyId]); // tope duro de 1 USD
  const t0 = new Date(); await createPilotAutomation(db, actor, team["controlador-inventario"], t0);
  await runDueAutomations(db, { provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY), adapter: new FakeAdapter() }, new Date(t0.getTime() + 86400_000 + 60_000));
  const tasks = await listTasks(db, actor), drafts = await listDrafts(db, actor), aps = await listApprovals(db, actor);
  const usage = await db.query("SELECT employee_id, input_tokens, output_tokens, cost_usd::float cost FROM usage_events ORDER BY id");
  const spent = usage.reduce((n: number, u: any) => n + u.cost, 0);
  const events = await db.query("SELECT t.title, e.kind, e.detail FROM task_events e JOIN tasks t ON t.id=e.task_id ORDER BY e.id");
  const toolCalls = events.filter((e: any) => ["tool_executed", "delegated", "approval_requested"].includes(e.kind)).length;
  const realTokens = usage.length > 0 && usage.every((u: any) => u.input_tokens > 0 && u.output_tokens > 0); // solo una respuesta real de la API trae tokens medidos por el proveedor
  const out = { tareas: tasks.map((t: any) => [t.employee_name, t.status, t.error ?? null]), borradores: drafts.map((d: any) => [d.total_units, d.status]), aprobaciones_pendientes: aps.length, llamadas_al_modelo: usage.length, acciones_del_modelo_ejecutadas: toolCalls, tokens_entrada: usage.reduce((n: number, u: any) => n + u.input_tokens, 0), tokens_salida: usage.reduce((n: number, u: any) => n + u.output_tokens, 0), costo_estimado_usd: spent };
  console.log(JSON.stringify(out, null, 1));
  const ok = drafts.length === 1 && drafts[0].total_units === EXPECTED.unidades && aps.length === 1 && realTokens && tasks.length >= 3 && tasks.every((t: any) => t.status !== "failed");
  if (ok) {
    // EVIDENCIA: se guarda solo si TODO salió bien. Sin claves, sin textos del cliente: únicamente conteos, estados y fecha.
    const file = "docs/pilot/evidencia/claude_real.json";
    fs.writeFileSync(file, JSON.stringify({ verificado: true, fecha: new Date().toISOString(), modelo: process.env.MODEL_ID ?? "(por defecto)", datos: "100 % ficticios (Verde Vivo, inventado)", ...out, nota: "Ejecutado con la API real de Anthropic: los tokens salen de la respuesta del proveedor. El cálculo de 66 unidades lo hace el sistema, no el modelo." }, null, 1) + "\n");
    console.log(`✓ CLAUDE REAL: ${tasks.length} tareas ejecutadas por el modelo (${usage.length} llamadas), el sistema calculó ${EXPECTED.unidades} unidades y quedó 1 aprobación pendiente. Evidencia guardada en ${file}`);
  } else console.log("✗ CLAUDE REAL: el resultado NO cumple lo esperado (ver detalle arriba). No se guardó evidencia.");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
