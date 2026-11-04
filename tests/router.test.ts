import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { Actor } from "@/server/auth";
import { hireFromTemplate, updateProfile } from "@/server/catalog/office";
import { createTask, runTask } from "@/server/tasks";
import { runGuidedTask } from "@/features/tasks/service";
import { getGuided } from "@/features/tasks/catalog";
import { TransientProviderError, type CompleteRequest } from "@/server/models";
import { upsertModel, updatePlanLimit, updateSettings, getSettings, setModelEnabled, listModels, ensurePlanDefaults } from "@/server/ai/config";
import { accountOf, quotaStatus, reserve, settle, release, releaseStale, planOfAccount, periodStart } from "@/server/ai/quota";
import { createRoutedProvider, planRoute, validateOutput } from "@/server/ai/router";
import type { Backend, BackendResult } from "@/server/ai/backends";
import { classifyTask } from "@/server/ai/classify";
import { allRoutingProfiles } from "@/server/ai/profiles";
import { newDb, newCompany } from "./helpers";

process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test";
const OP = { userId: "op", email: "op@ejemplo.test" };
const MODEL = (o: Record<string, unknown>) => ({ provider: "openrouter", max_level: "B", price_in_usd_mtok: 0, price_out_usd_mtok: 0, context_window: 100000, supports_tools: true, supports_json: true, data_policy: "zero_retention", credit_weight: 1, enabled: true, verified: true, notes: "", ...o });
const FREE = MODEL({ id: "libre", model_id: "vendor/libre:free", label: "Libre", tier: "free", data_policy: "may_train", max_level: "A" });
const ECO = MODEL({ id: "eco", model_id: "vendor/eco", label: "Económico", tier: "economy", price_in_usd_mtok: 0.2, price_out_usd_mtok: 0.8, max_level: "B", data_policy: "no_training" });
const PRO = MODEL({ id: "premium", provider: "anthropic", model_id: "claude-x", label: "Premium", tier: "premium", price_in_usd_mtok: 3, price_out_usd_mtok: 15, max_level: "C", data_policy: "zero_retention", credit_weight: 2 });

/** SIMULACIÓN DE PRUEBA de un proveedor: guion por modelo. Solo vive en tests/. */
class FakeBackend implements Backend {
  calls: { model: string; sens: string }[] = []; constructor(public id: "openrouter" | "anthropic", private script: Record<string, (n: number) => Partial<BackendResult> | "transient" | "fatal">) {}
  configured() { return true; }
  private n: Record<string, number> = {};
  async complete(modelId: string, _req: CompleteRequest, o: { sensitivity: string }): Promise<BackendResult> {
    this.calls.push({ model: modelId, sens: o.sensitivity }); this.n[modelId] = (this.n[modelId] ?? 0) + 1; const s = (this.script[modelId] ?? (() => ({})))(this.n[modelId]);
    if (s === "transient") throw new TransientProviderError("429 simulado"); if (s === "fatal") throw new Error("400 simulado");
    return { text: "Respuesta suficientemente larga de prueba para validar el mínimo de caracteres exigido por la tarea. ".repeat(2), toolCalls: [], inputTokens: 1000, outputTokens: 500, ...s };
  }
}
let db: Db; let a: Actor; let b: Actor;
const sections = (key: string) => getGuided(key)!.sections.map((s) => `## ${s}\nContenido de ${s} con texto suficiente.`).join("\n\n");
beforeEach(async () => { db = await newDb(); a = await newCompany(db, "a@x.com", "Café Luna"); b = await newCompany(db, "b@x.com", "Taller Ruiz"); await ensurePlanDefaults(db); await db.query("UPDATE agencies SET plan='pro'"); await updateProfile(db, a, { sector: "Cafetería", tone: "Cercano" }); await updateProfile(db, b, { sector: "Taller", tone: "Serio" }); });
const setup = async (models: Record<string, unknown>[], settings: Record<string, unknown> = {}) => { for (const m of models) await upsertModel(db, OP, m); if (Object.keys(settings).length) await updateSettings(db, OP, settings as any); };
const router = (...be: Backend[]) => createRoutedProvider({ db, backends: be });
const run = async (actor: Actor, key: string, answers: Record<string, string>, provider: any) => runGuidedTask(db, actor, key, answers, { provider });
const RESP = { mensaje: "¿A qué hora abren?", canal: "WhatsApp" };

describe("configuración con validación y auditoría", () => {
  it("rechaza modelos sin verificar activos, gratuitos con precio y de pago sin precio; audita cambios", async () => {
    await expect(upsertModel(db, OP, MODEL({ id: "x1", model_id: "a/b", label: "X", tier: "economy", price_in_usd_mtok: 1, price_out_usd_mtok: 1, verified: false, enabled: true }))).rejects.toThrow();
    await expect(upsertModel(db, OP, MODEL({ id: "x2", model_id: "a/b", label: "X", tier: "free", price_in_usd_mtok: 1 }))).rejects.toThrow();
    await expect(upsertModel(db, OP, MODEL({ id: "x3", model_id: "a/b", label: "X", tier: "economy" }))).rejects.toThrow();
    await expect(upsertModel(db, OP, MODEL({ id: "x4", model_id: "a/b", label: "X", tier: "free", max_level: "C" }))).rejects.toThrow();
    await expect(upsertModel(db, null, ECO)).rejects.toThrow(); // solo operadores
    await upsertModel(db, OP, ECO); await expect(setModelEnabled(db, OP, "eco", false)).resolves.toBeUndefined();
    await upsertModel(db, OP, { ...ECO, id: "nuevo", model_id: "a/n", verified: false, enabled: false }); await expect(setModelEnabled(db, OP, "nuevo", true)).rejects.toThrow(/sin verificar/);
    expect((await db.query("SELECT action FROM audit_log WHERE action LIKE 'ai.%'")).length).toBeGreaterThanOrEqual(3); expect(await listModels(db)).toHaveLength(2);
  });
  it("valida ajustes y límites de plan (el tope por tarea no puede superar el mensual)", async () => {
    await expect(updateSettings(db, OP, { maxAttempts: 99 })).rejects.toThrow(); await updateSettings(db, OP, { maxAttempts: 2 }); expect((await getSettings(db)).maxAttempts).toBe(2);
    await expect(updatePlanLimit(db, OP, "starter", { monthly_credits: 500000, monthly_budget_usd: 1, max_offices: 1, allowed_tiers: ["free"], max_level: "B", max_task_usd: 5 })).rejects.toThrow(/tope por tarea/);
  });
});
describe("selección: el más económico elegible, por nivel y sensibilidad (función pura)", () => {
  const models = [FREE, ECO, PRO] as any[]; const lim = { plan: "t", monthly_credits: 1e6, monthly_budget_usd: 50, max_offices: 1, allowed_tiers: ["free", "economy", "premium"] as any, max_level: "C" as const, max_task_usd: 1 };
  const base = { limit: lim, settings: { maxAttempts: 3, maxCallUsd: 0.5, allowPaidFallback: false, freeForInternal: false, callTimeoutMs: 1000, alertThresholds: [80] }, estIn: 2000, maxOut: 1000, remainingUsd: 10, taskRemainingUsd: 1 };
  const ids = (p: ReturnType<typeof planRoute>) => p.candidates.map((c) => c.model.id);
  it("A pública → gratuito primero; A interna → NO gratuito (política); B → económico; C → premium", () => {
    expect(ids(planRoute(models, { ...base, meta: { level: "A", sensitivity: "public", needsTools: false, needsJson: false } }))[0]).toBe("libre");
    const ai = planRoute(models, { ...base, meta: { level: "A", sensitivity: "internal", needsTools: false, needsJson: false } }); expect(ids(ai)).not.toContain("libre"); expect(ai.excluded.find((e) => e.id === "libre")!.reason).toMatch(/política|gratuitos/);
    expect(ids(planRoute(models, { ...base, meta: { level: "B", sensitivity: "internal", needsTools: false, needsJson: false } }))[0]).toBe("eco");
    expect(ids(planRoute(models, { ...base, meta: { level: "C", sensitivity: "internal", needsTools: false, needsJson: false } }))).toEqual(["premium"]);
  });
  it("confidencial solo a retención cero; el plan limita nivel y tiers; el presupuesto excluye modelos caros", () => {
    expect(ids(planRoute(models, { ...base, meta: { level: "B", sensitivity: "confidential", needsTools: false, needsJson: false } }))).toEqual(["premium"]);
    expect(planRoute(models, { ...base, limit: { ...lim, max_level: "B" }, meta: { level: "C", sensitivity: "public", needsTools: false, needsJson: false } }).candidates).toEqual([]);
    expect(ids(planRoute(models, { ...base, limit: { ...lim, allowed_tiers: ["free"] }, meta: { level: "A", sensitivity: "public", needsTools: false, needsJson: false } }))).toEqual(["libre"]);
    const cheap = planRoute(models, { ...base, remainingUsd: 0.004, meta: { level: "C", sensitivity: "public", needsTools: false, needsJson: false } }); expect(cheap.candidates).toEqual([]); expect(cheap.excluded.find((e) => e.id === "premium")!.reason).toMatch(/presupuesto/);
  });
  it("un modelo con mal historial reciente pasa al final", () => {
    const p = planRoute([ECO, { ...ECO, id: "eco2", price_out_usd_mtok: 0.9 }] as any, { ...base, meta: { level: "B", sensitivity: "internal", needsTools: false, needsJson: false }, perf: { eco: { n: 10, fail: 8 } } }); expect(ids(p)).toEqual(["eco2", "eco"]);
  });
  it("validación de salida: secciones, mínimo, JSON, vacío", () => {
    const r = (text: string) => ({ text, toolCalls: [], inputTokens: 1, outputTokens: 1 });
    expect(validateOutput(r(""), {}).ok).toBe(false); expect(validateOutput(r("abc"), { minChars: 10 }).ok).toBe(false); expect(validateOutput(r("## A\nx"), { sections: ["A", "B"] }).problems[0]).toMatch(/faltan secciones: B/); expect(validateOutput(r("no json"), { json: true }).ok).toBe(false); expect(validateOutput(r('{"a":1}'), { json: true }).ok).toBe(true);
  });
});
describe("ejecución real del motor con el router (proveedores simulados)", () => {
  it("elige el modelo económico, registra todo y liquida el consumo exacto", async () => {
    await setup([FREE, ECO, PRO]); await hireFromTemplate(db, a, "agente-soporte"); const be = new FakeBackend("openrouter", { "vendor/eco": () => ({ text: sections("responder-cliente"), inputTokens: 1500, outputTokens: 400, costUsd: 0.00062 }) });
    const id = await run(a, "responder-cliente", RESP, router(be)); const gr = (await db.query("SELECT task_id,status,cost_usd::float c,input_tokens i,output_tokens o FROM guided_runs WHERE id=$1", [id]))[0]; expect(gr.status).toBe("listo");
    expect(be.calls.map((c) => c.model)).toEqual(["vendor/eco"]); expect(be.calls[0].sens).toBe("internal"); // la ficha del negocio hace la tarea «interna»: nunca llega a un modelo gratuito
    const call = (await db.query("SELECT * FROM ai_calls WHERE task_id=$1", [gr.task_id]))[0]; expect([call.requested_model, call.used_model, call.provider, call.status, call.level, call.sensitivity, call.attempt, call.cost_source]).toEqual(["eco", "eco", "openrouter", "ok", "A", "internal", 1, "proveedor"]);
    expect(Number(call.cost_usd)).toBeCloseTo(0.00062, 8); expect([call.input_tokens, call.output_tokens]).toEqual([1500, 400]); expect(gr.c).toBeCloseTo(0.00062, 8);
    const st = await quotaStatus(db, await accountOf(db, a.companyId)); expect(st.creditsUsed).toBe(1900); expect(st.creditsReserved).toBe(0); expect(st.usdUsed).toBeCloseTo(0.00062, 8); expect(st.tokensUsed).toBe(1900);
    expect((await db.query("SELECT kind FROM task_events WHERE task_id=$1 AND kind='routed'", [gr.task_id])).length).toBe(1);
  });
  it("fallback: si el económico falla pasa al premium autorizado y registra el motivo", async () => {
    await setup([ECO, PRO]); await hireFromTemplate(db, a, "agente-soporte");
    const or = new FakeBackend("openrouter", { "vendor/eco": () => "transient" }); const an = new FakeBackend("anthropic", { "claude-x": () => ({ text: sections("responder-cliente"), inputTokens: 1000, outputTokens: 300 }) });
    const id = await run(a, "responder-cliente", RESP, router(or, an)); const t = (await db.query("SELECT task_id FROM guided_runs WHERE id=$1", [id]))[0].task_id;
    const calls = await db.query("SELECT attempt,used_model,status,fallback_reason,credits FROM ai_calls WHERE task_id=$1 ORDER BY attempt", [t]); expect(calls.map((c: any) => [c.attempt, c.used_model, c.status])).toEqual([[1, "eco", "transitorio"], [2, "premium", "ok"]]); expect(calls[0].fallback_reason).toMatch(/429/); expect(Number(calls[1].credits)).toBe(2600); // 1300 tokens × peso 2
    expect(an.calls).toHaveLength(1);
  });
  it("respuesta inválida (faltan secciones) → otro modelo; ambos intentos quedan registrados y cobrados", async () => {
    await setup([ECO, PRO]); await hireFromTemplate(db, a, "agente-soporte");
    const or = new FakeBackend("openrouter", { "vendor/eco": () => ({ text: "## Respuesta sugerida\n" + "texto ".repeat(40) }) }); const an = new FakeBackend("anthropic", { "claude-x": () => ({ text: sections("responder-cliente") }) });
    const id = await run(a, "responder-cliente", RESP, router(or, an)); const t = (await db.query("SELECT task_id FROM guided_runs WHERE id=$1", [id]))[0].task_id;
    const c = await db.query("SELECT status,fallback_reason FROM ai_calls WHERE task_id=$1 ORDER BY attempt", [t]); expect(c.map((x: any) => x.status)).toEqual(["invalida", "ok"]); expect(c[0].fallback_reason).toMatch(/faltan secciones/);
  });
  it("un gratuito que falla NO escala a un modelo de pago sin la regla de la cuenta; con la regla sí, con reserva", async () => {
    await setup([FREE, ECO]); await hireFromTemplate(db, a, "operaciones-x" as any).catch(() => {}); await db.query("UPDATE companies SET profile='{}'::jsonb WHERE id=$1", [a.companyId]);
    // tarea pública (sin ficha del negocio) de nivel A: usamos el router directo
    const prov = router(new FakeBackend("openrouter", { "vendor/libre:free": () => "transient", "vendor/eco": () => ({}) })); const meta: any = { companyId: a.companyId, employeeId: null, taskId: null, level: "A", sensitivity: "public", needsTools: false, needsJson: false, reasons: [] };
    await expect(prov.complete({ system: "s", messages: [{ role: "user", content: "hola" }], tools: [], maxTokens: 200, meta })).rejects.toThrow(/Se detuvo|ningún modelo|No quedó/i);
    await updateSettings(db, OP, { allowPaidFallback: true }); const prov2 = router(new FakeBackend("openrouter", { "vendor/libre:free": () => "transient", "vendor/eco": () => ({}) })); const r = await prov2.complete({ system: "s", messages: [{ role: "user", content: "hola" }], tools: [], maxTokens: 200, meta }); expect(r.model).toBe("eco");
  });
  it("el fallback nunca supera el presupuesto: sin alternativa válida se detiene con explicación y sin gastar más", async () => {
    await setup([ECO, PRO]); await hireFromTemplate(db, a, "analista-estrategico"); await db.query("UPDATE ai_plan_limits SET monthly_budget_usd=0.01, max_task_usd=0.01 WHERE plan='pro'"); 
    const or = new FakeBackend("openrouter", { "vendor/eco": () => "transient" }); const an = new FakeBackend("anthropic", { "claude-x": () => ({}) });
    const t = await createTask(db, a, { employeeId: (await db.query("SELECT id FROM employees WHERE company_id=$1", [a.companyId]))[0].id, title: "x", instruction: "Haz un análisis estratégico completo " + "de mi negocio ".repeat(40) });
    const res = await runTask(db, a, t, { provider: router(or, an) }); expect(res.status).toBe("failed"); const task = (await db.query("SELECT error FROM tasks WHERE id=$1", [t]))[0]; expect(task.error).toMatch(/nivel C|plan|presupuesto|Ningún modelo|No quedó/i);
    expect(an.calls).toHaveLength(0); // el premium nunca se llamó: superaba el tope
  });
  it("sin modelos activos no se ejecuta nada y lo explica; sin proveedor configurado salta al siguiente", async () => {
    await hireFromTemplate(db, a, "agente-soporte"); const id = await run(a, "responder-cliente", RESP, router(new FakeBackend("openrouter", {}))); const g = (await db.query("SELECT status,error FROM guided_runs WHERE id=$1", [id]))[0]; expect(g.status).toBe("error"); expect(g.error).toMatch(/No hay modelos de IA activos/);
    await setup([ECO, PRO]); const dead: Backend = { id: "openrouter", configured: () => false, complete: async () => { throw new Error("no debe llamarse"); } }; const an = new FakeBackend("anthropic", { "claude-x": () => ({ text: sections("responder-cliente") }) });
    const id2 = await run(a, "responder-cliente", { ...RESP, mensaje: "otra pregunta distinta" }, router(dead, an)); expect((await db.query("SELECT status FROM guided_runs WHERE id=$1", [id2]))[0].status).toBe("listo");
  });
  it("máximo de intentos: no hay bucles entre modelos", async () => {
    await setup([ECO, { ...ECO, id: "eco2", model_id: "vendor/eco2" }, { ...ECO, id: "eco3", model_id: "vendor/eco3" }, { ...ECO, id: "eco4", model_id: "vendor/eco4" }], { maxAttempts: 2 }); await hireFromTemplate(db, a, "agente-soporte");
    const be = new FakeBackend("openrouter", { "vendor/eco": () => "transient", "vendor/eco2": () => "transient", "vendor/eco3": () => "transient", "vendor/eco4": () => "transient" });
    const id = await run(a, "responder-cliente", RESP, router(be)); expect(be.calls).toHaveLength(2); expect((await db.query("SELECT error FROM guided_runs WHERE id=$1", [id]))[0].error).toMatch(/2 intentos/);
    expect((await quotaStatus(db, await accountOf(db, a.companyId))).creditsReserved).toBe(0); // todo se liberó
  });
  it("las herramientas no se repiten por culpa del fallback (el motor las ejecuta fuera del router)", async () => {
    await setup([ECO, PRO]); const emp = await hireFromTemplate(db, a, "analista-meta-ads"); let tool = 0; void tool; void emp;
    const be = new FakeBackend("openrouter", { "vendor/eco": (n) => (n === 1 ? { text: "", toolCalls: [{ id: "c1", name: "meta_ads__get_campaigns", input: {} }] } : "transient") }); const an = new FakeBackend("anthropic", { "claude-x": () => ({ text: "Resumen final con suficiente texto para pasar la validación mínima de longitud. ".repeat(2) }) });
    const t = await createTask(db, a, { employeeId: emp, title: "x", instruction: "revisa mis campañas" }); await runTask(db, a, t, { provider: router(be, an), adapter: { id: "f", configured: () => true, initiate: async () => ({ redirectUrl: "", externalId: "" }), status: async () => ({ active: true }), execute: async () => { tool++; return { ok: true, data: {} }; }, revoke: async () => {} } as any });
    expect(tool).toBeLessThanOrEqual(1); expect(an.calls.length + be.calls.length).toBeGreaterThanOrEqual(2);
  });
});
const ensureLimit = async () => { /* los límites por defecto ya existen tras la primera lectura */ await planOfAccount(db, "company:x").catch(() => {}); };

describe("cuotas, reservas y concurrencia", () => {
  const lim = (o: Record<string, unknown> = {}) => ({ plan: "t", monthly_credits: 1000, monthly_budget_usd: 1, max_offices: 1, allowed_tiers: ["free", "economy", "premium"] as any, max_level: "C" as const, max_task_usd: 1, ...o });
  it("reserva atómica: 20 reservas en paralelo nunca superan el límite", async () => {
    const acc = "cuenta-1"; const rs = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(db, { accountId: acc, credits: 100, usd: 0.05, limit: lim() })));
    const okN = rs.filter((r) => r.status === "fulfilled").length; expect(okN).toBe(10); const st = await quotaStatus(db, acc); expect(st.creditsReserved).toBe(1000); expect(st.creditsReserved + st.creditsUsed).toBeLessThanOrEqual(1000);
    for (const r of rs) if (r.status === "rejected") expect((r.reason as any).name).toBe("QuotaError");
  });
  it("liquidar usa el consumo real, es idempotente y liberar devuelve la cuota; el tope por tarea y el gasto USD también bloquean", async () => {
    const acc = "cuenta-2"; const r = await reserve(db, { accountId: acc, credits: 500, usd: 0.2, limit: lim() }); await settle(db, r, { credits: 120, usd: 0.01, tokens: 100 }); await settle(db, r, { credits: 120, usd: 0.01, tokens: 100 }); await release(db, r);
    let st = await quotaStatus(db, acc); expect([st.creditsUsed, st.creditsReserved, st.tokensUsed, st.calls]).toEqual([120, 0, 100, 1]); expect(st.usdUsed).toBeCloseTo(0.01, 6);
    await expect(reserve(db, { accountId: acc, credits: 10, usd: 2, limit: lim({ max_task_usd: 0.5 }) })).rejects.toMatchObject({ code: "quota_task" });
    await expect(reserve(db, { accountId: acc, credits: 10, usd: 0.995, limit: lim({ monthly_budget_usd: 1 }) })).rejects.toMatchObject({ code: "quota_usd" });
    const r2 = await reserve(db, { accountId: acc, credits: 100, usd: 0.1, limit: lim() }); await release(db, r2); st = await quotaStatus(db, acc); expect(st.creditsReserved).toBe(0);
  });
  it("reservas huérfanas se liberan; los créditos pesan por modelo", async () => {
    const acc = "cuenta-3"; await reserve(db, { accountId: acc, credits: 300, usd: 0.1, limit: lim() }); await db.query("UPDATE ai_reservations SET created_at = now() - interval '2 hours'"); expect(await releaseStale(db, 30)).toBe(1); expect((await quotaStatus(db, acc)).creditsReserved).toBe(0);
  });
  it("la cuota se comparte entre las oficinas de una cuenta y se aísla entre cuentas", async () => {
    expect(await accountOf(db, a.companyId)).not.toBe(await accountOf(db, b.companyId)); const accA = await accountOf(db, a.companyId); await reserve(db, { accountId: accA, credits: 100, usd: 0.01, limit: lim() });
    expect((await quotaStatus(db, await accountOf(db, b.companyId))).creditsReserved).toBe(0); expect(periodStart(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-01");
  });
  it("bloqueo por cuota: al agotar los créditos la tarea se detiene con mensaje claro y sin llamar a ningún modelo", async () => {
    await setup([ECO]); await hireFromTemplate(db, a, "agente-soporte"); const acc = await accountOf(db, a.companyId); await quotaStatus(db, acc);
    await db.query("UPDATE ai_plan_limits SET monthly_credits=2000 WHERE plan='pro'"); await db.query("UPDATE ai_accounts SET credits_used=1900 WHERE account_id=$1", [acc]);
    const be = new FakeBackend("openrouter", {}); const id = await run(a, "responder-cliente", RESP, router(be)); const g = (await db.query("SELECT status,error FROM guided_runs WHERE id=$1", [id]))[0];
    expect(g.status).toBe("error"); expect(g.error).toMatch(/tokens incluidos/); expect(be.calls).toHaveLength(0);
  });
  it("alertas al 80 % y 100 %, una sola vez por mes", async () => {
    await setup([ECO]); await hireFromTemplate(db, a, "agente-soporte"); const acc = await accountOf(db, a.companyId); await quotaStatus(db, acc); await db.query("UPDATE ai_plan_limits SET monthly_credits=5000 WHERE plan='pro'");
    const be = new FakeBackend("openrouter", { "vendor/eco": () => ({ text: sections("responder-cliente"), inputTokens: 3500, outputTokens: 1500 }) }); await run(a, "responder-cliente", RESP, router(be));
    expect((await db.query("SELECT threshold FROM ai_alerts WHERE account_id=$1 ORDER BY threshold", [acc])).map((r: any) => r.threshold)).toEqual([80, 100]);
  });
});
describe("aislamiento y protección de datos", () => {
  it("el contexto de una oficina nunca llega a la llamada de otra y la sensibilidad viaja al proveedor", async () => {
    await setup([ECO]); await hireFromTemplate(db, a, "agente-soporte"); await hireFromTemplate(db, b, "agente-soporte"); const seen: string[] = [];
    const be: Backend = { id: "openrouter", configured: () => true, complete: async (_m, req) => { seen.push(req.system + JSON.stringify(req.messages)); return { text: sections("responder-cliente"), toolCalls: [], inputTokens: 100, outputTokens: 50 }; } };
    await run(a, "responder-cliente", RESP, router(be)); await run(b, "responder-cliente", { ...RESP, mensaje: "otra duda" }, router(be));
    expect(seen[0]).toContain("Café Luna"); expect(seen[0]).not.toContain("Taller Ruiz"); expect(seen[1]).toContain("Taller Ruiz"); expect(seen[1]).not.toContain("Café Luna");
    expect((await quotaStatus(db, await accountOf(db, a.companyId))).tokensUsed).toBe(150); expect((await db.query("SELECT DISTINCT company_id FROM ai_calls WHERE account_id=$1", [await accountOf(db, b.companyId)])).map((r: any) => r.company_id)).toEqual([b.companyId]);
  });
  it("información confidencial (finanzas) solo va a modelos con retención cero", async () => {
    await setup([ECO, PRO]); await hireFromTemplate(db, a, "analista-gastos"); const or = new FakeBackend("openrouter", { "vendor/eco": () => ({}) }); const an = new FakeBackend("anthropic", { "claude-x": () => ({ text: "## Resumen\n" + "análisis ".repeat(60) }) });
    const t = await createTask(db, a, { employeeId: (await db.query("SELECT id FROM employees WHERE company_id=$1", [a.companyId]))[0].id, title: "x", instruction: "clasifica estos gastos del mes" }); await db.query("UPDATE ai_plan_limits SET max_task_usd=0.9, monthly_budget_usd=5 WHERE plan='pro'");
    await runTask(db, a, t, { provider: router(or, an) }); expect(or.calls).toHaveLength(0); expect(an.calls[0].sens).toBe("confidential");
  });
  it("clasificación explicable: nivel y sensibilidad con motivos; 41 perfiles de enrutamiento", async () => {
    const emp = await hireFromTemplate(db, a, "analista-estrategico"); const t = await createTask(db, a, { employeeId: emp, title: "x", instruction: "Haz un análisis estratégico " + "de mercado ".repeat(60) }); const task = (await db.query("SELECT * FROM tasks WHERE id=$1", [t]))[0];
    const m = await classifyTask(db, task as any, { toolCount: 0, contextChars: 5000, brainFields: 2 }); expect(m.level).toBe("C"); expect(m.sensitivity).toBe("confidential"); expect(m.reasons.length).toBeGreaterThan(1);
    const ps = allRoutingProfiles(); expect(ps).toHaveLength(41); for (const p of ps) { expect(["A", "B", "C"]).toContain(p.level); expect(["public", "internal", "confidential"]).toContain(p.sensitivity); }
  });
});
