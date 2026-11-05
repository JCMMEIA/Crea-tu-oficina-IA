import { describe, it, expect, beforeEach } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Pruebas de RECUPERACIÓN del instalador v2 (incidente: «next build» con Turbopack falló leyendo .data y el rollback no pudo reconstruir → HTTP 502).
 * Todo ocurre en una carpeta temporal con «systemctl», «systemd-run», «curl», «runuser» y «psql» SIMULADOS: no se toca ningún servidor real.
 * La salud simulada es: la aplicación «responde» si APP/.next/BUILD_ID existe y empieza por «ok».
 */
const SCRIPT = path.join(process.cwd(), "deploy/convivencia/instalar_router.sh");
let W: string, APP: string, ENV: string, STATE: string, REL: string, BIN: string, ORIGIN: string; let PREV = "", NEW = "", NEWLOCK = "";
const git = (cwd: string, ...a: string[]) => { const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const write = (cwd: string, f: string, c: string) => { fs.mkdirSync(path.dirname(path.join(cwd, f)), { recursive: true }); fs.writeFileSync(path.join(cwd, f), c); };
const sha = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const OKBUILD = "mkdir -p .next/server && echo ok-NUEVA > .next/BUILD_ID";
const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
const sysLog = () => lines(path.join(W, "systemctl.log")); const buildLog = () => lines(path.join(W, "build.log"));
const run = (args0: string[], env: Record<string, string> = {}) => { const args = args0.includes("--aplicar") && !args0.includes("--rama") ? [...args0, "--rama", "claude/router-ia-minimo"] : args0; const r = spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, PATH: `${BIN}:${process.env.PATH}`, CREA_APP_DIR: APP, CREA_ENV_FILE: ENV, CREA_STATE: STATE, CREA_RELEASES: REL, CREA_BACKUPS: path.join(W, "bk"), CREA_SIN_USUARIO: "1", SIN_PREGUNTAS: "1", CREA_ESPERA: "0", CREA_INSTALL_CMD: "true", CREA_BUILD_CMD: OKBUILD, CREA_BUILD_CMD_WEBPACK: OKBUILD, TEST_LOG: path.join(W, "build.log"), TEST_SYSLOG: path.join(W, "systemctl.log"), TEST_HOOK_DIR: W, OPENCLAW_PORT: "1", ...env } }); return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status }; };
const shim = (name: string, body: string) => { fs.writeFileSync(path.join(BIN, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 }); };
const bid = (d = ".next") => (fs.existsSync(path.join(APP, d, "BUILD_ID")) ? fs.readFileSync(path.join(APP, d, "BUILD_ID"), "utf8").trim() : null);
const prevDirs = () => fs.readdirSync(APP).filter((x) => x.startsWith(".next.prev."));
const dataSnap = () => { const f = path.join(APP, ".data/pglite/PG_VERSION"); const st = fs.statSync(path.join(APP, ".data")); return JSON.stringify([fs.readFileSync(f, "utf8"), st.mode, st.uid, Math.floor(st.mtimeMs), fs.statSync(f).mode]); };
beforeEach(() => {
  W = fs.mkdtempSync(path.join(os.tmpdir(), "inst2-")); ORIGIN = path.join(W, "origin.git"); const SEED = path.join(W, "seed"); APP = path.join(W, "app"); ENV = path.join(W, "env"); STATE = path.join(W, "state"); REL = path.join(W, "releases"); BIN = path.join(W, "bin"); fs.mkdirSync(BIN);
  fs.writeFileSync(ENV, "DATABASE_URL=postgres://u:SECRETDB@127.0.0.1/db\nAPP_SECRET=SECRETAPP\nOPENROUTER_API_KEY=sk-or-v1-SECRETO-0123456789\nAI_ROUTER=off\nSTRIPE_SECRET_KEY=sk_test_SECRETSTRIPE\nRESEND_API_KEY=re_SECRETRESEND\n");
  git(W, "init", "-q", "--bare", "-b", "main", ORIGIN); git(W, "clone", "-q", ORIGIN, SEED); git(SEED, "checkout", "-q", "-b", "main"); write(SEED, "package.json", "{}\n"); write(SEED, "package-lock.json", "{}\n"); write(SEED, "src/a.ts", "a\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "base"); git(SEED, "push", "-q", "origin", "main"); PREV = git(SEED, "rev-parse", "HEAD"); git(W, "clone", "-q", "-b", "main", ORIGIN, APP);
  git(SEED, "checkout", "-q", "-b", "claude/router-ia-minimo"); write(SEED, "src/server/ai/router.ts", "r\n"); write(SEED, "src/server/db/index.ts", "db\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "router"); git(SEED, "push", "-q", "origin", "claude/router-ia-minimo"); NEW = git(SEED, "rev-parse", "HEAD");
  git(SEED, "checkout", "-q", "main"); git(SEED, "checkout", "-q", "-b", "claude/con-lock"); write(SEED, "package-lock.json", '{"x":1}\n'); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "lock en main"); git(SEED, "push", "-q", "origin", "claude/con-lock:main"); write(SEED, "src/server/ai/router.ts", "r\n"); git(SEED, "add", "-A"); git(SEED, "commit", "-q", "-m", "router"); git(SEED, "push", "-q", "origin", "claude/con-lock"); NEWLOCK = git(SEED, "rev-parse", "HEAD");
  write(APP, ".next/BUILD_ID", "ok-ANTERIOR\n"); fs.mkdirSync(path.join(APP, ".next/server")); write(APP, "node_modules/marca.txt", "viejo\n"); write(APP, ".data/pglite/PG_VERSION", "16\n"); fs.chmodSync(path.join(APP, ".data"), 0o700);
  fs.appendFileSync(path.join(APP, ".git/info/exclude"), ".next\n.data\nnode_modules\n.next.*\nnode_modules.*\n");
  shim("systemctl", 'echo "$*" >> "$TEST_SYSLOG"; if [ "$1" = restart ]; then n=$(grep -c "^restart crea-oficina" "$TEST_SYSLOG"); [ -x "$TEST_HOOK_DIR/hook_restart_$n" ] && bash "$TEST_HOOK_DIR/hook_restart_$n"; fi; exit 0');
  shim("systemd-run", 'dir=""; for a in "$@"; do case "$a" in WorkingDirectory=*) dir="${a#WorkingDirectory=}";; esac; done; cmd="${@: -1}"; echo "build $dir" >> "$TEST_LOG"; cd "$dir" && bash -c "$cmd"');
  shim("curl", 'case "$*" in *-w*) printf 200; exit 0;; esac; B="$CREA_APP_DIR/.next/BUILD_ID"; [ -s "$B" ] && head -c 2 "$B" | grep -q "^ok"');
  shim("runuser", 'while [ "$1" != "--" ] && [ $# -gt 0 ]; do shift; done; shift; exec "$@"'); shim("psql", "echo t");
});
const snapshot = () => ({ head: git(APP, "rev-parse", "HEAD"), branch: git(APP, "rev-parse", "--abbrev-ref", "HEAD"), bid: bid(), env: sha(ENV), data: dataSnap(), nm: fs.readFileSync(path.join(APP, "node_modules/marca.txt"), "utf8") });
const FRESH = (b: Record<string, unknown>) => expect(snapshot()).toEqual(b);

describe.skipIf(process.getuid?.() !== 0)("instalador v2: instalación y protección de lo que funciona", () => {
  it("instala en un release aparte, intercambia carpetas, reinicia UNA vez y NO toca .data, el env ni otras unidades", () => {
    const antes = snapshot(); const r = run(["--aplicar", "--commit", NEW]); expect(r.code, r.out).toBe(0);
    expect(bid()).toBe("ok-NUEVA"); expect(git(APP, "rev-parse", "HEAD")).toBe(NEW); expect(git(APP, "rev-parse", "--abbrev-ref", "HEAD")).toBe("router-instalado"); expect(git(APP, "rev-parse", "main")).toBe(PREV); // la rama anterior queda intacta
    expect(prevDirs()).toHaveLength(1); expect(bid(prevDirs()[0])).toBe("ok-ANTERIOR"); expect(fs.existsSync(REL) ? fs.readdirSync(REL) : []).toEqual([]); // release temporal eliminado
    expect(sha(ENV)).toBe(antes.env); expect(dataSnap()).toBe(antes.data); expect(buildLog()).toHaveLength(1); expect(buildLog()[0]).toContain(REL); expect(buildLog()[0]).not.toContain(APP + "\n");
    expect(sysLog().filter((l) => l.startsWith("restart"))).toEqual(["restart crea-oficina"]); expect(sysLog().every((l) => /^(restart crea-oficina|start crea-respaldo\.service)$/.test(l)), sysLog().join("|")).toBe(true); // jamás otra unidad (OpenClaw)
    for (const s of ["SECRETDB", "SECRETAPP", "SECRETO-0123", "SECRETSTRIPE", "SECRETRESEND"]) expect(r.out).not.toContain(s);
  });
  it("la compilación se hace en un release SIN .data (reproduce el origen del incidente: la carpeta en marcha ni se mira)", () => {
    const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: `[ ! -e .data ] || { echo ".data presente en el release"; exit 3; }; [ ! -e .env ] || exit 4; ${OKBUILD}` }); expect(r.code, r.out).toBe(0); expect(r.out).not.toMatch(/\.data presente/);
  });
  it("si Turbopack falla, reintenta con webpack automáticamente y termina bien", () => {
    const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: "echo turbopack >> $TEST_LOG; exit 1", CREA_BUILD_CMD_WEBPACK: `echo webpack >> $TEST_LOG; ${OKBUILD}` }); expect(r.code, r.out).toBe(0); expect(r.out).toMatch(/reintento con webpack/); expect(buildLog().filter((l) => l === "turbopack" || l === "webpack")).toEqual(["turbopack", "webpack"]); expect(bid()).toBe("ok-NUEVA");
  });
  it("si fallan Turbopack y webpack: NO cambia nada, NO reinicia, borra solo su release y deja la versión funcionando", () => {
    const antes = snapshot(); const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: "exit 1", CREA_BUILD_CMD_WEBPACK: "exit 1" });
    expect(r.code).toBe(1); expect(r.out).toMatch(/NO se tocó/); FRESH(antes); expect(sysLog().filter((l) => l.startsWith("restart"))).toHaveLength(0); expect(prevDirs()).toHaveLength(0); expect(fs.existsSync(REL) ? fs.readdirSync(REL) : []).toEqual([]);
    expect(run(["--verificar"]).out).toMatch(/La aplicación responde ahora/); // sigue «sana»
  });
  it("si la app no responde tras el reinicio: restaura las carpetas guardadas SIN recompilar, comprueba BUILD_ID y vuelve a funcionar", () => {
    const antes = snapshot(); const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: "mkdir -p .next/server && echo MALA > .next/BUILD_ID", CREA_BUILD_CMD_WEBPACK: "mkdir -p .next/server && echo MALA > .next/BUILD_ID" });
    expect(r.code, r.out).toBe(1); expect(r.out).toMatch(/Versión anterior restaurada y funcionando/); expect(snapshot()).toEqual(antes); expect(buildLog().filter((l) => l.startsWith("build"))).toHaveLength(1); // solo la compilación del release: el rollback NO recompiló
    expect(sysLog().filter((l) => l.startsWith("restart"))).toHaveLength(2); expect(fs.existsSync(path.join(APP, ".next/BUILD_ID"))).toBe(true);
  });
  it("si faltan las carpetas guardadas y NO hay BUILD_ID: no reinicia a ciegas; reconstruye en un release aparte; si eso falla, sale con código 2 sin reiniciar y da la recuperación manual", () => {
    fs.writeFileSync(path.join(W, "hook_restart_1"), `rm -rf "${APP}"/.next "${APP}"/.next.prev.*; exit 0`, { mode: 0o755 });
    const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: `case "$PWD" in *recuperacion*) exit 1;; esac; ${OKBUILD}`, CREA_BUILD_CMD_WEBPACK: `case "$PWD" in *recuperacion*) exit 1;; esac; ${OKBUILD}` });
    expect(r.code, r.out).toBe(2); expect(r.out).toMatch(/NO hay una versión compilada: el servicio NO se reinició/); expect(r.out).toMatch(/npm run build -- --webpack/); expect(sysLog().filter((l) => l.startsWith("restart"))).toHaveLength(1); // solo el reinicio que ya había ocurrido; ninguno sin BUILD_ID
    expect(dataSnap()).toBeTruthy(); expect(fs.existsSync(REL) ? fs.readdirSync(REL) : []).toEqual([]);
  });
  it("último recurso con éxito: reconstruye la versión anterior en un release aparte (sin .data) y la deja respondiendo", () => {
    fs.writeFileSync(path.join(W, "hook_restart_1"), `rm -rf "${APP}"/.next "${APP}"/.next.prev.*; exit 0`, { mode: 0o755 });
    const antes = snapshot(); const r = run(["--aplicar", "--commit", NEW], { CREA_BUILD_CMD: `case "$PWD" in *recuperacion*) [ ! -e .data ] && mkdir -p .next/server && echo ok-RECUPERADA > .next/BUILD_ID;; *) ${OKBUILD};; esac`, CREA_BUILD_CMD_WEBPACK: "exit 1" });
    expect(r.code, r.out).toBe(1); expect(bid()).toBe("ok-RECUPERADA"); expect(git(APP, "rev-parse", "HEAD")).toBe(PREV); expect(dataSnap()).toBe(antes.data); expect(sysLog().filter((l) => l.startsWith("restart"))).toHaveLength(2);
  });
  it("si cambia package-lock.json, intercambia también node_modules y la reversión los restaura", () => {
    const antes = snapshot(); const r = run(["--aplicar", "--commit", NEWLOCK, "--rama", "claude/con-lock"], { CREA_INSTALL_CMD: "mkdir -p node_modules && echo nuevo > node_modules/marca.txt", CREA_BUILD_CMD: "mkdir -p .next/server && echo MALA > .next/BUILD_ID", CREA_BUILD_CMD_WEBPACK: "mkdir -p .next/server && echo MALA > .next/BUILD_ID" });
    expect(r.code, r.out).toBe(1); expect(snapshot()).toEqual(antes); // node_modules viejo de vuelta
    const ok = run(["--aplicar", "--commit", NEWLOCK, "--rama", "claude/con-lock"], { CREA_INSTALL_CMD: "mkdir -p node_modules && echo nuevo > node_modules/marca.txt" }); expect(ok.code, ok.out).toBe(0); expect(fs.readFileSync(path.join(APP, "node_modules/marca.txt"), "utf8").trim()).toBe("nuevo");
  });
  it("--revertir restaura la versión anterior intercambiando carpetas (sin compilar) y comprueba BUILD_ID", () => {
    const antes = snapshot(); expect(run(["--aplicar", "--commit", NEW]).code).toBe(0); const n = buildLog().length; const r = run(["--revertir"]); expect(r.code, r.out).toBe(0); expect(buildLog()).toHaveLength(n); expect(snapshot()).toEqual(antes);
  });
  it("se niega a instalar si NO hay una versión compilada que proteger o si la aplicación ya está caída", () => {
    fs.rmSync(path.join(APP, ".next"), { recursive: true }); let r = run(["--aplicar", "--commit", NEW]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/BUILD_ID/); expect(buildLog()).toHaveLength(0);
    write(APP, ".next/BUILD_ID", "MALA\n"); fs.mkdirSync(path.join(APP, ".next/server"), { recursive: true }); r = run(["--aplicar", "--commit", NEW]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/NO responde ahora/); expect(sysLog()).toHaveLength(0);
  });
  it("con AI_ROUTER=on se niega antes de hacer nada", () => { fs.writeFileSync(ENV, fs.readFileSync(ENV, "utf8").replace("AI_ROUTER=off", "AI_ROUTER=on")); const antes = snapshot(); const r = run(["--aplicar", "--commit", NEW]); expect(r.code).not.toBe(0); expect(r.out).toMatch(/exige que esté APAGADO/); expect(git(APP, "rev-parse", "HEAD")).toBe(antes.head); expect(sysLog()).toHaveLength(0); });
  it("el simulacro y la verificación no crean carpetas ni tocan nada (ni siquiera el directorio de releases)", () => { const antes = snapshot(); for (const a of [[], ["--verificar"]]) { const r = run([...a, "--commit", NEW]); expect(r.code, r.out).toBe(0); } FRESH(antes); expect(fs.existsSync(REL)).toBe(false); expect(sysLog()).toHaveLength(0); expect(fs.existsSync(STATE)).toBe(false); });
});
describe("instalador v2: revisión estática de seguridad", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  it("todo borrado (rm -rf) está acotado: solo limpiar_release (dentro de $REL_DIR) y .next dentro del release tras un fallo de Turbopack", () => {
    const rms = src.split("\n").filter((l) => /\brm\s+-[a-z]*r/.test(l) && !l.trim().startsWith("#")); expect(rms.length).toBe(2); expect(rms.some((l) => l.includes('limpiar_release() { local d="$1"') && l.includes('"$REL_DIR"/*'))).toBe(true); expect(rms.some((l) => l.includes("rm -rf .next;"))).toBe(true);
    expect(src.split("\n").filter((l) => /\b(chmod|chown)\b/.test(l) && !l.trim().startsWith("#")).every((l) => l.includes('chmod 600 "$EB"'))).toBe(true); expect(src).not.toMatch(/\.data["\/ ]*[^"\s]*\b(rm|mv|cp|chmod)\b|\b(rm|mv|cp|chmod)\b[^\n]*\.data/);
  });
  it("jamás reinicia sin comprobar BUILD_ID y solo reinicia crea-oficina", () => { expect(src).toMatch(/listo_para_arrancar\(\) \{[^}]*BUILD_ID/); expect([...src.matchAll(/systemctl\s+restart\s+(\S+)/g)].every((m) => m[1].startsWith("crea-oficina"))).toBe(true); expect(src.match(/reiniciar_y_verificar\(\) \{\n\s*listo_para_arrancar/)).toBeTruthy(); });
  it("compila siempre en un release (build_en recibe el directorio) y reintenta con webpack", () => { expect(src).toMatch(/WorkingDirectory="\$dir"/); expect(src).not.toMatch(/WorkingDirectory="\$APP_DIR"/); expect(src).toMatch(/--webpack/); expect(src).toMatch(/git archive|g archive/); });
  it("el código fuente de la aplicación ignora .data en la compilación (causa raíz del incidente)", () => { const db = fs.readFileSync("src/server/db/index.ts", "utf8"); expect(db).toMatch(/path\.join\(\/\*turbopackIgnore: true\*\/ process\.cwd\(\), "\.data", "pglite"\)/); });
});
