import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Db } from "@/server/db";
import { Actor } from "@/server/auth";
import { hireFromTemplate } from "@/server/catalog/office";
import { runGuidedTask } from "@/features/tasks/service";
import { getGuided } from "@/features/tasks/catalog";
import { TransientProviderError } from "@/server/models";
import { BackendError, OpenRouterBackend } from "@/server/ai/backends";
import { ensurePlanDefaults, updateSettings, upsertModel } from "@/server/ai/config";
import { accountOf, quotaStatus } from "@/server/ai/quota";
import { createRoutedProvider } from "@/server/ai/router";
import { newDb, newCompany } from "./helpers";

/**
 * PRUEBA DE CONTRATO. Un servidor HTTP LOCAL imita el formato compatible con OpenAI que supone nuestro adaptador de OpenRouter.
 * Verifica NUESTRO código contra ESE contrato supuesto. NO demuestra que OpenRouter real se comporte así: eso solo lo prueba la prueba real (docs/ia-router/PRUEBA_REAL_OPENROUTER.md).
 */
process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test"; const OP = { userId: "op", email: "op@ejemplo.test" };
const KEY = "sk-or-v1-CLAVE-DE-PRUEBA-NO-REAL-0123456789";
let srv: http.Server; let base = ""; const seen: { path: string; auth: string | undefined; body: any }[] = []; let behavior: Record<string, (b: any) => { status: number; json?: any; raw?: string }> = {};
const ok = (text: string, extra: any = {}) => ({ status: 200, json: { id: "gen-1", provider: "ProveedorX", choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 1200, completion_tokens: 400, ...extra } } });
beforeEach(async () => { seen.length = 0; behavior = {}; srv = http.createServer((req, res) => { let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => { const body = raw ? JSON.parse(raw) : {}; seen.push({ path: req.url ?? "", auth: req.headers.authorization, body }); const r = (behavior[body.model] ?? (() => ok("respuesta")))(body); res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(r.raw ?? JSON.stringify(r.json ?? {})); }); }); await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; });
afterEach(async () => { await new Promise((r) => srv.close(() => r(null))); });
const call = (b: OpenRouterBackend, model: string, sens: "public" | "internal" | "confidential" = "public", extra: any = {}) => b.complete(model, { system: "SYS", messages: [{ role: "user", content: "hola" }], tools: [], maxTokens: 100, ...extra }, { sensitivity: sens });

describe("adaptador de OpenRouter contra el contrato supuesto", () => {
  it("arma la petición: ruta, autenticación, modelo, mensajes, límite de salida, contabilidad de uso y sin fallbacks de proveedor", async () => {
    await call(new OpenRouterBackend(KEY, base), "vendor/modelo"); const s = seen[0];
    expect(s.path).toBe("/chat/completions"); expect(s.auth).toBe(`Bearer ${KEY}`); expect(s.body.model).toBe("vendor/modelo"); expect(s.body.messages[0]).toEqual({ role: "system", content: "SYS" }); expect(s.body.messages[1]).toEqual({ role: "user", content: "hola" });
    expect(s.body.max_tokens).toBe(100); expect(s.body.usage).toBeUndefined(); expect(s.body.provider.allow_fallbacks).toBe(false); expect(s.body.tools).toBeUndefined();
  });
  it("la privacidad viaja según la sensibilidad: pública sin filtro; interna data_collection=deny; confidencial además zdr", async () => {
    const b = new OpenRouterBackend(KEY, base); await call(b, "m", "public"); await call(b, "m", "internal"); await call(b, "m", "confidential");
    expect(seen[0].body.provider.data_collection).toBeUndefined(); expect(seen[0].body.provider.zdr).toBeUndefined(); expect(seen[1].body.provider.data_collection).toBe("deny"); expect(seen[1].body.provider.zdr).toBeUndefined(); expect(seen[2].body.provider).toMatchObject({ data_collection: "deny", zdr: true, allow_fallbacks: false });
  });
  it("herramientas: definición en formato función, historial con tool_calls/tool y respuesta con llamadas analizadas", async () => {
    behavior.t = () => ({ status: 200, json: { choices: [{ message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "meta_ads__get", arguments: '{"a":1}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } } });
    const r = await new OpenRouterBackend(KEY, base).complete("t", { system: "S", messages: [{ role: "user", content: "u" }, { role: "assistant", text: "", toolCalls: [{ id: "c0", name: "x", input: { z: 1 } }] }, { role: "tool", results: [{ id: "c0", content: "ok" }, { id: "c9", content: "falló", isError: true }] }], tools: [{ name: "meta_ads__get", description: "d", input_schema: { type: "object" } }], maxTokens: 50 }, { sensitivity: "public" });
    const b = seen[0].body; expect(b.tools[0]).toEqual({ type: "function", function: { name: "meta_ads__get", description: "d", parameters: { type: "object" } } }); expect(b.messages[2]).toMatchObject({ role: "assistant", content: null, tool_calls: [{ id: "c0", type: "function", function: { name: "x", arguments: '{"z":1}' } }] }); expect(b.messages[3]).toEqual({ role: "tool", tool_call_id: "c0", content: "ok" }); expect(b.messages[4].content).toBe("Error: falló");
    expect(r.toolCalls).toEqual([{ id: "call_1", name: "meta_ads__get", input: { a: 1 } }]); expect(r.text).toBe("");
  });
  it("costo: usa usage.cost si viene como número; si no, el router estima con el precio del catálogo", async () => {
    behavior.c = () => ok("x", { cost: 0.00123 }); const b = new OpenRouterBackend(KEY, base); const r1 = await call(b, "c"); expect(r1.costUsd).toBe(0.00123); expect(r1.providerName).toBe("ProveedorX"); const r2 = await call(b, "sin-costo"); expect(r2.costUsd).toBeUndefined();
    behavior.d = () => ok("x", { cost: "caro" }); expect((await call(b, "d")).costUsd).toBeUndefined(); // un valor no numérico se ignora
  });
  it("tope de gasto (formato oficial verificado 2026-11-04): 403 con limit_source → sin saldo; 402 de presupuesto en vuelo → transitorio", async () => {
    const b = new OpenRouterBackend(KEY, base);
    behavior.e = () => ({ status: 403, json: { error: { code: 403, message: "Budget limit exceeded", metadata: { limit_source: "openrouter_key_limit" } } } });
    await expect(call(b, "e")).rejects.toMatchObject({ name: "BackendError", code: "credits" });
    behavior.e = () => ({ status: 402, json: { error: { code: 402, metadata: { limit_source: "openrouter_in_flight_budget" } } } });
    await expect(call(b, "e")).rejects.toBeInstanceOf(TransientProviderError);
  });
  it("errores: 401/403 → auth; 402 → sin saldo; 400 → solicitud inválida; 408/429/5xx/red/respuesta vacía → transitorio; argumentos de herramienta rotos → inválido", async () => {
    const b = new OpenRouterBackend(KEY, base);
    for (const [st, code] of [[401, "auth"], [402, "credits"], [400, "bad_request"]] as const) { behavior.e = () => ({ status: st, json: { error: { message: "x" } } }); await expect(call(b, "e")).rejects.toMatchObject({ name: "BackendError", code }); }
    for (const st of [408, 429, 500, 502, 503]) { behavior.e = () => ({ status: st, json: {} }); await expect(call(b, "e")).rejects.toBeInstanceOf(TransientProviderError); }
    behavior.e = () => ({ status: 200, json: { choices: [] } }); await expect(call(b, "e")).rejects.toBeInstanceOf(TransientProviderError); behavior.e = () => ({ status: 200, raw: "no es json" }); await expect(call(b, "e")).rejects.toBeInstanceOf(TransientProviderError);
    behavior.e = () => ({ status: 200, json: { choices: [{ message: { content: "", tool_calls: [{ id: "1", function: { name: "n", arguments: "{roto" } }] } }] } }); await expect(call(b, "e")).rejects.toBeInstanceOf(BackendError);
    await expect(call(new OpenRouterBackend(KEY, "http://127.0.0.1:1"), "e")).rejects.toBeInstanceOf(TransientProviderError); // red caída
  });
  it("la clave nunca aparece en los errores ni en los mensajes", async () => {
    behavior.k = () => ({ status: 401, json: { error: { message: `clave ${KEY} inválida` } } }); const e: any = await call(new OpenRouterBackend(KEY, base), "k").catch((x) => x); expect(String(e.message)).not.toContain(KEY);
    expect(new OpenRouterBackend("", base).configured()).toBe(false); expect(new OpenRouterBackend(KEY, base).configured()).toBe(true);
  });
});

describe("router completo sobre el servidor de contrato", () => {
  let db: Db; let a: Actor;
  beforeEach(async () => { db = await newDb(); a = await newCompany(db, "a@x.com", "Café Luna"); await ensurePlanDefaults(db); await db.query("UPDATE agencies SET plan='pro'"); });
  const M = (o: any) => ({ provider: "openrouter", max_level: "B", price_in_usd_mtok: 0.2, price_out_usd_mtok: 0.8, context_window: 100000, supports_tools: true, supports_json: true, data_policy: "no_training", credit_weight: 1, enabled: true, verified: true, notes: "", tier: "economy", ...o });
  const secs = (k: string) => getGuided(k)!.sections.map((s) => `## ${s}\nTexto de ${s} con contenido suficiente.`).join("\n\n");
  it("ejecuta una tarea guiada de punta a punta por HTTP: consumo exacto, costo del proveedor, privacidad enviada y clave ausente de la base", async () => {
    await upsertModel(db, OP, M({ id: "eco", model_id: "vendor/eco", label: "Eco" })); await hireFromTemplate(db, a, "agente-soporte"); behavior["vendor/eco"] = () => ok(secs("responder-cliente"), { cost: 0.0009 });
    const id = await runGuidedTask(db, a, "responder-cliente", { mensaje: "¿Abren el domingo?", canal: "WhatsApp" }, { provider: createRoutedProvider({ db, backends: [new OpenRouterBackend(KEY, base)] }) });
    const g = (await db.query("SELECT status,cost_usd::float c FROM guided_runs WHERE id=$1", [id]))[0]; expect(g.status).toBe("listo"); expect(g.c).toBeCloseTo(0.0009, 8); expect(seen[0].body.provider.data_collection).toBe("deny"); expect(seen[0].body.model).toBe("vendor/eco");
    const st = await quotaStatus(db, await accountOf(db, a.companyId)); expect([st.tokensUsed, st.creditsUsed]).toEqual([1600, 1600]); expect(st.usdUsed).toBeCloseTo(0.0009, 8);
    const dump = JSON.stringify([await db.query("SELECT * FROM ai_calls"), await db.query("SELECT * FROM audit_log"), await db.query("SELECT * FROM tasks")]); expect(dump).not.toContain(KEY);
  });
  it("429 del proveedor → fallback al siguiente modelo registrado; todo queda en ai_calls; sin exceder el presupuesto", async () => {
    await upsertModel(db, OP, M({ id: "eco", model_id: "vendor/eco", label: "Eco" })); await upsertModel(db, OP, M({ id: "eco2", model_id: "vendor/eco2", label: "Eco2", price_out_usd_mtok: 0.9 })); await hireFromTemplate(db, a, "agente-soporte");
    behavior["vendor/eco"] = () => ({ status: 429, json: {} }); behavior["vendor/eco2"] = () => ok(secs("responder-cliente"));
    const id = await runGuidedTask(db, a, "responder-cliente", { mensaje: "hola", canal: "WhatsApp" }, { provider: createRoutedProvider({ db, backends: [new OpenRouterBackend(KEY, base)] }) }); const t = (await db.query("SELECT task_id FROM guided_runs WHERE id=$1", [id]))[0].task_id;
    expect((await db.query("SELECT used_model,status FROM ai_calls WHERE task_id=$1 ORDER BY attempt", [t])).map((r: any) => [r.used_model, r.status])).toEqual([["eco", "transitorio"], ["eco2", "ok"]]);
    expect((await quotaStatus(db, await accountOf(db, a.companyId))).creditsReserved).toBe(0);
  });
  it("sin saldo (402) o clave rechazada (401): la tarea se detiene con explicación y no cobra", async () => {
    await upsertModel(db, OP, M({ id: "eco", model_id: "vendor/eco", label: "Eco" })); await updateSettings(db, OP, { maxAttempts: 1 }); await hireFromTemplate(db, a, "agente-soporte");
    for (const st of [402, 401]) { behavior["vendor/eco"] = () => ({ status: st, json: {} }); const id = await runGuidedTask(db, a, "responder-cliente", { mensaje: `hola ${st}`, canal: "WhatsApp" }, { provider: createRoutedProvider({ db, backends: [new OpenRouterBackend(KEY, base)] }) }); const g = (await db.query("SELECT status,error FROM guided_runs WHERE id=$1", [id]))[0]; expect(g.status).toBe("error"); expect(g.error).toMatch(/intentos|detuvo/i); }
    expect((await quotaStatus(db, await accountOf(db, a.companyId))).tokensUsed).toBe(0);
  });
});
