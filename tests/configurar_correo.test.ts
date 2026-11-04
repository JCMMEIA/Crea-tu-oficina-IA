import { describe, it, expect, beforeEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "deploy/convivencia/configurar_correo.sh");
const BASE = ["DATABASE_URL=postgres://u:DBPASS123@127.0.0.1/db", "APP_SECRET=APPSECRET123", "STRIPE_SECRET_KEY=sk_test_STRIPEKEY", "STRIPE_WEBHOOK_SECRET=whsec_STRIPEWH", "BILLING_ENABLED=false", "PLAN_PRICE_MXN_EMPRENDEDOR=899", "ANTHROPIC_API_KEY=sk-ant-ANTHKEY", "PLATFORM_ADMIN_EMAILS=jose@ejemplo.test", "PUBLIC_SIGNUP=false", "OTRA_VARIABLE=conservar"];
const MAIL = ["RESEND_API_KEY", "MAIL_FROM", "NEXT_PUBLIC_SITE_URL", "SITE_URL", "PLATFORM_ADMIN_EMAILS", "RESEND_WEBHOOK_SECRET"];
let dir: string, env: string;
const run = (args: string[], input = "") => { const r = spawnSync("bash", [SCRIPT, ...args], { input, encoding: "utf8", env: { ...process.env, CREA_ENV_FILE: env, CREA_BACKUPS: path.join(dir, "bk") } }); return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status }; };
const parse = (f: string) => Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]));
const isRoot = process.getuid?.() === 0;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfgmail-")); env = path.join(dir, "env"); fs.writeFileSync(env, BASE.join("\n") + "\n"); });

describe.skipIf(!isRoot)("configurar_correo.sh", () => {
  it("el simulacro no cambia nada y no muestra valores", () => {
    const before = fs.readFileSync(env, "utf8"); const r = run([]);
    expect(fs.readFileSync(env, "utf8")).toBe(before); expect(r.out).toMatch(/SIMULACRO/); expect(r.out).not.toMatch(/STRIPEKEY|DBPASS|ANTHKEY|jose@ejemplo/);
  });
  it("aplicar: solo cambian variables de correo; Stripe, Anthropic, BD y demás quedan idénticas", () => {
    const b = parse(env);
    const r = run(["--aplicar"], "re_clave123\nSI\nSI\nmaria@ejemplo.test\nwhsec_firma123\nno\n"); const a = parse(env);
    expect(r.code).toBe(0);
    for (const k of Object.keys(b)) if (!MAIL.includes(k)) expect(a[k], k).toBe(b[k]);
    expect(a.RESEND_API_KEY).toBe("re_clave123"); expect(a.MAIL_FROM).toBe('"Crea tu Oficina IA <acceso@mmeia.tech>"');
    expect(a.NEXT_PUBLIC_SITE_URL).toBe("https://app.mmeia.tech"); expect(a.SITE_URL).toBe("https://app.mmeia.tech"); expect(a.RESEND_WEBHOOK_SECRET).toBe("whsec_firma123");
    expect(a.PLATFORM_ADMIN_EMAILS).toBe("jose@ejemplo.test,maria@ejemplo.test"); // agrega, no reemplaza
    expect(Object.keys(b).every((k) => k in a)).toBe(true); // no se perdió ninguna variable
  });
  it("no imprime secretos ni correos completos", () => {
    const r = run(["--aplicar"], "re_clave123\nSI\nSI\nmaria@ejemplo.test\nwhsec_firma123\nno\n");
    for (const s of ["re_clave123", "whsec_firma123", "maria@ejemplo.test", "jose@ejemplo.test", "STRIPEKEY", "DBPASS123", "ANTHKEY", "APPSECRET123"]) expect(r.out).not.toContain(s);
  });
  it("rechaza claves con formato inválido y no las guarda", () => {
    const r = run(["--aplicar"], "clave-mala\nno\nno\n\n\nno\n"); expect(r.out).toMatch(/Formato no válido/); expect(parse(env).RESEND_API_KEY).toBeUndefined();
  });
  it("sin dominio verificado NO pone MAIL_FROM", () => {
    run(["--aplicar"], "re_clave123\nno\nno\n\n\nno\n"); expect(parse(env).MAIL_FROM).toBeUndefined();
  });
  it("repetir el mismo operador no duplica la lista y deja un respaldo 600", () => {
    run(["--aplicar"], "\nno\nno\njose@ejemplo.test\n\nno\n"); expect(parse(env).PLATFORM_ADMIN_EMAILS).toBe("jose@ejemplo.test");
    const bk = fs.readdirSync(path.join(dir, "bk")); expect(bk.length).toBeGreaterThan(0); expect(fs.statSync(path.join(dir, "bk", bk[0])).mode & 0o777).toBe(0o600);
  });
  it("el script solo escribe variables de correo (revisión estática)", () => {
    const src = fs.readFileSync(SCRIPT, "utf8"); const keys = new Set([...src.matchAll(/env_set "\$ENV_FILE" ([A-Z_]+)/g)].map((m) => m[1]));
    for (const k of keys) expect(MAIL, k).toContain(k);
    expect(src).not.toMatch(/env_set[^\n]*(STRIPE|BILLING|PLAN_PRICE|ANTHROPIC|DATABASE|PUBLIC_SIGNUP)/);
    for (const k of ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"]) expect(src).toContain(`ask_secret ${k}`);
  });
});
