// Genera docs/empleados/CATALOGO.md y PROMPTS.md desde el catálogo central (única fuente). Uso: npx tsx scripts/employees/generar_docs.ts
import fs from "node:fs";
import { allProfiles, portraitPrompt } from "../../src/features/employees/catalog";
const ps = allProfiles();
fs.writeFileSync("docs/empleados/CATALOGO.md", `# Catálogo de empleados IA (${ps.length})\n\nGenerado desde \`src/features/employees/catalog.ts\`. No editar a mano: edita el catálogo y vuelve a correr \`npx tsx scripts/employees/generar_docs.ts\`.\n\n| Nombre | Puesto | Departamento | Especialidad | Clave |\n|---|---|---|---|---|\n${ps.map((p) => `| ${p.nombre} | ${p.puesto} | ${p.departamento.nombre} | ${p.especialidad} | \`${p.key}\` |`).join("\n")}\n`);
fs.writeFileSync("docs/empleados/PROMPTS.md", `# Prompts de retratos (personas FICTICIAS)\n\nUn prompt por empleado; guarda cada imagen como \`<clave>.png\` en una carpeta y corre \`python3 scripts/employees/importar_fotos.py CARPETA\`.\n\n${ps.map((p) => `## ${p.nombre} — \`${p.key}\`\n\n${portraitPrompt(p.key)}\n`).join("\n")}`);
console.log("ok", ps.length);
