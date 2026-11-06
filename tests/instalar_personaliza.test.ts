import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Revisión estática del instalador de «Personaliza tu oficina» (no necesita root ni servidor: solo lee el script y el historial de git). */
const SCRIPT = path.join(process.cwd(), "deploy/convivencia/instalar_personaliza.sh");
const src = fs.readFileSync(SCRIPT, "utf8");
const git = (...a: string[]) => spawnSync("git", a, { cwd: process.cwd(), encoding: "utf8" });
const permitidos = new RegExp(src.match(/^PERMITIDOS='([^']+)'/m)![1]);
const hayMain = git("rev-parse", "--verify", "origin/main").status === 0;

describe("instalar_personaliza.sh", () => {
  it("es un script bash válido con finales de línea LF (con CRLF fallaría en el VPS)", () => {
    expect(src).not.toMatch(/\r/); expect(src.startsWith("#!/usr/bin/env bash")).toBe(true);
    const r = spawnSync("bash", ["-n", SCRIPT], { encoding: "utf8" }); expect(r.status, r.stderr).toBe(0);
  });
  it("conserva las protecciones del v2: respaldo, simulacro por defecto, commit y rama obligatorios, release aparte, nunca reinicia sin BUILD_ID, reversión sin recompilar", () => {
    for (const re of [/crea-respaldo\.service/, /MODO=simulacro/, /--commit/, /git archive|g archive/, /BUILD_ID/, /volver\(\)/, /restaurar_artefactos/, /indica la rama revisada/, /indica el commit revisado/, /fast-forward/, /AI_ROUTER/]) expect(src).toMatch(re);
  });
  it("no escribe en el env, no enciende el router, no llama a OpenRouter ni toca OpenClaw/Stripe/Resend/bases de datos", () => {
    expect(src).not.toMatch(/env_set|>>\s*"?\$ENV_FILE|>\s*"?\$ENV_FILE|sed -i[^\n]*\$ENV_FILE/); expect(src).not.toMatch(/AI_ROUTER=on/); expect(src).not.toMatch(/openrouter\.ai|ia:humo|ia:evaluar|prueba_humo\.ts"|ia:preparado/);
    expect([...src.matchAll(/systemctl\s+restart\s+(\S+)/g)].every((m) => m[1].startsWith("crea-oficina"))).toBe(true);
    expect(src).not.toMatch(/psql[^\n]*-c\s+"(ALTER|DROP|DELETE|UPDATE|INSERT|TRUNCATE)/i);
    expect(src).not.toMatch(/rm -rf[^\n]*\.data|chmod[^\n]*\.data|chown[^\n]*\.data/);
  });
  it("usa archivos de estado PROPIOS: no pisa el registro de reversión del router", () => {
    expect(src).toMatch(/personaliza_anterior\.txt/); expect(src).toMatch(/openclaw_antes_personaliza\.txt/); expect(src).not.toMatch(/router_anterior\.txt|openclaw_antes_router\.txt/); expect(src).toMatch(/personaliza-instalado/);
  });
  it("verifica la columna office_design y las 7 tablas del router al terminar", () => { expect(src).toMatch(/column_name='office_design'/); expect(src).toMatch(/ai_models ai_settings ai_plan_limits ai_accounts ai_reservations ai_calls ai_alerts/); });
  it.skipIf(!hayMain)("la lista permitida acepta TODOS los archivos de este PR respecto de main (y rechaza lo ajeno)", () => {
    const base = git("merge-base", "origin/main", "HEAD").stdout.trim(); const files = git("diff", "--name-only", base, "HEAD").stdout.split("\n").filter(Boolean);
    expect(files.length).toBeGreaterThan(5); const fuera = files.filter((f) => !permitidos.test(f)); expect(fuera).toEqual([]);
    for (const ajeno of ["src/app/(app)/libertad/page.tsx", "src/features/funnel/Hero.tsx", "src/app/api/billing/webhook/route.ts", "src/server/commercial/stripe.ts", "src/server/commerce/mail.ts", ".env", "deploy/convivencia/instalar_todo.sh", "next.config.ts"]) expect(permitidos.test(ajeno), ajeno).toBe(false);
  });
});
