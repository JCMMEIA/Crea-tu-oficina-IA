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
import { CAMINOS, AFILIADOS_PAGE, COMISIONES, GESTIONADO_PAGE } from "@/features/funnel/config/caminos";

const root = process.cwd();
const walk = (d: string): string[] => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const funnelSrc = walk("src/features/funnel").filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => [f, fs.readFileSync(path.join(root, f), "utf8")] as const);

// Red de seguridad para la integración con el PR #3: solo corre cuando el catálogo de tareas guiadas existe en el árbol (tras fusionarlo).
const hasCatalog = fs.existsSync(path.join(root, "src/features/tasks/catalog.ts"));
describe.runIf(hasCatalog)("integración con el catálogo real de tareas guiadas (PR #3)", () => {
  it("las 8 tareas de la landing coinciden con el catálogo: claves, empleados responsables y áreas", () => {
    // Se lee como TEXTO (sin importarlo) para que esta rama compile aunque el catálogo aún no exista.
    const src = fs.readFileSync(path.join(root, "src/features/tasks/catalog.ts"), "utf8"); const g = [...src.matchAll(/\{ key: "([a-z0-9-]+)",[^{}]*?area: "([a-z]+)", employeeKey: "([a-z0-9-]+)"/g)].map((m) => ({ key: m[1], area: m[2], employeeKey: m[3] }));
    expect(g.map((t) => t.key).sort()).toEqual(TAREAS.map((t) => t.key).sort());
    for (const c of g) { const l = TAREAS.find((t) => t.key === c.key)!; expect(l.empleadoKey, c.key).toBe(c.employeeKey); expect(l.area, c.key).toBe(c.area); }
  });
  it("las funciones que el PR #3 construye siguen etiquetadas «en revisión» hasta cambiarlas a propósito", () => { for (const k of ["cerebro", "tareasGuiadas", "resultados", "consumo"]) expect(estadoDe(k)).toBe("en_revision"); });
});
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
      expect(src, f).not.toMatch(/\b(150|200)\+?\s*(tareas|workflows)/i); expect(src, f).not.toMatch(/garantizamos|garantizado|aumenta(rá)? tus ventas|resultados garantizados/i);
      expect(src, f).not.toMatch(/★|⭐|Carlos Méndez|Ana Rivas|Diego Salazar/); if (f.includes("/config/")) expect(f.endsWith("config/caminos.ts") ? src.replace(/20 % del cobro neto elegible/g, "") : src, f).not.toMatch(/\b\d{2,3}\s?%/); // porcentajes de éxito inventados (única excepción: la PROPUESTA de comisión, marcada «sin aprobar»)
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
  it("los dos caminos y el servicio secundario: sin precios, comisiones ni promesas; el afiliado es solo lista de interés", () => {
    expect(CAMINOS.oficina.nombre).toBe("Quiero mi Oficina IA"); expect(CAMINOS.afiliado.nombre).toBe("Quiero ser afiliado"); expect(CAMINOS.gestionado.nombre).toBe("Nosotros administramos tu oficina");
    const txt = JSON.stringify({ CAMINOS, AFILIADOS_PAGE, GESTIONADO_PAGE }); expect(txt).not.toMatch(/\$\s?\d|\d\s?%|garantizad|ganarás/i);
    // Las comisiones se explican como PROPUESTA sin aprobar, sin importes en pesos ni ejemplos de ganancias
    const com = JSON.stringify(COMISIONES); expect(com).toMatch(/sin aprobar/); expect(com).toMatch(/No es una oferta ni una promesa de ingresos/); expect(com).not.toMatch(/\$\s?\d|garantizad|ganarás|ganar[áa]s/i); expect(txt).toMatch(/no una aparte|no una tercera/i);
    expect(estadoDe("afiliados")).toBe("proximamente"); expect(estadoDe("servicioGestionado")).not.toBe("disponible");
    const code = funnelSrc.map(([, s]) => s).join("\n"); expect(code).not.toMatch(/\/r\/|cto_ref|affiliate_commissions|AFFILIATE_TERMS/); // el programa NO está implementado en esta rama
  });
  it("el hero usa el título y los dos botones pedidos", () => {
    const c = fs.readFileSync(path.join(root, "src/features/funnel/config/content.ts"), "utf8"); expect(c).toContain("Tu empresa merece un equipo completo."); expect(c).toContain("Ahora puedes construirlo con IA.");
    const h = fs.readFileSync(path.join(root, "src/features/funnel/components/Hero.tsx"), "utf8"); expect(h).toContain("Conocer cómo funciona"); expect(fs.readFileSync(path.join(root, "src/features/funnel/components/BuyButton.tsx"), "utf8")).toContain("Crear mi oficina IA");
  });
});
