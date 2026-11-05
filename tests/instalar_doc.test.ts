import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

/** Los comandos de INSTALAR_ROUTER_VPS.md deben ser completos, válidos en Bash y apuntar a la rama correcta. */
const DOC = fs.readFileSync("docs/ia-router/INSTALAR_ROUTER_VPS.md", "utf8");
const blocks = [...DOC.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
const sec = (n: string) => { const a = DOC.indexOf(`## ${n}.`); const b = DOC.indexOf("\n## ", a + 5); return DOC.slice(a, b < 0 ? undefined : b); };
describe("INSTALAR_ROUTER_VPS.md: comandos copiables", () => {
  it("hay bloques bash y todos pasan `bash -n` (comillas balanceadas, sin marcadores <así>)", () => { expect(blocks.length).toBeGreaterThanOrEqual(8); blocks.forEach((b, i) => { const r = spawnSync("bash", ["-n"], { input: b, encoding: "utf8" }); expect(r.status, `bloque ${i}:\n${b}\n${r.stderr}`).toBe(0); expect(b).not.toMatch(/<[A-Za-zÁ-ú_-]+>/); }); });
  it("la sección 5 tiene exactamente 3 comandos completos de `ia:humo` (simulacro, --consultar-clave, --autorizo-una-llamada-facturable), cada uno autocontenido", () => {
    const b5 = [...sec("5").matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim()); expect(b5).toHaveLength(3);
    for (const c of b5) { expect(c.split("\n")).toHaveLength(1); expect(c).toMatch(/^sudo runuser -u ctoapp -- env HOME=\/opt\/crea-oficina\/home PATH=\/opt\/crea-oficina\/node\/bin:\/usr\/bin:\/bin bash -c '.*npm run -s ia:humo.*'$/); expect(c).not.toMatch(/PREFIJO|\$PREFIJO/); expect((c.match(/'/g) ?? []).length).toBe(2); }
    expect(b5[0]).toMatch(/ia:humo'$/); expect(b5[1]).toMatch(/ia:humo -- --consultar-clave'$/); expect(b5[2]).toMatch(/ia:humo -- --autorizo-una-llamada-facturable'$/);
    expect(sec("5")).toMatch(/SOLO con tu autorización expresa/);
  });
  it("todos los comandos del instalador llevan --rama y --commit con el valor correcto; ninguno trae la rama antigua", () => {
    const inst = blocks.join("\n").split("\n").filter((l) => /instalar_router\.sh/.test(l) && !/tee \/tmp|show FETCH_HEAD|sha256sum/.test(l)); expect(inst.length).toBeGreaterThanOrEqual(3);
    for (const l of inst) { if (/--revertir/.test(l)) continue; expect(l, l).toMatch(/--rama "\$RAMA"/); expect(l, l).toMatch(/--commit "\$SHA"/); }
    expect(DOC).toMatch(/RAMA=claude\/humo-sonnet-seguro/); expect(DOC).toMatch(/fetch origin "\$RAMA"/); expect(DOC).not.toMatch(/claude\/router-ia-minimo/);
    expect(blocks.join("\n")).toMatch(/--aplicar --rama "\$RAMA" --commit "\$SHA"/);
  });
  it("el commit es un marcador que el instalador rechaza si no se reemplaza", () => { expect(DOC).toMatch(/SHA=PEGA_AQUI_EL_COMMIT_REVISADO/); });
  it("ningún comando del documento escribe en el env, enciende el router ni usa banderas obsoletas", () => { const all = blocks.join("\n"); expect(all).not.toMatch(/AI_ROUTER=on|--confirmo|--modelo|>>\s*\/etc\/crea-oficina/); });
});
