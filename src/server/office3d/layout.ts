import { Desk, OfficeScene, OfficeTheme, SceneBrand, Zone, ZoneStatus } from "./types";
import { getTheme } from "./themes";

export const DESK_W = 1.7, DESK_D = 1.5, PAD = 0.8, GAP = 1.1, MAX_ROW = 20;
const ORDER = ["direccion", "marketing", "ventas", "operaciones", "atencion", "finanzas", "rrhh"];
const COLORS: Record<string, string> = { marketing: "#ec4899", ventas: "#f59e0b", operaciones: "#0ea5e9", finanzas: "#10b981", rrhh: "#8b5cf6", atencion: "#14b8a6", direccion: "#6366f1", automatizaciones: "#64748b" };
const ICONS: Record<string, string> = { marketing: "📣", ventas: "💼", operaciones: "⚙️", finanzas: "💰", rrhh: "🧑‍🤝‍🧑", atencion: "🎧", direccion: "🧭", automatizaciones: "🤖" };
const CYCLE = ["#f97316", "#84cc16", "#06b6d4", "#a855f7", "#ef4444", "#eab308"];

export interface InDesk { id: string; name: string; roleTitle: string; status: "active" | "paused" | "inactive"; skillName: string; skillVersion: number; missingConnections: string[] }
export interface InZone { id: string; key: string; kind: Zone["kind"]; name: string; custom?: boolean; employees: InDesk[]; services: string[]; extraNotes?: string[]; href?: string; companyId?: string; attention?: number }
export interface LayoutInput { kind: OfficeScene["kind"]; title: string; subtitle: string; brand: SceneBrand; zones: InZone[]; themeKey?: string }

/** Columnas del módulo según nº de estaciones (compacto y legible). */
export const colsFor = (n: number) => (n <= 3 ? Math.max(1, n) : n <= 6 ? 3 : 4);

function statusOf(z: InZone): { status: ZoneStatus; label: string; notes: string[] } {
  if (z.kind === "automation") return { status: "ready", label: "Activo", notes: z.extraNotes ?? [] };
  if (!z.employees.length) return { status: "empty", label: z.kind === "client" ? "Sin empleados" : "Sin empleados todavía", notes: ["Contrata empleados para activar esta zona."] };
  const notes: string[] = [...(z.extraNotes ?? [])];
  const paused = z.employees.filter((e) => e.status !== "active");
  if (paused.length) notes.push(`${paused.length} empleado(s) en pausa o inactivos.`);
  const miss = [...new Set(z.employees.flatMap((e) => e.missingConnections))];
  if (miss.length) notes.push(`Falta conectar: ${miss.join(", ")}.`);
  if (z.attention) notes.push(`${z.attention} elemento(s) requieren atención (aprobaciones o tareas fallidas).`);
  return notes.length ? { status: "needs_setup", label: "Requiere configuración", notes } : { status: "ready", label: "Listo", notes: [] };
}

const rank = (z: InZone) => { const i = ORDER.indexOf(z.key); return z.kind === "automation" ? 99 : i === -1 ? 50 : i; };

/**
 * Genera la escena. Funciones puras: mismo input → misma escena. Cada empleado de la entrada produce
 * EXACTAMENTE una estación; no se añade ninguno que no exista.
 */
export function buildScene(input: LayoutInput): OfficeScene {
  const zonesIn = [...input.zones].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  let customIdx = 0;
  // 1) Tamaño de cada módulo
  const sized = zonesIn.map((z) => {
    const n = Math.max(1, z.employees.length), cols = colsFor(n), rows = Math.ceil(n / cols);
    const color = z.kind === "client" ? CYCLE[customIdx++ % CYCLE.length] : z.kind === "automation" ? COLORS.automatizaciones : z.key === "direccion" ? input.brand.color : COLORS[z.key] ?? CYCLE[customIdx++ % CYCLE.length];
    return { z, cols, rows, w: cols * DESK_W + PAD * 2, d: rows * DESK_D + PAD * 2, color };
  });
  // 2) Empaquetado en filas (la recepción va primero)
  const rec = { w: 4.6, d: 3 };
  type Item = { w: number; d: number; ref: (typeof sized)[number] | "reception"; x?: number; z?: number };
  const items: Item[] = [{ w: rec.w, d: rec.d, ref: "reception" }, ...sized.map((s) => ({ w: s.w, d: s.d, ref: s }))];
  let cx = 0, cz = 0, rowD = 0, maxX = 0;
  for (const it of items) {
    if (cx > 0 && cx + it.w > MAX_ROW) { cz += rowD + GAP; cx = 0; rowD = 0; }
    it.x = cx; it.z = cz; cx += it.w + GAP; rowD = Math.max(rowD, it.d); maxX = Math.max(maxX, cx - GAP);
  }
  const totalD = cz + rowD, offX = maxX / 2, offZ = totalD / 2;
  const center = (it: Item) => ({ x: it.x! + it.w / 2 - offX, z: it.z! + it.d / 2 - offZ });
  // 3) Zonas y estaciones
  const zones: Zone[] = [];
  let employees = 0, automations = 0;
  for (const it of items) {
    if (it.ref === "reception") continue;
    const s = it.ref, c = center(it), st = statusOf(s.z);
    const desks: Desk[] = s.z.employees.map((e, i) => {
      const col = i % s.cols, row = Math.floor(i / s.cols), inRow = Math.min(s.cols, s.z.employees.length - row * s.cols);
      return {
        id: e.id, label: e.name, roleTitle: e.roleTitle, departmentName: s.z.name, status: e.status, skillName: e.skillName, skillVersion: e.skillVersion, skillCustomized: e.skillVersion > 1,
        x: c.x + (col - (inRow - 1) / 2) * DESK_W, z: c.z + (row - (s.rows - 1) / 2) * DESK_D,
        href: `/empleados/${e.id}`, skillHref: `/empleados/${e.id}/skill`,
      };
    });
    if (s.z.kind === "automation") automations += desks.length; else employees += desks.length; // las automatizaciones NO cuentan como empleados
    zones.push({ id: s.z.id, key: s.z.key, kind: s.z.kind, label: s.z.name, color: s.color, icon: s.z.kind === "client" ? "🏢" : ICONS[s.z.key] ?? "🧩", x: c.x, z: c.z, w: s.w, d: s.d, status: st.status, statusLabel: st.label, notes: st.notes, services: s.z.services, desks, href: s.z.href, companyId: s.z.companyId });
  }
  const rc = center(items[0]);
  const theme: OfficeTheme = getTheme(input.themeKey);
  return {
    version: 1, kind: input.kind, title: input.title, subtitle: input.subtitle, brand: input.brand, theme,
    reception: { x: rc.x, z: rc.z, w: rec.w, d: rec.d }, zones, bounds: { w: maxX, d: totalD },
    stats: { zones: zones.length, employees, automations }, rooms: [], tour: [],
  };
}

export { COLORS as DEPT_COLORS };
