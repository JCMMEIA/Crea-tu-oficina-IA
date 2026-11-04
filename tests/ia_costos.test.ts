import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { newDb, newCompany } from "./helpers";
import { hireFromTemplate } from "@/server/catalog/office";
import { createTask, runTask } from "@/server/tasks";
import type { Actor } from "@/server/auth";
import type { Backend, BackendResult, CallOpts } from "@/server/ai/backends";
import { TransientProviderError, type CompleteRequest } from "@/server/models";
import { ensurePlanDefaults, getSettings, listModels, listPlanLimits, saveModel, updatePlanLimit, updateSettings } from "@/server/ai/config";
import { accountOf, quotaStatus } from "@/server/ai/quota";
import { COST_MARGIN, createRoutedProvider, planRoute } from "@/server/ai/router";
import { DEFAULT_SETTINGS } from "@/server/ai/types";

/** COSTOS: tope por llamada, por tarea y mensual; reservas, liquidación con costo REAL y reintentos. Proveedor simulado: ninguna llamada real. */
process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test"; const OP = { userId: "op", email: "op@ejemplo.test" };
let db: Db, a: Actor; const seen: { model: string; opts: CallOpts }[] = [];
class Fake implements Backend { id = "openrouter" as const; configured() { return true; } constructor(private script: (model: string, n: number) => Partial<BackendResult> | "transient" = () => ({})) {} private n: Record<string, number> = {};
  async complete(m: string, _r: CompleteRequest, o: CallOpts): Promise<BackendResult> { seen.push({ model: m, opts: o }); this.n[m] = (this.n[m] ?? 0) + 1; const s = this.script(m, this.n[m]); if (s === "transient") throw new TransientProviderError("429"); return { text: "Respuesta suficientemente larga para validar el mínimo. ".repeat(4), toolCalls: [], inputTokens: 1000, outputTokens: 200, providerName: "Amazon Bedrock", ...s }; } }
const M = (id: string, pin: string, pout: string, o: any = {}) => ({ id, provider: "openrouter", model_id: `v/${id}`, label: `Modelo ${id}`, tier: "economy", max_level: "B", price_in_usd_mtok: pin, price_out_usd_mtok: pout, context_window: "200000", supports_tools: true, supports_json: true, data_policy: "no_training", credit_weight: "1", enabled: true, verified: true, allowed_providers: "amazon-bedrock", ...o });
beforeEach(async () => { seen.length = 0; db = await newDb(); await db.query("INSERT INTO users(id,email,name,password_hash) VALUES('op','op@ejemplo.test','Op','x') ON CONFLICT DO NOTHING"); await ensurePlanDefaults(db); a = await newCompany(db, "a@x.com", "Café Luna"); await hireFromTemplate(db, a, "agente-soporte"); });
const task = async (i = 0, actor = a) => { const emp = (await db.query("SELECT id FROM employees WHERE company_id=$1", [actor.companyId]))[0]; const t = await createTask(db, actor, { employeeId: emp.id, title: "t" + i, instruction: `Responde al cliente número ${i}` }); return t; };
const go = async (be: Backend, i = 0) => { const t = await task(i); const r = await runTask(db, a, t, { provider: createRoutedProvider({ db, backends: [be] }), retryDelayMs: 0 } as any); return { t, status: r.status }; };
const lim = (o: any = {}) => ({ plan: "t", monthly_credits: 1e9, monthly_budget_usd: 100, max_offices: 1, allowed_tiers: ["free", "economy", "premium"] as any, max_level: "C" as const, max_task_usd: 1, ...o });
const route = (models: any[], o: any = {}) => planRoute(models, { meta: { level: "B", sensitivity: "internal", needsTools: false, needsJson: false }, limit: lim(), settings: DEFAULT_SETTINGS, estIn: 3000, maxOut: 2000, remainingUsd: 100, taskRemainingUsd: 100, ...o });

describe("máximo por llamada (configuración de prueba controlada: US$ 0.05)", () => {
  it("el modelo cuyo costo MÁXIMO supera US$0.05 queda excluido; el barato entra; el margen cuenta", async () => {
    await saveModel(db, OP, M("barato", "0.10", "0.50")); await saveModel(db, OP, M("caro", "15", "75")); const models = await listModels(db);
    const p = route(models, { settings: { ...DEFAULT_SETTINGS, maxCallUsd: 0.05 } }); expect(p.candidates.map((c) => c.model.id)).toEqual(["barato"]); expect(p.excluded.find((e) => e.id === "caro")!.reason).toMatch(/supera el presupuesto disponible/);
    expect(p.candidates[0].maxCostUsd).toBeCloseTo((3000 * COST_MARGIN * 0.1 + 2000 * 0.5) / 1e6, 10); // margen del 25 % sobre la entrada
  });
  it("el tope de la llamada es el MÍNIMO entre el de reglas, lo que queda de la tarea y lo que queda del mes", async () => {
    await saveModel(db, OP, M("m", "1", "5")); const models = await listModels(db); const costo = (3000 * COST_MARGIN * 1 + 2000 * 5) / 1e6; // ≈ 0.01375
    expect(route(models, { settings: { ...DEFAULT_SETTINGS, maxCallUsd: costo + 0.001 } }).candidates).toHaveLength(1); expect(route(models, { settings: { ...DEFAULT_SETTINGS, maxCallUsd: costo - 0.001 } }).candidates).toHaveLength(0);
    expect(route(models, { taskRemainingUsd: costo - 0.001 }).candidates).toHaveLength(0); expect(route(models, { remainingUsd: costo - 0.001 }).candidates).toHaveLength(0);
  });
  it("la configuración de prueba (0.05 y 2 intentos) cambia SOLO las reglas: cuotas de planes intactas", async () => {
    const antes = JSON.stringify(await listPlanLimits(db)); await updateSettings(db, OP, { maxCallUsd: 0.05, maxAttempts: 2 }); expect(await getSettings(db)).toMatchObject({ maxCallUsd: 0.05, maxAttempts: 2 }); expect(JSON.stringify(await listPlanLimits(db))).toBe(antes);
  });
});
describe("precio de catálogo vs. precio real: el límite se aplica en la API, no solo en el cálculo", () => {
  it("a OpenRouter se le envía max_price = precio de catálogo × margen, y proveedores fijados", async () => {
    await saveModel(db, OP, M("m", "0.10", "0.50")); await go(new Fake()); expect(seen[0].opts.maxPrice).toEqual({ in: 0.1 * COST_MARGIN, out: 0.5 * COST_MARGIN }); expect(seen[0].opts.allowedProviders).toEqual(["amazon-bedrock"]);
  });
  it("la reserva usa el costo máximo CON margen (≥ lo que costaría al precio de catálogo)", async () => {
    await saveModel(db, OP, M("m", "0.10", "0.50")); await go(new Fake()); const r = (await db.query("SELECT usd::float u FROM ai_reservations"))[0]; expect(r.u).toBeGreaterThan(0); expect(r.u).toBeGreaterThanOrEqual((1000 * 0.1 + 400 * 0.5) / 1e6);
  });
  it("si el costo REAL supera el estimado se registra la advertencia y se liquida lo REAL (nada se oculta)", async () => {
    await saveModel(db, OP, M("m", "0.10", "0.50")); const { status } = await go(new Fake(() => ({ costUsd: 0.5 }))); expect(status).toBe("completed");
    const c = (await db.query("SELECT cost_usd::float c, fallback_reason, cost_source FROM ai_calls"))[0]; expect(c.c).toBe(0.5); expect(c.cost_source).toBe("proveedor"); expect(c.fallback_reason).toMatch(/superó el máximo estimado/); expect((await quotaStatus(db, await accountOf(db, a.companyId))).usdUsed).toBeCloseTo(0.5, 8);
  });
  it("sin costo del proveedor se estima con el precio del catálogo y se marca como «estimado»", async () => { await saveModel(db, OP, M("m", "0.10", "0.50")); await go(new Fake()); const c = (await db.query("SELECT cost_usd::float c, cost_source FROM ai_calls"))[0]; expect(c.cost_source).toBe("estimado"); expect(c.c).toBeCloseTo((1000 * 0.1 + 200 * 0.5) / 1e6, 10); });
});
describe("reservas, liquidación y reintentos", () => {
  it("una llamada fallida libera su reserva (no queda dinero retenido) y no cobra", async () => {
    await saveModel(db, OP, M("m", "0.10", "0.50")); await updateSettings(db, OP, { maxAttempts: 1 }); const { status } = await go(new Fake(() => "transient")); expect(status).toBe("failed"); const q = await quotaStatus(db, await accountOf(db, a.companyId)); expect(q.creditsReserved).toBe(0); expect(q.usdUsed).toBe(0); expect((await db.query("SELECT status FROM ai_reservations")).map((r: any) => r.status)).toEqual(["released"]);
  });
  it("reintento tras fallo transitorio: dos intentos registrados, solo el exitoso se cobra, tope de intentos respetado", async () => {
    await saveModel(db, OP, M("a", "0.10", "0.50")); await saveModel(db, OP, M("b", "0.12", "0.60")); await updateSettings(db, OP, { maxAttempts: 2 }); const { status } = await go(new Fake((m) => (m === "v/a" ? "transient" : {})));
    expect(status).toBe("completed"); expect((await db.query("SELECT status FROM ai_calls ORDER BY attempt")).map((r: any) => r.status)).toEqual(["transitorio", "ok"]); expect(seen.map((s) => s.model)).toEqual(["v/a", "v/b"]);
  });
  it("máximo de intentos: con 2 intentos y 3 modelos fallando NO hay un tercer intento", async () => {
    for (const id of ["a", "b", "c"]) await saveModel(db, OP, M(id, "0.10", "0.50")); await updateSettings(db, OP, { maxAttempts: 2 }); const { status } = await go(new Fake(() => "transient")); expect(status).toBe("failed"); expect(seen).toHaveLength(2);
  });
  it("tope por TAREA: las respuestas inválidas ya cobradas cuentan; al agotarse se detiene sin llamar de más", async () => {
    await saveModel(db, OP, M("a", "100", "300")); await saveModel(db, OP, M("b", "100", "301")); await updateSettings(db, OP, { maxCallUsd: 1, maxAttempts: 3 }); await db.query("UPDATE agencies SET plan='prueba'"); await updatePlanLimit(db, OP, "prueba", { monthly_credits: "50000000", monthly_budget_usd: "5", max_offices: "1", allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: "0.7" });
    // cada llamada cuesta ≈ US$0.35 reales y devuelve texto corto: la validación exige minChars solo en guiadas, así que forzamos el costo alto
    const be = new Fake(() => ({ costUsd: 0.35 })); const { status } = await go(be); expect(status).toBe("completed"); expect(seen).toHaveLength(1);
  });
});
describe("presupuesto mensual y concurrencia", () => {
  it("el presupuesto mensual se respeta: al agotarse las nuevas tareas se detienen explicando por qué (sin llamar al modelo)", async () => {
    await saveModel(db, OP, M("m", "1", "5")); await db.query("UPDATE agencies SET plan='prueba'"); await updatePlanLimit(db, OP, "prueba", { monthly_credits: "50000000", monthly_budget_usd: "0.025", max_offices: "1", allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: "0.025" });
    const be = new Fake(() => ({ costUsd: 0.01, inputTokens: 100, outputTokens: 50 })); const r1 = await go(be, 1); const r2 = await go(be, 2); const r3 = await go(be, 3); expect([r1.status, r2.status, r3.status]).toEqual(["completed", "completed", "failed"]); expect(seen).toHaveLength(2);
    expect((await db.query("SELECT error FROM tasks WHERE id=$1", [r3.t]))[0].error).toMatch(/límite interno de gasto|presupuesto|cuota/i); expect((await quotaStatus(db, await accountOf(db, a.companyId))).usdUsed).toBeCloseTo(0.02, 8);
  });
  it("llamadas en PARALELO no pueden pasarse del presupuesto (la reserva es atómica)", async () => {
    await saveModel(db, OP, M("m", "1", "5")); await db.query("UPDATE agencies SET plan='prueba'"); await updatePlanLimit(db, OP, "prueba", { monthly_credits: "50000000", monthly_budget_usd: "0.05", max_offices: "1", allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: "0.05" });
    const ids = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => task(i))); const be = new Fake(() => ({ costUsd: 0.01, inputTokens: 300, outputTokens: 100 }));
    const res = await Promise.all(ids.map((t) => runTask(db, a, t, { provider: createRoutedProvider({ db, backends: [be] }), retryDelayMs: 0 } as any))); const done = res.filter((r) => r.status === "completed").length;
    const q = await quotaStatus(db, await accountOf(db, a.companyId)); expect(q.usdUsed + q.usdReserved).toBeLessThanOrEqual(0.05 + 1e-9); expect(done).toBeLessThan(6); expect(done).toBeGreaterThan(0); expect(q.usdReserved).toBe(0);
  });
  it("ANOMALÍA: si un proveedor cobra muy por encima de lo estimado, el modelo se desactiva solo, queda auditado y el exceso se limita a UNA llamada", async () => {
    await saveModel(db, OP, M("mod1", "1", "5")); await saveModel(db, OP, M("mod2", "1.1", "5.5")); await db.query("UPDATE agencies SET plan='prueba'"); await updatePlanLimit(db, OP, "prueba", { monthly_credits: "50000000", monthly_budget_usd: "0.06", max_offices: "1", allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: "0.06" });
    const be = new Fake((m) => (m === "v/mod1" ? { costUsd: 0.04, inputTokens: 100, outputTokens: 50 } : { costUsd: 0.005, inputTokens: 100, outputTokens: 50 })); const r1 = await go(be, 1); expect(r1.status).toBe("completed");
    const m = (await listModels(db)).find((x) => x.id === "mod1")!; expect(m.enabled).toBe(false); expect(m.notes).toMatch(/desactivado automáticamente/); expect((await db.query("SELECT detail FROM audit_log WHERE action='ai.model.auto_disabled'"))).toHaveLength(1);
    const r2 = await go(be, 2); expect(r2.status).toBe("completed"); expect(seen.map((s) => s.model)).toEqual(["v/mod1", "v/mod2"]); // la siguiente tarea ya no usa el modelo desactivado
    expect((await quotaStatus(db, await accountOf(db, a.companyId))).usdUsed).toBeCloseTo(0.045, 8);
  });
});
