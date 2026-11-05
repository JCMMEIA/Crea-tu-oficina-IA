import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { HUMO, HumoAbort, assertSafeBody, buildBody, ceiling, checkBudget, describeKey, estimateInputTokens, resolveBase, sendOnce, worstCaseUsd } from "../scripts/ia/humo_lib";
import { PRICE_MARGIN, INPUT_TOKEN_MARGIN } from "@/server/ai/router";

/**
 * PRUEBA DE HUMO con Sonnet 5.5: UNA llamada, solo Amazon Bedrock us-east-1/eu-west-1, zdr + data_collection=deny + allow_fallbacks=false, max_price con margen, prompt ficticio.
 * Todo contra un servidor HTTP LOCAL: ninguna solicitud real a OpenRouter, costo cero. Los cálculos de tokens son estimaciones conservadoras, no un límite absoluto de facturación.
 */
let srv: http.Server, base = ""; const hits: { method: string; url: string; auth?: string; raw: string; body: any }[] = []; let reply: (url: string) => { status: number; json: any } = () => ok();
const ok = () => ({ status: 200, json: { id: "g", provider: "Amazon Bedrock", choices: [{ message: { role: "assistant", content: "hola" } }], usage: { prompt_tokens: 40, completion_tokens: 2, cost: 0.00011 } } });
beforeEach(async () => { hits.length = 0; reply = () => ok(); srv = http.createServer((req, res) => { let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => { let body: any = null; try { body = raw ? JSON.parse(raw) : null; } catch {} hits.push({ method: req.method ?? "", url: req.url ?? "", auth: req.headers.authorization, raw, body }); const r = reply(req.url ?? ""); res.statusCode = r.status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(r.json)); }); }); await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r())); base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1`; });
afterEach(async () => { await new Promise((r) => srv.close(() => r(null))); });
const KEY = "sk-or-v1-CLAVE-DE-PRUEBA-NO-REAL-0123456789";
const humo = (args: string[], env: Record<string, string | undefined> = {}) => new Promise<{ out: string; code: number | null }>((res) => { const p = spawn("npx", ["tsx", "scripts/ia/prueba_humo.ts", ...args], { env: { ...process.env, OPENROUTER_BASE_URL: base, OPENROUTER_API_KEY: KEY, ...env } as any }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d)); p.on("close", (code) => res({ out: o, code })); });
const AUTH = "--autorizo-una-llamada-facturable";
const EXPECTED = { model: "anthropic/claude-sonnet-5.5", messages: [{ role: "system", content: "Responde solo con la palabra «hola». Es una prueba técnica con datos ficticios." }, { role: "user", content: "Prueba técnica ficticia: di «hola»." }], max_tokens: 16,
  provider: { allow_fallbacks: false, data_collection: "deny", zdr: true, only: ["amazon-bedrock/us-east-1", "amazon-bedrock/eu-west-1"], max_price: { prompt: 2.75, completion: 13.75 } } };

describe("cuerpo EXACTO de la solicitud", () => {
  it("buildBody es exactamente lo autorizado (modelo, prompt ficticio, 16 tokens, privacidad, proveedores y tope de precio ×1.25 sobre 2.20/11)", () => { expect(buildBody()).toStrictEqual(EXPECTED); expect(ceiling()).toEqual({ prompt: 2.75, completion: 13.75 }); expect(HUMO.priceUsdMtok).toEqual({ in: 2.2, out: 11 }); });
  it("con --autorizo… el servidor local recibe EXACTAMENTE una solicitud con ese cuerpo, sin herramientas, sin reintentos y con la clave solo en el encabezado", async () => {
    const r = await humo([AUTH]); expect(r.code, r.out).toBe(0); expect(hits).toHaveLength(1); expect(hits[0].method).toBe("POST"); expect(hits[0].url).toBe("/api/v1/chat/completions"); expect(hits[0].body).toStrictEqual(EXPECTED); expect(hits[0].auth).toBe(`Bearer ${KEY}`);
    expect(hits[0].raw).not.toContain(KEY); expect(Object.keys(hits[0].body)).not.toContain("tools"); expect(r.out).not.toContain(KEY); expect(r.out).toMatch(/✅ Respondió/); expect(r.out).toMatch(/Amazon Bedrock/);
  }, 90000);
  it("independiente del router: se ejecuta con AI_ROUTER=off o sin definir, sin base de datos y sin Sonnet en el catálogo", async () => { for (const v of ["off", undefined]) { hits.length = 0; const r = await humo([AUTH], { AI_ROUTER: v, DATABASE_URL: "" }); expect(r.code, r.out).toBe(0); expect(hits).toHaveLength(1); } }, 120000);
});
describe("jamás se envía si falta una restricción (assertSafeBody + sendOnce)", () => {
  const mut = (f: (b: any) => void) => { const b = JSON.parse(JSON.stringify(buildBody())); f(b); return b; };
  const casos: [string, (b: any) => void][] = [
    ["sin zdr", (b) => { delete b.provider.zdr; }], ["zdr=false", (b) => { b.provider.zdr = false; }], ["sin data_collection", (b) => { delete b.provider.data_collection; }], ['data_collection="allow"', (b) => { b.provider.data_collection = "allow"; }],
    ["sin allow_fallbacks", (b) => { delete b.provider.allow_fallbacks; }], ["allow_fallbacks=true", (b) => { b.provider.allow_fallbacks = true; }], ["sin only", (b) => { delete b.provider.only; }], ["only vacío", (b) => { b.provider.only = []; }],
    ["only con el slug base (todas las regiones)", (b) => { b.provider.only = ["amazon-bedrock"]; }], ["only con un proveedor extra", (b) => { b.provider.only.push("google-vertex/global"); }], ["solo una región", (b) => { b.provider.only = ["amazon-bedrock/us-east-1"]; }],
    ["sin max_price", (b) => { delete b.provider.max_price; }], ["max_price de salida más alto", (b) => { b.provider.max_price.completion = 20; }], ["max_price de entrada más alto", (b) => { b.provider.max_price.prompt = 5; }], ["sin provider", (b) => { delete b.provider; }],
    ["otro modelo", (b) => { b.model = "anthropic/claude-opus-5.5"; }], ["con herramientas", (b) => { b.tools = [{ type: "function", function: { name: "x", parameters: {} } }]; }], ["con lista de modelos alternativos", (b) => { b.models = ["a/b"]; }], ["con plugins", (b) => { b.plugins = [{ id: "web" }]; }],
    ["más tokens de salida", (b) => { b.max_tokens = 4096; }], ["sin límite de salida", (b) => { delete b.max_tokens; }], ["otro prompt", (b) => { b.messages[1].content = "Resume los datos reales del cliente Juan Pérez"; }], ["un mensaje de más", (b) => { b.messages.push({ role: "user", content: "x" }); }], ["clave extra en provider", (b) => { b.provider.sort = "price"; }],
  ];
  it.each(casos)("%s → se detecta y NO se envía ninguna petición", async (_n, f) => {
    const b = mut(f); expect(assertSafeBody(b).length).toBeGreaterThan(0); let llamadas = 0; const spy = (async () => { llamadas++; return new Response("{}"); }) as unknown as typeof fetch;
    await expect(sendOnce(b, { base: "http://127.0.0.1:1/api/v1", key: KEY, fetchImpl: spy })).rejects.toBeInstanceOf(HumoAbort); expect(llamadas).toBe(0);
  });
  it("el cuerpo correcto sí se envía, una sola vez", async () => { let llamadas = 0; const spy = (async () => { llamadas++; return new Response(JSON.stringify({ choices: [] }), { status: 200 }); }) as unknown as typeof fetch; await sendOnce(buildBody(), { base: "http://127.0.0.1:1/api/v1", key: KEY, fetchImpl: spy }); expect(llamadas).toBe(1); });
  it("sin clave no se envía nada", async () => { let llamadas = 0; const spy = (async () => { llamadas++; return new Response("{}"); }) as unknown as typeof fetch; await expect(sendOnce(buildBody(), { base: "http://127.0.0.1:1/api/v1", key: "", fetchImpl: spy })).rejects.toMatchObject({ code: 4 }); expect(llamadas).toBe(0); });
});
describe("presupuesto de US$0.01: se calcula un peor caso conservador ANTES de llamar", () => {
  it("el peor caso usa el tope de precio ×1.25 en entrada y salida y es mucho menor que US$0.01", () => {
    const c = ceiling(); const esperado = (estimateInputTokens() * INPUT_TOKEN_MARGIN * c.prompt + HUMO.maxTokens * c.completion) / 1e6; expect(worstCaseUsd()).toBeCloseTo(esperado, 12); expect(worstCaseUsd()).toBeLessThan(0.001); expect(checkBudget().ok).toBe(true);
    // con tarifas a precio de catálogo (sin margen) el peor caso sería menor: el margen está aplicado a entrada Y salida
    expect(worstCaseUsd()).toBeGreaterThan((estimateInputTokens() * 2.2 + 16 * 11) / 1e6);
  });
  it("aborta si el peor caso no cabe en el presupuesto (o si se pide más de US$0.01) y no llama a nadie", async () => {
    expect(checkBudget(0.0001).ok).toBe(false); expect(checkBudget(0.05).ok).toBe(false); expect(checkBudget(0).ok).toBe(false); expect(checkBudget(NaN).ok).toBe(false);
    for (const m of ["0.0001", "0.05", "abc"]) { const r = await humo([AUTH, "--max-usd", m]); expect(r.code, r.out).toBe(3); expect(r.out).toMatch(/Se aborta/); } expect(hits).toHaveLength(0);
  }, 120000);
  it("muestra el aviso: las estimaciones no son un límite absoluto de facturación", async () => { const r = await humo([]); expect(r.out).toMatch(/NO un límite absoluto de facturación/); }, 60000);
});
describe("sin autorización expresa solo hay simulación local (cero llamadas)", () => {
  it("sin la bandera: muestra privacidad, proveedores y costo máximo, y no hace ninguna llamada aunque haya clave", async () => {
    const r = await humo([]); expect(r.code, r.out).toBe(0); expect(hits).toHaveLength(0); expect(r.out).toMatch(/SIMULACRO LOCAL/); expect(r.out).toContain("amazon-bedrock/us-east-1, amazon-bedrock/eu-west-1"); expect(r.out).toContain('provider.zdr=true'); expect(r.out).toContain('provider.data_collection="deny"'); expect(r.out).toContain("provider.allow_fallbacks=false");
    expect(r.out).toContain("entrada 2.75 · salida 13.75"); expect(r.out).toMatch(/Costo MÁXIMO estimado: US\$ 0\.000\d+/); expect(r.out).toMatch(/EXACTAMENTE 1/); expect(r.out).toContain("definida (no se muestra)"); expect(r.out).not.toContain(KEY);
  }, 60000);
  it("las banderas antiguas (--confirmo, --modelo) ya NO autorizan nada", async () => { const r = await humo(["--confirmo", "--modelo", "x/y"]); expect(r.code).toBe(0); expect(hits).toHaveLength(0); expect(r.out).toMatch(/SIMULACRO LOCAL/); }, 60000);
  it("sin clave: la simulación funciona; la llamada autorizada se niega sin enviar nada", async () => { let r = await humo([], { OPENROUTER_API_KEY: "" }); expect(r.code).toBe(0); expect(r.out).toMatch(/NO definida/); r = await humo([AUTH], { OPENROUTER_API_KEY: "" }); expect(r.code).toBe(4); expect(hits).toHaveLength(0); }, 90000);
});
describe("errores del proveedor: una sola solicitud, sin reintentos", () => {
  it.each([429, 500, 503, 402, 404])("HTTP %s → exactamente 1 solicitud y código de salida 1", async (st) => { reply = () => ({ status: st, json: { error: { message: "No endpoints found matching your data policy" } } }); const r = await humo([AUTH]); expect(r.code, r.out).toBe(1); expect(hits).toHaveLength(1); expect(r.out).toMatch(/No se reintentó/); expect(r.out).not.toContain(KEY); }, 90000);
  it("si el proveedor informado no es Amazon Bedrock lo advierte; si el costo real supera el máximo estimado lo advierte", async () => { reply = () => ({ status: 200, json: { provider: "Otro", choices: [{ message: { content: "hola" } }], usage: { prompt_tokens: 40, completion_tokens: 2, cost: 0.5 } } }); const r = await humo([AUTH]); expect(r.code).toBe(0); expect(r.out).toMatch(/no parece Amazon Bedrock/); expect(r.out).toMatch(/superó el máximo estimado/); }, 60000);
});
describe("la clave solo se envía a openrouter.ai (o a un servidor local de pruebas)", () => {
  it("resolveBase acepta openrouter.ai y loopback; rechaza cualquier otro destino", () => { expect(resolveBase(undefined)).toBe("https://openrouter.ai/api/v1"); expect(resolveBase("http://127.0.0.1:5555/api/v1")).toContain("127.0.0.1"); expect(() => resolveBase("https://evil.example.com/api/v1")).toThrow(HumoAbort); expect(() => resolveBase("https://openrouter.ai.evil.com/api/v1")).toThrow(HumoAbort); });
  it("con un destino no permitido no se hace ninguna llamada", async () => { const r = await humo([AUTH], { OPENROUTER_BASE_URL: "https://evil.example.com/api/v1" }); expect(r.code).toBe(5); expect(hits).toHaveLength(0); }, 60000);
});
describe("consulta de la clave (solo lectura): ¿tiene guardrail propio? Nunca crea ni asigna", () => {
  it("hace SOLO un GET /key, nunca POST ni /chat/completions, y no imprime la clave", async () => {
    reply = () => ({ status: 200, json: { data: { label: "crea-oficina", limit: 2, limit_reset: null, limit_remaining: 1.5, usage: 0.5, usage_daily: 0.1, budgets: [{ scope: "api_key", guardrail_id: "gr_1", limit_usd: 2, spend_usd: 0.5, remaining_usd: 1.5, reset_interval: "monthly" }] } } });
    const r = await humo(["--consultar-clave"]); expect(r.code, r.out).toBe(0); expect(hits).toHaveLength(1); expect(hits[0].method).toBe("GET"); expect(hits[0].url).toBe("/api/v1/key"); expect(r.out).toMatch(/Guardrail propio de la clave o del espacio: SÍ/); expect(r.out).toMatch(/SOLO LECTURA/); expect(r.out).not.toContain(KEY);
  }, 60000);
  it("describeKey distingue «con guardrail», «solo límite de la clave» y «sin nada»", () => {
    expect(describeKey({ data: { limit: 2, limit_remaining: 2, budgets: [] } }).join(" ")).toMatch(/límite propio de la clave: US\$ 2.*Guardrail propio de la clave: NO/s); expect(describeKey({ data: { limit: null, budgets: [] } }).join(" ")).toMatch(/SIN límite.*NINGUNO/s);
    expect(describeKey({ data: { budgets: [{ scope: "workspace_default_key", guardrail_id: "g", limit_usd: 1, remaining_usd: 1 }] } }).join(" ")).toMatch(/guardrail g/); expect(describeKey(null)[0]).toMatch(/No se pudo/);
  });
});
describe("alcance mínimo y coherencia con el router", () => {
  it("revisión estática: no usa el router, AI_ROUTER, getProvider, la base de datos ni el catálogo; no cambia privacidad global ni límites del panel", () => {
    for (const f of ["scripts/ia/prueba_humo.ts", "scripts/ia/humo_lib.ts"]) { const s = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(s, f).not.toMatch(/createRoutedProvider|getProvider|process\.env\.AI_ROUTER|getDb|server\/ai\/router|server\/ai\/config|server\/models|OpenRouterBackend|ai_models|updateSettings|maxCallUsd/); }
    expect(fs.readFileSync("scripts/ia/humo_lib.ts", "utf8")).not.toMatch(/retry|reintent.*for|while \(/i);
  });
  it("el margen de precio de la prueba coincide con el del router", () => { expect(HUMO.priceMargin).toBe(PRICE_MARGIN); expect(HUMO.inputTokenMargin).toBe(INPUT_TOKEN_MARGIN); });
  it("el límite del panel (US$0.05 por llamada) no se toca: la prueba no importa la configuración", async () => { const { DEFAULT_SETTINGS } = await import("@/server/ai/types"); expect(DEFAULT_SETTINGS.maxCallUsd).toBe(0.5); }); // el valor por defecto del panel no cambió; el 0.05 se aplica con el botón de «prueba controlada»
});
