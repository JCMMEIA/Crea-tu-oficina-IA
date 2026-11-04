import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EMPLOYEES } from "@/server/catalog/data";
import { identityFor, allProfiles } from "@/features/employees/catalog";
import { TAREAS, AREAS } from "@/features/funnel/config/tareas";
import { FLUJOS } from "@/features/funnel/config/workflows";
import { COMPARACION } from "@/features/funnel/config/comparacion";
import { FEATURES, estadoDe } from "@/features/funnel/config/disponibilidad";
import { TIERS, FILAS, PLANES_APROBADOS } from "@/features/funnel/config/planes";
import { faqItems, NAV, PASOS } from "@/features/funnel/config/content";
import { AFF } from "@/features/funnel/config/afiliados";

const root = process.cwd();
const walk = (d: string): string[] => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const funnelSrc = walk("src/features/funnel").filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => [f, fs.readFileSync(path.join(root, f), "utf8")] as const);

describe("landing: contenido honesto y consistente", () => {
  it("las 8 tareas usan empleados reales del catálogo, con ejemplo completo", () => {
    expect(TAREAS).toHaveLength(8); expect(new Set(TAREAS.map((t) => t.key)).size).toBe(8);
    const keys = new Set(EMPLOYEES.map((e) => e.key)); expect(AREAS.map((a) => TAREAS.filter((t) => t.area === a.key).length)).toEqual([3, 2, 3]);
    for (const t of TAREAS) { expect(keys.has(t.empleadoKey), t.key).toBe(true); expect(identityFor(t.empleadoKey), t.key).toBeTruthy(); expect(t.pide.length).toBeGreaterThan(1); expect(t.ejemplo.entradas.length).toBeGreaterThan(1); expect(t.ejemplo.salida.bloques.length).toBeGreaterThan(1); expect(t.problema.length).toBeGreaterThan(20); expect(t.entrega.length).toBeGreaterThan(20); }
  });
  it("el directorio muestra los 41 empleados reales y los nombres de workflows existen en el catálogo", () => {
    expect(allProfiles()).toHaveLength(41); const puestos = new Set(EMPLOYEES.map((e) => e.name));
    for (const f of FLUJOS) for (const p of f.pasos) if (!p.humano) expect(puestos.has(p.empleado) || identityFor(p.empleado) !== null || EMPLOYEES.some((e) => e.name === p.empleado), `${f.id}/${p.id}: ${p.empleado}`).toBe(true);
  });
  it("las funciones sin construir no se anuncian como disponibles", () => {
    expect(estadoDe("workflows")).toBe("proximamente"); expect(estadoDe("integraciones")).toBe("proximamente");
    for (const k of ["cerebro", "tareasGuiadas", "resultados", "consumo"]) expect(estadoDe(k), k).not.toBe("disponible"); // viven en el PR #3 hasta que se fusione y verifique con IA real
    for (const f of COMPARACION) expect(Object.keys(FEATURES), f.tema).toContain(f.feature);
    const faq = faqItems("emprendedor").find(([q]) => q.startsWith("¿Qué funciones están disponibles"))![1]; expect(faq).toMatch(/En revisión:.*tareas guiadas/); expect(faq).toMatch(/Próximamente:.*workflows/);
  });
  it("no hay cifras o promesas inventadas en la landing", () => {
    for (const [f, src] of funnelSrc) {
      expect(src, f).not.toMatch(/\b(150|200)\+?\s*(tareas|workflows)/i); if (!f.endsWith("config/afiliados.ts")) expect(src, f).not.toMatch(/garantizamos|garantizado|aumenta(rá)? tus ventas|resultados garantizados/i); // afiliados.ts los menciona solo como práctica PROHIBIDA
      expect(src, f).not.toMatch(/★|⭐|Carlos Méndez|Ana Rivas|Diego Salazar/); if (f.includes("/config/")) expect(src, f).not.toMatch(/\b\d{2,3}\s?%/); // porcentajes de éxito inventados
    }
    for (const t of TAREAS) expect(JSON.stringify(t.ejemplo)).not.toMatch(/\d\s?%/);
  });
  it("los planes no publican precios ni cantidades mientras no estén aprobados", () => {
    expect(TIERS.map((t) => t.key)).toEqual(["starter", "pro", "business"]);
    if (!PLANES_APROBADOS) { for (const t of TIERS) expect(t.precioMxn, t.key).toBeNull(); for (const f of FILAS) if (!f.feature) for (const v of Object.values(f.valores)) expect(v, f.fila).toBeNull(); }
  });
  it("navegación: cada ancla del menú existe como sección y la landing tiene los 7 pasos pedidos", () => {
    const page = fs.readFileSync(path.join(root, "src/features/funnel/FunnelLanding.tsx"), "utf8"); const all = funnelSrc.map(([, s]) => s).join("\n");
    for (const n of NAV) expect(all, n.href).toMatch(new RegExp(`id="${n.href.slice(1)}"`)); expect(PASOS).toHaveLength(7); expect(page).toMatch(/Hero.*Problem.*ProductDemo.*EmployeesSection.*BrainSection.*TasksSection.*WorkflowsSection.*ResultsSection.*HowItWorks.*Comparison/s);
    for (const id of ["como", "producto", "empleados", "cerebro", "tareas", "workflows", "resultados", "comparacion", "planes", "oferta", "confianza", "faq"]) expect(all, id).toMatch(new RegExp(`id="${id}"`));
  });
  it("la landing de afiliados no promete ingresos, ni vende licencias, y usa las condiciones reales del programa", () => {
    const txt = JSON.stringify(AFF); expect(txt).not.toMatch(/\$\s?\d|ganarás|ganarás dinero seguro/i); expect(txt).toMatch(/No\. Este programa es de recomendación/); expect(txt).toMatch(/20 %/); expect(txt).toMatch(/12 cobros/);
    const page = fs.readFileSync(path.join(root, "src/features/funnel/components/AffiliatePaths.tsx"), "utf8"); expect(page).toContain("¿Qué quieres hacer con la IA?"); expect(page).toContain("Ganar dinero como afiliado"); expect(page).toContain("Crear mi Oficina IA");
  });
  it("el hero usa el título y los dos botones pedidos", () => {
    const c = fs.readFileSync(path.join(root, "src/features/funnel/config/content.ts"), "utf8"); expect(c).toContain("Tu empresa merece un equipo completo."); expect(c).toContain("Ahora puedes construirlo con IA.");
    const h = fs.readFileSync(path.join(root, "src/features/funnel/components/Hero.tsx"), "utf8"); expect(h).toContain("Conocer cómo funciona"); expect(fs.readFileSync(path.join(root, "src/features/funnel/components/BuyButton.tsx"), "utf8")).toContain("Crear mi oficina IA");
  });
});
