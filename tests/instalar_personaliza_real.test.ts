import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Instalación y reversión SIMULADAS de instalar_personaliza.sh sobre la historia real: parte del router instalado (8f84f20) y avanza a la punta de la rama
 * claude/personaliza-sobre-router (PR #7 + PR #8); luego revierte. Servicios simulados (systemctl, systemd-run, curl, runuser, psql) y compilación falsa:
 * no toca ningún servidor. Exige Linux y root (en GitHub Actions: sudo). Se omite si el clon no trae las referencias necesarias.
 */
const INSTALADO = "8f84f206cf61ee7bef82391c5d4c06893999d984";
const RAMA = "claude/personaliza-sobre-router";
const SCRIPT = path.join(process.cwd(), "deploy/convivencia/instalar_personaliza.sh");
const sh = (cwd: string, ...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf8" });
const git = (cwd: string, ...a: string[]) => { const r = sh(cwd, ...a); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const REF_OBJETIVO = `refs/remotes/origin/${RAMA}`;
const tieneHistoria = sh(process.cwd(), "cat-file", "-e", INSTALADO).status === 0 && sh(process.cwd(), "rev-parse", "--verify", REF_OBJETIVO).status === 0 && sh(process.cwd(), "rev-parse", "--verify", "origin/main").status === 0;
const huella = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
let W = "", APP = "", ENV = "", STATE = "", REL = "", BIN = "", OBJETIVO = "";
let outA = "", codeA: number | null = null, outR = "", codeR: number | null = null, envAntes = "", dataAntes = "";
const baseEnv = () => ({ ...process.env, PATH: `${BIN}:${process.env.PATH}`, CREA_APP_DIR: APP, CREA_ENV_FILE: ENV, CREA_STATE: STATE, CREA_RELEASES: REL, CREA_BACKUPS: path.join(W, "bk"), CREA_SIN_USUARIO: "1", SIN_PREGUNTAS: "1", CREA_ESPERA: "0", CREA_INSTALL_CMD: "true", CREA_BUILD_CMD: "mkdir -p .next/server && echo ok-NUEVA > .next/BUILD_ID", CREA_BUILD_CMD_WEBPACK: "exit 1", TEST_SYSLOG: path.join(W, "systemctl.log"), OPENCLAW_PORT: "1" });

describe.skipIf(process.platform !== "linux" || process.getuid?.() !== 0 || !tieneHistoria)("instalar_personaliza.sh sobre la historia real (8f84f20 → punta de la rama combinada), con reversión", () => {
  beforeAll(() => {
    W = fs.mkdtempSync(path.join(os.tmpdir(), "pers-")); const ORIGIN = path.join(W, "origin.git"); APP = path.join(W, "app"); ENV = path.join(W, "env"); STATE = path.join(W, "state"); REL = path.join(W, "releases"); BIN = path.join(W, "bin"); fs.mkdirSync(BIN);
    OBJETIVO = git(process.cwd(), "rev-parse", REF_OBJETIVO);
    git(W, "init", "-q", "--bare", "-b", "main", ORIGIN);
    git(process.cwd(), "push", "-q", ORIGIN, `${git(process.cwd(), "rev-parse", "origin/main")}:refs/heads/main`, `${OBJETIVO}:refs/heads/${RAMA}`, `${INSTALADO}:refs/heads/instalada`);
    git(W, "clone", "-q", "-b", "instalada", ORIGIN, APP); expect(git(APP, "rev-parse", "HEAD")).toBe(INSTALADO); git(APP, "checkout", "-q", "-B", "router-instalado", INSTALADO);
    fs.mkdirSync(path.join(APP, ".next/server"), { recursive: true }); fs.writeFileSync(path.join(APP, ".next/BUILD_ID"), "ok-ANTERIOR\n");
    fs.mkdirSync(path.join(APP, ".data/pglite"), { recursive: true }); fs.writeFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "16\n");
    fs.mkdirSync(path.join(APP, "node_modules")); fs.writeFileSync(path.join(APP, "node_modules/m.txt"), "viejo\n");
    fs.appendFileSync(path.join(APP, ".git/info/exclude"), ".next\n.data\nnode_modules\n.next.*\n");
    fs.writeFileSync(ENV, "DATABASE_URL=postgres://u:SECRETDB@127.0.0.1/db\nAPP_SECRET=SECRETAPP\nAI_ROUTER=off\nSTRIPE_SECRET_KEY=sk_test_SECRETSTRIPE\nRESEND_API_KEY=re_SECRETRESEND\n");
    const shim = (n: string, b: string) => fs.writeFileSync(path.join(BIN, n), `#!/usr/bin/env bash\n${b}\n`, { mode: 0o755 });
    shim("systemctl", 'echo "$*" >> "$TEST_SYSLOG"; exit 0');
    shim("systemd-run", 'dir=""; for a in "$@"; do case "$a" in WorkingDirectory=*) dir="${a#WorkingDirectory=}";; esac; done; cmd="${@: -1}"; cd "$dir" && bash -c "$cmd"');
    shim("curl", 'case "$*" in *-w*) printf 200; exit 0;; esac; B="$CREA_APP_DIR/.next/BUILD_ID"; [ -s "$B" ] && head -c 2 "$B" | grep -q "^ok"');
    shim("runuser", 'while [ "$1" != "--" ] && [ $# -gt 0 ]; do shift; done; shift; exec "$@"'); shim("psql", "echo t");
    envAntes = huella(ENV); dataAntes = JSON.stringify([fs.readFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "utf8"), fs.statSync(path.join(APP, ".data")).mode]);
    const a = spawnSync("bash", [SCRIPT, "--aplicar", "--rama", RAMA, "--commit", OBJETIVO], { encoding: "utf8", env: baseEnv() }); outA = (a.stdout ?? "") + (a.stderr ?? ""); codeA = a.status;
    const r = spawnSync("bash", [SCRIPT, "--revertir"], { encoding: "utf8", env: baseEnv() }); outR = (r.stdout ?? "") + (r.stderr ?? ""); codeR = r.status;
  }, 300000);

  it("aplicar: avanza limpio (fast-forward) y acepta TODOS los archivos del paquete", () => { expect(codeA, outA).toBe(0); expect(outA).toMatch(/fast-forward/); expect(outA).toMatch(/lista permitida/); expect(outA).not.toMatch(/fuera de la lista permitida/); expect(outA).toMatch(/El commit coincide/); });
  it("aplicar: el router sigue apagado y no se filtran secretos", () => { expect(outA).toMatch(/AI_ROUTER sigue apagado/); for (const s of ["SECRETDB", "SECRETAPP", "SECRETSTRIPE", "SECRETRESEND"]) { expect(outA).not.toContain(s); expect(outR).not.toContain(s); } });
  it("revertir: termina bien y vuelve al código y a la compilación anteriores", () => { expect(codeR, outR).toBe(0); expect(git(APP, "rev-parse", "HEAD")).toBe(INSTALADO); expect(fs.readFileSync(path.join(APP, ".next/BUILD_ID"), "utf8").trim()).toBe("ok-ANTERIOR"); });
  it("env y .data quedan idénticos tras aplicar y revertir", () => { expect(huella(ENV)).toBe(envAntes); expect(JSON.stringify([fs.readFileSync(path.join(APP, ".data/pglite/PG_VERSION"), "utf8"), fs.statSync(path.join(APP, ".data")).mode])).toBe(dataAntes); });
  it("solo se reinicia crea-oficina (nunca otro servicio, p. ej. OpenClaw)", () => { const l = lines(path.join(W, "systemctl.log")); expect(l.filter((x) => x.startsWith("restart")).every((x) => x === "restart crea-oficina"), l.join("|")).toBe(true); expect(l.every((x) => /^(restart crea-oficina|start crea-respaldo\.service)$/.test(x)), l.join("|")).toBe(true); });
});
