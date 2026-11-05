import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Prueba el instalador del paquete mínimo del router en un repositorio de juguete (sin systemd, sin red, sin tocar el servidor): el simulacro y la verificación son de solo lectura. */
const SCRIPT = path.join(process.cwd(), "deploy/convivencia/instalar_router.sh");
let W: string, ORIGIN: string, APP: string, ENV: string, STATE: string; let shaOk = "", shaLibertad = "", shaDiverge = "";
const sh = (cwd: string, cmd: string) => spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf8" });
const git = (cwd: string, ...a: string[]) => { const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const run = (args: string[], env: Record<string, string> = {}) => { const r = spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, PATH: `${path.join(W, "bin")}:${process.env.PATH}`, CREA_ESPERA: "0", CREA_RELEASES: path.join(W, "releases"), CREA_APP_DIR: APP, CREA_ENV_FILE: ENV, CREA_STATE: STATE, CREA_SIN_USUARIO: "1", ...env } }); return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status }; };
const write = (cwd: string, f: string, c: string) => { fs.mkdirSync(path.dirname(path.join(cwd, f)), { recursive: true }); fs.writeFileSync(path.join(cwd, f), c); };
describe.skipIf(process.getuid?.() !== 0)("instalar_router.sh (verificación y simulacro)", () => {
  beforeAll(() => {
    W = fs.mkdtempSync(path.join(os.tmpdir(), "inst-")); ORIGIN = path.join(W, "origin.git"); const SEED = path.join(W, "seed"); APP = path.join(W, "app"); ENV = path.join(W, "env"); STATE = path.join(W, "state");
    fs.writeFileSync(ENV, "DATABASE_URL=postgres://u:SECRETDB@127.0.0.1/db\nAPP_SECRET=SECRETAPP\nOPENROUTER_API_KEY=sk-or-v1-SECRETO-DE-PRUEBA-0123456789\nAI_ROUTER=off\nSTRIPE_SECRET_KEY=sk_test_SECRETSTRIPE\n");
    git(W, "init", "-q", "--bare", "-b", "main", ORIGIN); git(W, "clone", "-q", ORIGIN, SEED); git(SEED, "checkout", "-q", "-b", "main"); write(SEED, "package.json", "{}\n"); write(SEED, "package-lock.json", "{}\n"); write(SEED, "src/a.ts", "a\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "base"); git(SEED, "push", "-q", "origin", "main");
    git(SEED, "checkout", "-q", "-b", "claude/router-ia-minimo"); write(SEED, "src/server/ai/router.ts", "r\n"); write(SEED, "scripts/ia/prueba_humo.ts", "h\n"); write(SEED, "docs/ia-router/X.md", "x\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "router"); git(SEED, "push", "-q", "origin", "claude/router-ia-minimo"); shaOk = git(SEED, "rev-parse", "HEAD");
    git(SEED, "checkout", "-q", "main"); git(SEED, "checkout", "-q", "-b", "claude/con-libertad"); write(SEED, "src/server/ai/router.ts", "r\n"); write(SEED, "src/app/(app)/libertad/page.tsx", "x\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "con libertad"); git(SEED, "push", "-q", "origin", "claude/con-libertad"); shaLibertad = git(SEED, "rev-parse", "HEAD");
    git(W, "clone", "-q", "-b", "main", ORIGIN, APP); fs.mkdirSync(path.join(W, "bin")); fs.writeFileSync(path.join(W, "bin/curl"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 }); write(APP, ".next/BUILD_ID", "ok-1\n"); fs.mkdirSync(path.join(APP, ".next/server")); fs.appendFileSync(path.join(APP, ".git/info/exclude"), ".next\n");
    // rama que NO desciende de lo instalado: se crea desde un commit huérfano
    git(SEED, "checkout", "-q", "--orphan", "claude/divergente"); git(SEED, "rm", "-rfq", "."); write(SEED, "src/server/ai/router.ts", "z\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "otra historia"); git(SEED, "push", "-q", "origin", "claude/divergente"); shaDiverge = git(SEED, "rev-parse", "HEAD");
  });
  const head = () => git(APP, "rev-parse", "HEAD");
  it("verificación: acepta el paquete mínimo, lista los archivos y NO cambia nada", () => { const h = head(), env = fs.readFileSync(ENV, "utf8"); const r = run(["--verificar", "--commit", shaOk]); expect(r.code).toBe(0); expect(r.out).toMatch(/lista permitida/); expect(r.out).toMatch(/fast-forward/); expect(head()).toBe(h); expect(fs.readFileSync(ENV, "utf8")).toBe(env); expect(git(APP, "status", "--porcelain")).toBe(""); });
  it("simulacro (por defecto): explica el plan completo y no cambia nada", () => { const h = head(); const r = run(["--commit", shaOk]); expect(r.code).toBe(0); expect(r.out).toMatch(/SIMULACRO/); expect(r.out).toMatch(/único reinicio/); expect(r.out).toMatch(/NO se hace: encender AI_ROUTER/); expect(head()).toBe(h); expect(fs.existsSync(STATE)).toBe(false); });
  it("nunca imprime secretos ni la clave de OpenRouter (solo «definida / NO definida»)", () => { const r = run(["--verificar"]); for (const s of ["SECRETDB", "SECRETAPP", "SECRETO-DE-PRUEBA", "SECRETSTRIPE"]) expect(r.out).not.toContain(s); expect(r.out).toMatch(/OPENROUTER_API_KEY: definida/); });
  it("se niega si el paquete trae archivos fuera de la lista (p. ej. Mi Plan de Libertad, landing, afiliados)", () => { const r = run(["--verificar", "--rama", "claude/con-libertad"]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/fuera de la lista permitida/); expect(r.out).toContain("libertad/page.tsx"); });
  it("se niega si AI_ROUTER está en «on»", () => { const b = fs.readFileSync(ENV, "utf8"); fs.writeFileSync(ENV, b.replace("AI_ROUTER=off", "AI_ROUTER=on")); const r = run(["--verificar"]); fs.writeFileSync(ENV, b); expect(r.code).not.toBe(0); expect(r.out).toMatch(/exige que esté APAGADO/); });
  it("se niega si el árbol de trabajo tiene cambios locales", () => { fs.writeFileSync(path.join(APP, "sucio.txt"), "x"); const r = run(["--verificar"]); fs.rmSync(path.join(APP, "sucio.txt")); expect(r.code).not.toBe(0); expect(r.out).toMatch(/cambios locales/); });
  it("se niega si el commit indicado no es el de la rama (pudo cambiar tras la revisión)", () => { const r = run(["--verificar", "--commit", "0000000"]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/no a 0000000/); });
  it("se niega si la rama no desciende de lo instalado (no hay fast-forward)", () => { const r = run(["--verificar", "--rama", "claude/divergente"]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/NO desciende/); });
  it("--aplicar sin --rama se niega antes de cambiar nada (la rama por omisión es solo para el simulacro)", () => { const h = head(); const r = run(["--aplicar", "--commit", shaOk]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/indica la rama revisada con --rama/); expect(head()).toBe(h); const s = run(["--commit", shaOk]); expect(s.out).toMatch(/No indicaste --rama/); });
  it("--aplicar sin --commit se niega antes de cambiar nada", () => { const h = head(); const r = run(["--aplicar", "--rama", "claude/router-ia-minimo"]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/indica el commit revisado/); expect(head()).toBe(h); });
});
describe("instalar_router.sh (revisión estática de seguridad)", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  it("no escribe en el env, no enciende el router, no llama a OpenRouter ni toca OpenClaw/Stripe/Resend", () => {
    expect(src).not.toMatch(/env_set|>>\s*"?\$ENV_FILE|>\s*"?\$ENV_FILE|sed -i[^\n]*\$ENV_FILE/); expect(src).not.toMatch(/AI_ROUTER=on/); expect(src).not.toMatch(/openrouter\.ai|ia:humo|ia:evaluar|prueba_humo\.ts"/);
    expect(src).not.toMatch(/systemctl\s+(restart|stop|start|disable|kill|mask)\s+(?!crea-oficina|crea-respaldo)/); expect([...src.matchAll(/systemctl\s+restart\s+(\S+)/g)].every((m) => m[1].startsWith("crea-oficina"))).toBe(true); expect(src).not.toMatch(/\b(reboot|shutdown|ufw|npm (i|install) -g|apt(-get)? )\b/);
  });
  it("tiene respaldo, simulacro por defecto, commit fijado y reversión automática", () => { expect(src).toMatch(/crea-respaldo\.service/); expect(src).toMatch(/MODO=simulacro/); expect(src).toMatch(/--commit/); expect(src).toMatch(/volver\(\)/); expect(src).toMatch(/--revertir/); expect(src).toMatch(/to_regclass/); });
});
