// Genera docs/ia-router/EMPLEADOS_Y_ROUTING.md desde el catálogo real de 41 empleados y los perfiles de enrutamiento. Uso: npx tsx scripts/ia/empleados_routing.ts
import fs from "node:fs";
import { EMPLOYEES, getDepartment } from "../../src/server/catalog/data";
import { profileOf } from "../../src/server/ai/profiles";
import { identityFor } from "../../src/features/employees/catalog";

const TOK = { A: [2000, 500], B: [3500, 1000], C: [8000, 2500] } as const;
const ELEG = (sens: string, lvl: string) => sens === "confidential" ? "solo modelos con retención cero verificada (premium o económico con esa política)" : sens === "internal" ? "modelos con política «sin entrenamiento» verificada; gratuitos solo si la cuenta lo permite" : "cualquier modelo activo y verificado, empezando por gratuitos";
const SIMPLE: Record<string, string> = { marketing: "reformular un texto, clasificar ideas", ventas: "resumir un mensaje, ordenar prospectos", operaciones: "ordenar una lista de inventario o pedidos", finanzas: "clasificar un gasto, ordenar cifras", rrhh: "resumir un currículum, ordenar candidatos", direccion: "armar la agenda o resumir pendientes", atencion: "responder una pregunta frecuente" };
const COMPLEX: Record<string, string> = { marketing: "plan de campaña con investigación y varias piezas", ventas: "propuesta multi-servicio con objeciones", operaciones: "plan de reabastecimiento con varios proveedores", finanzas: "análisis de rentabilidad y flujo con varios periodos", rrhh: "plan de capacitación y desempeño del equipo", direccion: "análisis estratégico con varios documentos", atencion: "caso de reclamación con historial" };
let md = `# Los 41 empleados y su enrutamiento\n\nGenerado por \`scripts/ia/empleados_routing.ts\` desde \`src/server/catalog/data.ts\` y \`src/server/ai/profiles.ts\`. **Es un borrador para revisar:** los niveles y la sensibilidad son reglas de partida, no mediciones. Hay **un solo router**; lo que cambia entre puestos son estos datos.\n\n**Tokens supuestos por tarea (entrada/salida):** A ${TOK.A.join("/")} · B ${TOK.B.join("/")} · C ${TOK.C.join("/")}. El costo esperado depende del precio verificado de cada modelo (ver \`docs/ia-router/FINANZAS.md\`); aquí no se inventa.\n\n`;
for (const d of ["marketing", "ventas", "atencion", "operaciones", "finanzas", "rrhh", "direccion"]) {
  md += `## ${getDepartment(d)?.name}\n\n| Puesto | Funciones | Tarea sencilla (A) | Tarea intermedia (B) | Tarea compleja (C) | Herramientas | Información sensible | Nivel habitual | Modelos elegibles | Criterios de calidad |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const e of EMPLOYEES.filter((x) => x.department === d)) { const p = profileOf(e.key); const id = identityFor(e.key);
    md += `| ${id?.nombre ?? ""} · ${e.name} | ${e.responsibilities.slice(0, 2).join("; ")} | ${SIMPLE[d]} | ${e.deliverables[0] ?? "entregable del puesto"} | ${COMPLEX[d]} | ${e.connections.map((c) => c.toolkit + (c.required ? "*" : "")).join(", ") || "ninguna"} | ${p.sensitivity}: ${p.nota} | ${p.level} | ${ELEG(p.sensitivity, p.level)} | calidad ${p.quality}; secciones y formato del entregable; sin inventar datos |\n`; }
  md += "\n";
}
md += "\\* herramienta obligatoria.\n";
fs.writeFileSync("docs/ia-router/EMPLEADOS_Y_ROUTING.md", md); console.log("ok", EMPLOYEES.length);
