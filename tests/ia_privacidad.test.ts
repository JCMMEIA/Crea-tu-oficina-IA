import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Db } from "@/server/db";
import { newDb, newCompany } from "./helpers";
import { hireFromTemplate } from "@/server/catalog/office";
import { createTask, runTask } from "@/server/tasks";
import { BackendError, OpenRouterBackend } from "@/server/ai/backends";
import { ensurePlanDefaults, saveModel, updateSettings } from "@/server/ai/config";
import { createRoutedProvider, planRoute } from "@/server/ai/router";
import { DEFAULT_SETTINGS } from "@/server/ai/types";

/**
 * PRIVACIDAD: lo que importa es lo que VIAJA en la solicitud a OpenRouter, no la etiqueta de la base de datos.
 * Documentación oficial consultada (openrouter.ai/docs/guides/routing/provider-selection, 2026-11): `provider.data_collection` ("allow"|"deny"), `provider.zdr` (boolean),
 * `provider.allow_fallbacks` (boolean), `provider.only` (lista de slugs) y `provider.max_price` ({prompt, completion} en US$/M) existen. Servidor HTTP local: sin red real ni costo.
 */
process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test"; const OP = { userId: "op", email: "op@ejemplo.test" }; const KEY = "sk-or-v1-CLAVE-DE-PRUEBA-NO-REAL-0123456789";
let srv: http.Server, base = ""; const hits: any[] = []; let respond: (b: any) => { status: number; json: any } = () => ok(); let db: Db;
const ok = (text = "Respuesta suficientemente larga para pasar la validación mínima de la tarea de prueba. ".repeat(3)) => ({ status: 200, json: { provider: "Amazon Bedrock", choices: [{ message: { role: "assistant", content: text } }], usage: { prompt_tokens: 500, completion_tokens: 100, cost: 0.0002 } } });
beforeEach(async () => { hits.length = 0; respond = () => ok(); srv = http.createServer((req, res) => { let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => { const b = JSON.parse(raw || "{}"); hits.push(b); const r = respond(b); res.statusCode = r.status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(r.json)); }); }); await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r())); base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; db = await newDb(); await db.query("INSERT INTO users(id,email,name,password_hash) VALUES('op','op@ejemplo.test','Op','x') ON CONFLICT DO NOTHING"); await ensurePlanDefaults(db); });
afterEach(async () => { await new Promise((r) => srv.close(() => r(null))); });
const call = (b: OpenRouterBackend, sens: "public" | "internal" | "confidential", o: any = {}) => b.complete("anthropic/claude-haiku-5.5", { system: "S", messages: [{ role: "user", content: "hola" }], tools: [], maxTokens: 100 }, { sensitivity: sens, ...o });
const M = (o: any = {}) => ({ id: "haiku", provider: "openrouter", model_id: "anthropic/claude-haiku-5.5", label: "Haiku 5.5", tier: "economy", max_level: "B", price_in_usd_mtok: "0.10", price_out_usd_mtok: "0.50", context_window: "200000", supports_tools: true, supports_json: true, data_policy: "zero_retention", credit_weight: "1", enabled: true, verified: true, allowed_providers: "amazon-bedrock, google-vertex", ...o });

describe("cuerpo de la solicitud a OpenRouter (lo que realmente se aplica)", () => {
  it("pública: sin filtros de datos, pero SIEMPRE allow_fallbacks=false y con tope de precio", async () => {
    await call(new OpenRouterBackend(KEY, base), "public", { allowedProviders: ["amazon-bedrock"], maxPrice: { in: 0.125, out: 0.625 } });
    expect(hits[0].provider).toEqual({ allow_fallbacks: false, only: ["amazon-bedrock"], max_price: { prompt: 0.125, completion: 0.625 } }); expect(hits[0].provider.data_collection).toBeUndefined(); expect(hits[0].provider.zdr).toBeUndefined();
  });
  it("interna: data_collection=deny + proveedores fijados (only) + sin fallbacks + tope de precio", async () => {
    await call(new OpenRouterBackend(KEY, base), "internal", { allowedProviders: ["amazon-bedrock", "google-vertex"], maxPrice: { in: 0.125, out: 0.625 } });
    expect(hits[0].provider).toEqual({ allow_fallbacks: false, data_collection: "deny", only: ["amazon-bedrock", "google-vertex"], max_price: { prompt: 0.125, completion: 0.625 } });
  });
  it("confidencial: además zdr=true", async () => { await call(new OpenRouterBackend(KEY, base), "confidential", { allowedProviders: ["amazon-bedrock"] }); expect(hits[0].provider).toMatchObject({ allow_fallbacks: false, data_collection: "deny", zdr: true, only: ["amazon-bedrock"] }); });
  it("FALLA CERRADO: información sensible sin proveedores aprobados NO sale (cero solicitudes HTTP)", async () => {
    for (const sens of ["internal", "confidential"] as const) for (const o of [{}, { allowedProviders: [] }]) await expect(call(new OpenRouterBackend(KEY, base), sens, o)).rejects.toMatchObject({ name: "BackendError", code: "bad_request" }); expect(hits).toHaveLength(0);
  });
});
describe("la etiqueta de la base de datos NO basta: sin proveedores aprobados no hay datos sensibles", () => {
  it("un modelo etiquetado «zero_retention» pero sin proveedores aprobados se excluye para interna y confidencial (y se explica)", async () => {
    await saveModel(db, OP, M({ allowed_providers: "" })); const models = [(await (await import("@/server/ai/config")).listModels(db))[0]];
    const lim = { plan: "t", monthly_credits: 1e9, monthly_budget_usd: 100, max_offices: 1, allowed_tiers: ["free", "economy", "premium"] as any, max_level: "C" as const, max_task_usd: 1 };
    for (const sens of ["internal", "confidential"] as const) { const p = planRoute(models, { meta: { level: "A", sensitivity: sens, needsTools: false, needsJson: false }, limit: lim, settings: DEFAULT_SETTINGS, estIn: 1000, maxOut: 500, remainingUsd: 100, taskRemainingUsd: 1 }); expect(p.candidates).toHaveLength(0); expect(p.excluded[0].reason).toMatch(/no tiene proveedores aprobados.*etiqueta/); }
    const pub = planRoute(models, { meta: { level: "A", sensitivity: "public", needsTools: false, needsJson: false }, limit: lim, settings: DEFAULT_SETTINGS, estIn: 1000, maxOut: 500, remainingUsd: 100, taskRemainingUsd: 1 }); expect(pub.candidates).toHaveLength(1); // para datos públicos sí sirve
  });
  it("con proveedores aprobados el mismo modelo sí es elegible para interna", async () => {
    await saveModel(db, OP, M()); const models = await (await import("@/server/ai/config")).listModels(db); const lim = { plan: "t", monthly_credits: 1e9, monthly_budget_usd: 100, max_offices: 1, allowed_tiers: ["economy"] as any, max_level: "C" as const, max_task_usd: 1 };
    expect(planRoute(models, { meta: { level: "B", sensitivity: "internal", needsTools: false, needsJson: false }, limit: lim, settings: DEFAULT_SETTINGS, estIn: 1000, maxOut: 500, remainingUsd: 100, taskRemainingUsd: 1 }).candidates).toHaveLength(1);
  });
});
describe("comportamiento ante errores y ausencia de proveedores elegibles (tarea real con el motor)", () => {
  const run = async (provider: any, instruction = "Responde al cliente: ¿a qué hora abren?") => { const a = await newCompany(db, `a${Math.random().toString(36).slice(2, 6)}@x.com`, "Café Luna"); await db.query("UPDATE agencies SET plan='pro'"); await hireFromTemplate(db, a, "agente-soporte"); const emp = (await db.query("SELECT id FROM employees WHERE company_id=$1", [a.companyId]))[0]; const t = await createTask(db, a, { employeeId: emp.id, title: "t", instruction }); const r = await runTask(db, a, t, { provider, retryDelayMs: 0 } as any); return { r, t, a }; };
  const router = () => createRoutedProvider({ db, backends: [new OpenRouterBackend(KEY, base)] });
  it("el cuerpo de una tarea INTERNA real lleva data_collection=deny y solo los proveedores aprobados", async () => {
    await saveModel(db, OP, M()); const { r } = await run(router()); expect(r.status).toBe("completed"); expect(hits).toHaveLength(1); expect(hits[0].provider).toMatchObject({ allow_fallbacks: false, data_collection: "deny", only: ["amazon-bedrock", "google-vertex"] }); expect(hits[0].provider.max_price.prompt).toBeCloseTo(0.125, 8); expect(hits[0].provider.max_price.completion).toBeCloseTo(0.625, 8); expect(hits[0].model).toBe("anthropic/claude-haiku-5.5");
  });
  it("sin ningún modelo con proveedores aprobados: la tarea se detiene, explica por qué y NO se hace ninguna llamada", async () => {
    await saveModel(db, OP, M({ allowed_providers: "" })); const { r, t } = await run(router()); expect(r.status).toBe("failed"); expect(hits).toHaveLength(0); expect((await db.query("SELECT error FROM tasks WHERE id=$1", [t]))[0].error).toMatch(/proveedores aprobados/);
  });
  it("OpenRouter responde «no hay endpoints que cumplan la política» (404): no se prueba con proveedores no aprobados; pasa al siguiente modelo AUTORIZADO o se detiene", async () => {
    await saveModel(db, OP, M()); await saveModel(db, OP, M({ id: "gemini", model_id: "google/gemini-3.5-flash-lite", label: "Gemini Lite", price_in_usd_mtok: "0.15", price_out_usd_mtok: "1.25", allowed_providers: "google-vertex" }));
    respond = (b) => (b.model.startsWith("anthropic/") ? { status: 404, json: { error: { code: 404, message: "No endpoints found matching your data policy" } } } : ok()); const { r } = await run(router());
    expect(r.status).toBe("completed"); expect(hits.map((h) => h.model)).toEqual(["anthropic/claude-haiku-5.5", "google/gemini-3.5-flash-lite"]); for (const h of hits) { expect(h.provider.only.length).toBeGreaterThan(0); expect(h.provider.allow_fallbacks).toBe(false); expect(h.provider.data_collection).toBe("deny"); }
  });
  it("si el único modelo no tiene endpoints permitidos: se detiene sin gastar y sin reintentar fuera de la lista", async () => {
    await saveModel(db, OP, M()); respond = () => ({ status: 404, json: { error: { message: "No endpoints found" } } }); const { r } = await run(router()); expect(r.status).toBe("failed"); expect(hits).toHaveLength(1); expect((await db.query("SELECT coalesce(sum(cost_usd),0)::float c FROM ai_calls"))[0].c).toBe(0);
  });
  it("sin clave de OpenRouter no se envía nada y se explica", async () => { await saveModel(db, OP, M()); const { r } = await run(createRoutedProvider({ db, backends: [new OpenRouterBackend("", base)] })); expect(r.status).toBe("failed"); expect(hits).toHaveLength(0); });
  it("la clave nunca viaja en el cuerpo ni se guarda en la base", async () => { await saveModel(db, OP, M()); await run(router()); expect(JSON.stringify(hits)).not.toContain(KEY); expect(JSON.stringify(await db.query("SELECT * FROM ai_calls"))).not.toContain(KEY); expect(JSON.stringify(await db.query("SELECT * FROM audit_log"))).not.toContain(KEY); });
});
