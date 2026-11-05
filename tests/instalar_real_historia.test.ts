import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Instalación SIMULADA sobre la HISTORIA REAL del repositorio: parte de la versión instalada (a6cc7d4) y avanza al commit actual de la rama del PR #7 con el instalador v2.
 * Servicios simulados (systemctl, systemd-run, curl, runuser, psql) y compilación falsa: no toca ningún servidor. Se omite si el clon no trae a6cc7d4 u origin/main.
 */
const INSTALADO = "a6cc7d4b1e2bb1392bed236290206fc881d2e44d"; const RAMA = "claude/humo-sonnet-seguro"; const SCRIPT = path.join(process.cwd(), "deploy/convivencia/instalar_router.sh");
const sh = (cwd: string, ...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf8" }); const git = (cwd: string, ...a: string[]) => { const r = sh(cwd, ...a); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const tieneHistoria = sh(process.cwd(), "cat-file", "-e", INSTALADO).status === 0 && sh(process.cwd(), "rev-parse", "--verify", "origin/main").status === 0 && sh(process.cwd(), "status", "--porcelain").stdout.trim() === "";
const huella = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex"); const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
let W = "", APP = "", ENV = "", STATE = "", REL = "", BIN = "", OBJETIVO = ""; let out = "", code: number | null = null; let envAntes = "", dataAntes = "";
describe.skipIf(process.getuid?.() !== 0 || !tieneHistoria)("instalador v2 sobre la historia real (a6cc7d4 → commit del PR #7)", () => {
  beforeAll(() => {
    W = fs.mkdtempSync(path.join(os.tmpdir(), "real-")); const ORIGIN = path.join(W, "origin.git"); APP = path.join(W, "app"); ENV = path.join(W, "env"); STATE = path.join(W, "state"); REL = path.join(W, "releases"); BIN = path.join(W, "bin"); fs.mkdirSync(BIN);
    OBJETIVO = git(process.cwd(), "rev-parse", "HEAD"); git(W, "init", "-q", "--bare", "-b", "main", ORIGIN); git(process.cwd(), "push", "-q", ORIGIN, `${git(process.cwd(), "rev-parse", "origin/main")}:refs/heads/main`, `HEAD:refs/heads/${RAMA}`, `${INSTALADO}:refs/heads/instalada`);
    git(W, "clone", "-q", "-b", "instalada", ORIGIN, APP); expect(git(APP, "rev-parse", "HEAD")).toBe(INSTALADO); git(APP, "checkout", "-q", "-B", "router-instalado", INSTALADO);
    fs.mkdirSync(path.join(APP, ".next/server"), { recursive: true }); fs.writeFileSync(path.join(APP, ".next/BUILD_ID"), "ok-ANTERIOR\n"); fs.mkdirSync(path.join(APP, ".data/pglite"), { recursive: true }); fs.writeFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "16\n"); fs.mkdirSync(path.join(APP, "node_modules")); fs.writeFileSync(path.join(APP, "node_modules/m.txt"), "viejo\n");
    fs.appendFileSync(path.join(APP, ".git/info/exclude"), ".next\n.data\nnode_modules\n.next.*\n"); git(APP, "status", "--porcelain");
    fs.writeFileSync(ENV, "DATABASE_URL=postgres://u:SECRETDB@127.0.0.1/db\nAPP_SECRET=SECRETAPP\nOPENROUTER_API_KEY=sk-or-v1-SECRETO-0123456789\nAI_ROUTER=off\nSTRIPE_SECRET_KEY=sk_test_SECRETSTRIPE\nRESEND_API_KEY=re_SECRETRESEND\n");
    const shim = (n: string, b: string) => fs.writeFileSync(path.join(BIN, n), `#!/usr/bin/env bash\n${b}\n`, { mode: 0o755 });
    shim("systemctl", 'echo "$*" >> "$TEST_SYSLOG"; exit 0'); shim("systemd-run", 'dir=""; for a in "$@"; do case "$a" in WorkingDirectory=*) dir="${a#WorkingDirectory=}";; esac; done; cmd="${@: -1}"; cd "$dir" && bash -c "$cmd"');
    shim("curl", 'case "$*" in *-w*) printf 200; exit 0;; esac; B="$CREA_APP_DIR/.next/BUILD_ID"; [ -s "$B" ] && head -c 2 "$B" | grep -q "^ok"'); shim("runuser", 'while [ "$1" != "--" ] && [ $# -gt 0 ]; do shift; done; shift; exec "$@"'); shim("psql", "echo t");
    envAntes = huella(ENV); dataAntes = JSON.stringify([fs.readFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "utf8"), fs.statSync(path.join(APP, ".data")).mode]);
    const r = spawnSync("bash", [SCRIPT, "--aplicar", "--rama", RAMA, "--commit", OBJETIVO], { encoding: "utf8", env: { ...process.env, PATH: `${BIN}:${process.env.PATH}`, CREA_APP_DIR: APP, CREA_ENV_FILE: ENV, CREA_STATE: STATE, CREA_RELEASES: REL, CREA_BACKUPS: path.join(W, "bk"), CREA_SIN_USUARIO: "1", SIN_PREGUNTAS: "1", CREA_ESPERA: "0", CREA_INSTALL_CMD: "true", CREA_BUILD_CMD: "mkdir -p .next/server && echo ok-NUEVA > .next/BUILD_ID", CREA_BUILD_CMD_WEBPACK: "exit 1", TEST_SYSLOG: path.join(W, "systemctl.log"), OPENCLAW_PORT: "1" } }); out = (r.stdout ?? "") + (r.stderr ?? ""); code = r.status;
  }, 300000);
  it("avanza limpio desde a6cc7d4 (fast-forward) y acepta TODOS los archivos del commit (lista permitida)", () => { expect(code, out).toBe(0); expect(out).toMatch(/fast-forward/); expect(out).toMatch(/Todos los archivos del paquete están en la lista permitida/); expect(out).not.toMatch(/fuera de la lista permitida/); expect(out).toMatch(/El commit coincide/); });
  it("instala exactamente el commit pedido en una rama local nueva; la versión anterior queda a salvo", () => { expect(git(APP, "rev-parse", "HEAD")).toBe(OBJETIVO); expect(git(APP, "rev-parse", "--abbrev-ref", "HEAD")).toBe("router-instalado"); expect(git(APP, "rev-parse", "instalada")).toBe(INSTALADO); expect(fs.existsSync(path.join(APP, "scripts/ia/humo_lib.ts"))).toBe(true); expect(fs.readFileSync(path.join(APP, ".next/BUILD_ID"), "utf8").trim()).toBe("ok-NUEVA"); expect(fs.readdirSync(APP).filter((x) => x.startsWith(".next.prev."))).toHaveLength(1); });
  it("no toca secretos ni datos: env idéntico, .data intacto, sin secretos en la salida", () => { expect(huella(ENV)).toBe(envAntes); expect(JSON.stringify([fs.readFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "utf8"), fs.statSync(path.join(APP, ".data")).mode])).toBe(dataAntes); for (const s of ["SECRETDB", "SECRETAPP", "SECRETO-0123", "SECRETSTRIPE", "SECRETRESEND"]) expect(out).not.toContain(s); });
  it("solo se reinicia crea-oficina (una vez) y solo se lanza el respaldo de crea-oficina: ningún otro servicio (OpenClaw)", () => { const l = lines(path.join(W, "systemctl.log")); expect(l.filter((x) => x.startsWith("restart"))).toEqual(["restart crea-oficina"]); expect(l.every((x) => /^(restart crea-oficina|start crea-respaldo\.service)$/.test(x)), l.join("|")).toBe(true); });
  it("el router sigue apagado y la salida lo confirma", () => { expect(out).toMatch(/AI_ROUTER sigue apagado/); expect(fs.readFileSync(ENV, "utf8")).toMatch(/AI_ROUTER=off/); });
  it("sin --rama no instala (la rama por omisión no puede instalar el commit equivocado)", () => { const r = spawnSync("bash", [SCRIPT, "--aplicar", "--commit", OBJETIVO], { encoding: "utf8", env: { ...process.env, PATH: `${BIN}:${process.env.PATH}`, CREA_APP_DIR: APP, CREA_ENV_FILE: ENV, CREA_STATE: STATE, CREA_RELEASES: REL, CREA_SIN_USUARIO: "1" } }); expect(r.status).not.toBe(0); expect((r.stdout ?? "") + (r.stderr ?? "")).toMatch(/indica la rama revisada con --rama/); });
});
