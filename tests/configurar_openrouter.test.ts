import { describe, it, expect, beforeEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "deploy/convivencia/configurar_openrouter.sh"); const KEY = "sk-or-v1-CLAVE-PRIVADA-DE-PRUEBA-0123456789";
const BASE = ["DATABASE_URL=postgres://u:DBPASS123@127.0.0.1/db", "APP_SECRET=APPSECRET123", "STRIPE_SECRET_KEY=sk_test_STRIPEKEY", "STRIPE_WEBHOOK_SECRET=whsec_STRIPEWH", "BILLING_ENABLED=false", "PLAN_PRICE_MXN_EMPRENDEDOR=899", "ANTHROPIC_API_KEY=sk-ant-ANTHKEY", "RESEND_API_KEY=re_RESENDKEY123", 'MAIL_FROM="Crea <acceso@mmeia.tech>"', "PLATFORM_ADMIN_EMAILS=jose@ejemplo.test", "PUBLIC_SIGNUP=false"];
let dir: string, env: string;
const run = (args: string[], input = "") => { const r = spawnSync("bash", [SCRIPT, ...args], { input, encoding: "utf8", env: { ...process.env, CREA_ENV_FILE: env, CREA_BACKUPS: path.join(dir, "bk") } }); return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status }; };
const parse = (f: string) => Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]));
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfgor-")); env = path.join(dir, "env"); fs.writeFileSync(env, BASE.join("\n") + "\n"); });
describe.skipIf(process.getuid?.() !== 0)("configurar_openrouter.sh", () => {
  it("el simulacro no cambia nada ni muestra valores", () => { const b = fs.readFileSync(env, "utf8"); const r = run([]); expect(fs.readFileSync(env, "utf8")).toBe(b); expect(r.out).toMatch(/SIMULACRO/); expect(r.out).not.toMatch(/STRIPEKEY|DBPASS|ANTHKEY|RESENDKEY|jose@ejemplo/); });
  it("guarda la clave, deja el router APAGADO y no toca ninguna otra variable", () => {
    const b = parse(env); const r = run(["--aplicar"], `${KEY}\nno\n`); const a = parse(env); expect(r.code).toBe(0); expect(a.OPENROUTER_API_KEY).toBe(KEY); expect(a.AI_ROUTER).toBe("off");
    for (const k of Object.keys(b)) expect(a[k], k).toBe(b[k]); expect(Object.keys(b).every((k) => k in a)).toBe(true);
  });
  it("NUNCA imprime la clave ni los secretos protegidos", () => { const r = run(["--aplicar"], `${KEY}\nno\n`); for (const s of [KEY, "STRIPEKEY", "DBPASS123", "ANTHKEY", "RESENDKEY123", "APPSECRET123", "jose@ejemplo"]) expect(r.out).not.toContain(s); });
  it("respeta un AI_ROUTER=on ya existente (no lo cambia) y jamás lo enciende por su cuenta", () => {
    fs.appendFileSync(env, "AI_ROUTER=on\n"); const r = run(["--aplicar"], `${KEY}\nno\n`); expect(parse(env).AI_ROUTER).toBe("on"); expect(r.out).toMatch(/AI_ROUTER está en «on»/);
    fs.writeFileSync(env, BASE.join("\n") + "\n"); run(["--aplicar"], `${KEY}\nno\n`); expect(parse(env).AI_ROUTER).not.toBe("on");
  });
  it("rechaza claves con formato inesperado y no las guarda", () => { const r = run(["--aplicar"], "clave-mala\nno\n"); expect(r.out).toMatch(/no tiene el formato esperado/); expect(parse(env).OPENROUTER_API_KEY).toBeUndefined(); expect(r.out).not.toContain("clave-mala"); });
  it("deja un respaldo con permiso 600 y no duplica variables al repetir", () => { run(["--aplicar"], `${KEY}\nno\n`); run(["--aplicar"], `${KEY}\nno\n`); const bk = fs.readdirSync(path.join(dir, "bk")); expect(bk.length).toBeGreaterThan(0); expect(fs.statSync(path.join(dir, "bk", bk[0])).mode & 0o777).toBe(0o600); expect(fs.readFileSync(env, "utf8").match(/^OPENROUTER_API_KEY=/gm)?.length).toBe(1); });
  it("revisión estática: solo escribe OPENROUTER_API_KEY y AI_ROUTER=off", () => { const src = fs.readFileSync(SCRIPT, "utf8"); const w = [...src.matchAll(/env_set "\$ENV_FILE" ([A-Z_]+) ([^;\s]+)/g)].map((m) => `${m[1]}=${m[2]}`); expect(w.sort()).toEqual(['AI_ROUTER=off', 'OPENROUTER_API_KEY="$k"'].sort()); expect(src).not.toMatch(/AI_ROUTER on|AI_ROUTER=on/); });
});
