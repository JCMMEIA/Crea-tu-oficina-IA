import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";

/** La prueba de humo es INDEPENDIENTE del router: usa solo el adaptador de OpenRouter, con AI_ROUTER apagado, y hace como máximo UNA llamada. Servidor local, sin red real. */
let srv: http.Server, base = "", hits: { auth?: string; body: any }[] = [];
beforeEach(async () => { hits = []; srv = http.createServer((req, res) => { let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => { hits.push({ auth: req.headers.authorization, body: JSON.parse(raw || "{}") }); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ id: "g", provider: "P", choices: [{ message: { role: "assistant", content: "hola" } }], usage: { prompt_tokens: 20, completion_tokens: 3, cost: 0.000003 } })); }); }); await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r())); base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1`; });
afterEach(async () => { await new Promise((r) => srv.close(() => r(null))); });
const KEY = "sk-or-v1-CLAVE-DE-PRUEBA-NO-REAL-0123456789";
const humo = (args: string[], env: Record<string, string | undefined> = {}) => new Promise<{ out: string; code: number | null }>((res) => { const p = spawn("npx", ["tsx", "scripts/ia/prueba_humo.ts", ...args], { env: { ...process.env, OPENROUTER_BASE_URL: base, AI_ROUTER: "off", OPENROUTER_API_KEY: KEY, ...env } as any }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d)); p.on("close", (code) => res({ out: o, code })); });
const M = ["--modelo", "anthropic/claude-haiku-5.5", "--precio-in", "0.10", "--precio-out", "0.50"];
describe("prueba de humo de UNA llamada (US$0.01 máx.), sin activar el router", () => {
  it("sin --confirmo es un simulacro: no hace ninguna llamada", async () => { const r = await humo(M); expect(r.code).toBe(0); expect(r.out).toMatch(/Simulacro/); expect(hits).toHaveLength(0); }, 60000);
  it("con --confirmo hace EXACTAMENTE una llamada, con la clave del entorno, AI_ROUTER=off y sin imprimir la clave", async () => { const r = await humo([...M, "--confirmo"]); expect(r.code).toBe(0); expect(hits).toHaveLength(1); expect(hits[0].auth).toBe(`Bearer ${KEY}`); expect(hits[0].body.model).toBe("anthropic/claude-haiku-5.5"); expect(hits[0].body.max_tokens).toBe(30); expect(r.out).not.toContain(KEY); expect(r.out).toMatch(/US\$0\.00000/); }, 60000);
  it("rechaza ANTES de llamar si el peor caso supera el tope de US$0.01 (modelo caro)", async () => { const r = await humo(["--modelo", "x/caro", "--precio-in", "500", "--precio-out", "900", "--confirmo"]); expect(r.code).toBe(3); expect(r.out).toMatch(/supera el tope/); expect(hits).toHaveLength(0); }, 60000);
  it("el tope por defecto es US$0.01 y no se puede subir por encima sin pedirlo explícitamente", async () => { const r = await humo(["--modelo", "x/m", "--precio-in", "100", "--precio-out", "300", "--confirmo"]); expect(r.out).toMatch(/tope US\$0\.01/); expect(r.code).toBe(3); expect(hits).toHaveLength(0); }, 60000);
  it("sin clave en el entorno no llama a nadie", async () => { const r = await humo([...M, "--confirmo"], { OPENROUTER_API_KEY: "" }); expect(r.code).toBe(4); expect(hits).toHaveLength(0); }, 60000);
  it("revisión estática: no usa el router, ni getProvider, ni lee AI_ROUTER, ni la base de datos", () => { const s = fs.readFileSync("scripts/ia/prueba_humo.ts", "utf8"); expect(s).not.toMatch(/createRoutedProvider|getProvider|AI_ROUTER|getDb|server\/ai\/router|server\/models/); expect(s).toMatch(/OpenRouterBackend/); });
});
