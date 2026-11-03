// Revisa que no haya patrones de claves en archivos versionables. Uso: npm run secrets:check
import { execSync } from "node:child_process";
import fs from "node:fs";
const patterns = [/sk-ant-[A-Za-z0-9_-]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/];
const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f) || f === "package-lock.json" || f === "scripts/check_secrets.mjs") continue;
  const t = fs.readFileSync(f, "utf8");
  for (const p of patterns) if (p.test(t)) { console.error(`Posible secreto en ${f} (${p})`); bad++; }
}
if (bad) process.exit(1);
console.log(`Sin patrones de secretos en ${files.length} archivos.`);
