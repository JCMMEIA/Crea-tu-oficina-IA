/**
 * «Personaliza tu oficina»: modelo puro (sin base de datos, sin React) compartido por servidor y navegador.
 *
 * Dos decisiones INDEPENDIENTES: ESTILO (cómo se ve) × ESPACIO (dónde está). Se combinan con temas, materiales,
 * luces, fondos y decoración reutilizables: 7 estilos × 6 espacios = 42 combinaciones sin construir 42 mundos.
 * Es solo presentación: nunca toca empleados, departamentos, permisos, tareas ni planes.
 *
 * Relación con la personalización que ya existía (`agencies.brand.style`: moderno/cálido/fresco): ese «tono de colores»
 * SIGUE siendo la base. El estilo temático solo lo sustituye cuando se elige uno distinto de «clasico».
 *
 * Los nombres públicos son ORIGINALES. Las referencias de marcas de las que partió la idea viven solo en notas internas.
 */
import { BackdropKind, DecorKind, OfficeTheme, PatternKind, ThemeLook } from "./types";
import { getTheme } from "./themes";

export const STYLE_KEYS = ["clasico", "bloques", "heroes", "cuentos", "desierto", "submarino", "personalizado"] as const;
export const SPACE_KEYS = ["clasica", "mansion", "corporativo", "penthouse", "grande", "playa"] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];
export type SpaceKey = (typeof SPACE_KEYS)[number];
export interface FxFlags { animations: boolean; lights: boolean; premium: boolean; immersive: boolean; reduceMotion: boolean }
export interface OfficeDesign { style: StyleKey; space: SpaceKey; fx: FxFlags; description: string }

export const MAX_DESCRIPTION = 300;
export const DEFAULT_FX: FxFlags = { animations: true, lights: true, premium: true, immersive: true, reduceMotion: false };
export const DEFAULT_DESIGN: OfficeDesign = { style: "clasico", space: "clasica", fx: DEFAULT_FX, description: "" };

/** Tarjetas de la galería (texto que ve la persona). */
export const STYLE_INFO: Record<StyleKey, { name: string; blurb: string }> = {
  clasico: { name: "Aspecto limpio", blurb: "Neutro y ordenado, como siempre." },
  bloques: { name: "Mundo de bloques", blurb: "Piezas de colores para armar tu equipo." },
  heroes: { name: "Ciudad de héroes", blurb: "Neón, paneles holográficos y noche futurista." },
  cuentos: { name: "Reino de cuentos", blurb: "Torres, estrellas y destellos de magia." },
  desierto: { name: "Laboratorio del desierto", blurb: "Probetas, cactus y atardecer naranja." },
  submarino: { name: "Fondo del mar", blurb: "Corales, burbujas y colores de caricatura." },
  personalizado: { name: "Diseño personalizado", blurb: "Descríbelo y armamos la combinación." },
};
export const SPACE_INFO: Record<SpaceKey, { name: string; blurb: string }> = {
  clasica: { name: "Oficina clásica", blurb: "Escritorios, plantas y luz de día." },
  mansion: { name: "Mansión", blurb: "Columnas, jardín y piso de madera." },
  corporativo: { name: "Edificio corporativo", blurb: "Ventanales sobre una ciudad de cristal." },
  penthouse: { name: "Penthouse de lujo", blurb: "Mármol, sofás y la ciudad de noche." },
  grande: { name: "Empresa grande", blurb: "Gran salón con columnas y pantallas." },
  playa: { name: "Oficina en la playa", blurb: "Mar, palmeras y conexión satelital." },
};
export const FX_INFO: { key: keyof FxFlags; name: string; hint: string }[] = [
  { key: "animations", name: "Animaciones suaves", hint: "Pequeños movimientos de la decoración." },
  { key: "lights", name: "Luces dinámicas", hint: "Brillos y neones que respiran." },
  { key: "premium", name: "Detalles premium", hint: "Más decoración y acabados." },
  { key: "immersive", name: "Ambiente inmersivo", hint: "Ventanales, cielo y fondo de escena." },
  { key: "reduceMotion", name: "Reducir movimiento", hint: "Apaga todo movimiento (más cómodo y ligero)." },
];

interface Palette { floor: string; wall: string; bgFrom: string; bgTo: string; accent: string; accent2: string; desk: string; deskTop: string; screen: string; lightColor: string; ambient: number; sun: number; pattern: PatternKind; decor: DecorKind[]; skyFrom?: string; skyTo?: string }
const PALETTES: Record<Exclude<StyleKey, "clasico" | "personalizado">, Palette> = {
  bloques: { floor: "#f3e3b5", wall: "#e63946", bgFrom: "#bfe3ff", bgTo: "#fff4cc", accent: "#ffb703", accent2: "#2a9d8f", desk: "#3a86ff", deskTop: "#ffd166", screen: "#1f2937", lightColor: "#fff1d6", ambient: 0.9, sun: 1.1, pattern: "studs", decor: ["blocks", "plant", "blocks", "star"] },
  heroes: { floor: "#20264a", wall: "#343a78", bgFrom: "#0b1026", bgTo: "#2a1050", accent: "#ff2e63", accent2: "#08d9d6", desk: "#2b3166", deskTop: "#475091", screen: "#08d9d6", lightColor: "#9ad0ff", ambient: 0.55, sun: 0.8, pattern: "grid", decor: ["neon", "holo", "tower", "neon"], skyFrom: "#0b1026", skyTo: "#4b1d7a" },
  cuentos: { floor: "#efe2ff", wall: "#c9b1f2", bgFrom: "#ffd9ec", bgTo: "#b9a7ff", accent: "#ffd166", accent2: "#ff7eb6", desk: "#d9c2f5", deskTop: "#f7e8ff", screen: "#6d5acd", lightColor: "#fff0c9", ambient: 0.95, sun: 1, pattern: "none", decor: ["tower", "star", "crystal", "star"], skyFrom: "#ffb3d9", skyTo: "#b9a7ff" },
  desierto: { floor: "#ebcb9a", wall: "#b8743d", bgFrom: "#ffcf8a", bgTo: "#ff8a5c", accent: "#7bd88f", accent2: "#ff6b3d", desk: "#a9753f", deskTop: "#d9b17a", screen: "#3b5d3a", lightColor: "#ffd9a0", ambient: 0.85, sun: 1.15, pattern: "sand", decor: ["cactus", "flask", "cactus", "flask"], skyFrom: "#ffd28a", skyTo: "#ff7a55" },
  submarino: { floor: "#c3ecf4", wall: "#2b8fb8", bgFrom: "#7fe0e8", bgTo: "#1767a6", accent: "#ffb347", accent2: "#ff6f91", desk: "#e8c36a", deskTop: "#f6e7b4", screen: "#0f4c75", lightColor: "#d6fbff", ambient: 0.9, sun: 0.95, pattern: "waves", decor: ["coral", "bubble", "coral", "bubble"], skyFrom: "#7fe0e8", skyTo: "#1767a6" },
};
interface SpaceDef { margin: number; pattern: PatternKind; backdrop: BackdropKind | null; skyFrom: string; skyTo: string; decor: DecorKind[]; ambient?: number; sun?: number }
const SPACES: Record<SpaceKey, SpaceDef> = {
  clasica: { margin: 2.5, pattern: "none", backdrop: null, skyFrom: "#dbe7f3", skyTo: "#f4f7fb", decor: ["plant"] },
  mansion: { margin: 3.2, pattern: "planks", backdrop: "garden", skyFrom: "#bfe6ff", skyTo: "#e8f7d4", decor: ["column", "fountain", "lamp", "plant"] },
  corporativo: { margin: 2.8, pattern: "tiles", backdrop: "skyline", skyFrom: "#9cc9ff", skyTo: "#e6f1ff", decor: ["plant", "lamp", "sofa"] },
  penthouse: { margin: 3, pattern: "marble", backdrop: "night", skyFrom: "#0b1030", skyTo: "#5b2a86", decor: ["sofa", "lamp", "plant", "lamp"], ambient: 0.7, sun: 0.85 },
  grande: { margin: 4, pattern: "grid", backdrop: "hall", skyFrom: "#cfd8e6", skyTo: "#eef2f8", decor: ["column", "lamp", "plant", "column"] },
  playa: { margin: 3.5, pattern: "sand", backdrop: "sea", skyFrom: "#8fdcff", skyTo: "#e6f9ff", decor: ["palm", "dish", "plant", "palm"] },
};

const isStyle = (v: unknown): v is StyleKey => typeof v === "string" && (STYLE_KEYS as readonly string[]).includes(v);
const isSpace = (v: unknown): v is SpaceKey => typeof v === "string" && (SPACE_KEYS as readonly string[]).includes(v);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
export const cleanDescription = (v: unknown) =>
  (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION);

/** Acepta CUALQUIER cosa (JSON guardado, formulario, datos viejos o dañados) y devuelve un diseño válido. Nunca lanza. */
export function sanitizeDesign(raw: unknown): OfficeDesign {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const f = r.fx && typeof r.fx === "object" ? r.fx : {};
  return {
    style: isStyle(r.style) ? r.style : "clasico", space: isSpace(r.space) ? r.space : "clasica", description: cleanDescription(r.description),
    fx: { animations: bool(f.animations, true), lights: bool(f.lights, true), premium: bool(f.premium, true), immersive: bool(f.immersive, true), reduceMotion: bool(f.reduceMotion, false) },
  };
}
/** ¿Hay algo elegido? Si no, la oficina se ve EXACTAMENTE como antes de existir esta función. */
export const isCustomized = (d: OfficeDesign) => d.style !== "clasico" || d.space !== "clasica";

// ---------- Diseño personalizado: reglas locales (palabras clave → combinación). SIN IA, SIN costo, SIN red. ----------
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
type StyleReal = Exclude<StyleKey, "clasico" | "personalizado">;
const STYLE_WORDS: Record<StyleReal, string[]> = {
  bloques: ["bloque", "lego", "ladrillo", "construc", "piezas", "armable", "juguete"],
  heroes: ["heroe", "superheroe", "comic", "futur", "neon", "cyber", "robot", "holograf", "tecnolog", "ciudad de noche"],
  cuentos: ["magia", "magic", "cuento", "castillo", "princes", "fantasia", "hada", "encant", "reino", "dragon", "unicornio"],
  desierto: ["desierto", "laboratorio", "quimic", "cientific", "probeta", "cactus", "western", "vaquero", "thriller", "arena roja"],
  submarino: ["submarin", "oceano", "bajo el agua", "fondo del mar", "coral", "pez", "peces", "buceo", "caricatura", "acuario", "burbuja"],
};
const SPACE_WORDS: Record<SpaceKey, string[]> = {
  clasica: ["clasica", "tradicional", "sencilla", "normal", "simple", "de siempre"],
  mansion: ["mansion", "casa grande", "jardin", "villa", "hacienda", "castillo"],
  corporativo: ["edificio", "rascacielos", "corporativ", "torre de oficinas", "ejecutiv"],
  penthouse: ["penthouse", "lujo", "atico", "elegante", "exclusiv", "sofisticad"],
  grande: ["empresa grande", "gran empresa", "multinacional", "enorme", "campus", "salon grande", "corporacion"],
  playa: ["playa", "isla", "caribe", "tropical", "palmera", "satelit", "starlink", "nomada", "vacaciones", "frente al mar"],
};
const COLOR_WORDS: [string, string][] = [["rosa", "#ec4899"], ["rojo", "#ef4444"], ["naranja", "#f97316"], ["dorado", "#f5b301"], ["amarillo", "#facc15"], ["verde", "#22c55e"], ["turquesa", "#14b8a6"], ["azul", "#3b82f6"], ["morado", "#8b5cf6"], ["violeta", "#8b5cf6"], ["negro", "#334155"]];

export interface Suggestion {
  understood: boolean; style: StyleReal | null; space: SpaceKey | null; accent: string | null;
  fx: Partial<FxFlags>; matched: string[]; summary: string;
}
const count = (text: string, words: string[], hits: string[]) => words.reduce((n, w) => { if (text.includes(w)) { hits.push(w); return n + 1; } return n; }, 0);
const best = <K extends string>(scores: [K, number][]): K | null => { let b: [K, number] | null = null; for (const s of scores) if (s[1] > 0 && (!b || s[1] > b[1])) b = s; return b ? b[0] : null; };

/** Propone una combinación de lo que YA existe. Determinista: la misma descripción da siempre lo mismo. */
export function suggestFromDescription(description: string): Suggestion {
  const text = norm(cleanDescription(description)); const hits: string[] = [];
  const style = best((Object.keys(STYLE_WORDS) as StyleReal[]).map((k) => [k, count(text, STYLE_WORDS[k], hits)] as [StyleReal, number]));
  const space = best(SPACE_KEYS.map((k) => [k, count(text, SPACE_WORDS[k], hits)] as [SpaceKey, number]));
  const accent = COLOR_WORDS.find(([w]) => new RegExp(`\\b${w}`).test(text))?.[1] ?? null;
  const fx: Partial<FxFlags> = {};
  if (/sin (animacion|movimiento)|quiet|estatic|sin mover/.test(text)) { fx.animations = false; fx.reduceMotion = true; hits.push("sin movimiento"); }
  if (/sin luces|luces apagad/.test(text)) { fx.lights = false; hits.push("sin luces"); }
  if (/minimalista|sobri|sin adorno|sin decorac/.test(text)) { fx.premium = false; hits.push("minimalista"); }
  if (/inmersiv/.test(text)) { fx.immersive = true; hits.push("inmersivo"); }
  const understood = !!(style || space || accent || Object.keys(fx).length);
  const parts = [style && `estilo «${STYLE_INFO[style].name}»`, space && `espacio «${SPACE_INFO[space].name}»`, accent && "tu color de acento", Object.keys(fx).length ? "ajustes de movimiento y luces" : null].filter(Boolean);
  return { understood, style, space, accent, fx, matched: [...new Set(hits)], summary: understood ? `Propuesta: ${parts.join(" + ")}.` : "No reconocí palabras que pueda convertir en estilo o espacio. Prueba con ideas como «bloques», «magia», «laboratorio», «mar», «mansión», «penthouse» o «playa»." };
}
/** Estilo que realmente se dibuja: el elegido, o (si es «personalizado») el que salga de la descripción. */
export function effectiveStyle(d: OfficeDesign): { style: Exclude<StyleKey, "personalizado">; accent: string | null } {
  if (d.style !== "personalizado") return { style: d.style, accent: null };
  const s = suggestFromDescription(d.description); return { style: s.style ?? "clasico", accent: s.accent };
}

// ---------- Resolver el tema ----------
/**
 * Combina estilo × espacio × interruptores × tono heredado. `legacyKey` es `brand.style` (moderno/cálido/fresco).
 * Sin nada elegido devuelve el tema heredado SIN `look`: el resultado es idéntico al de antes.
 */
export function resolveTheme(design: OfficeDesign, legacyKey?: string): OfficeTheme {
  const base = getTheme(legacyKey);
  if (!isCustomized(design)) return base;
  const eff = effectiveStyle(design); const sp = SPACES[design.space];
  const pal = eff.style === "clasico" ? null : PALETTES[eff.style];
  const motion = design.fx.animations && !design.fx.reduceMotion;
  const accent = eff.accent ?? pal?.accent ?? "#8b5cf6";
  const decor = [...(pal?.decor ?? []), ...sp.decor];
  const look: ThemeLook = {
    style: design.style, space: design.space, label: `${STYLE_INFO[design.style].name} · ${SPACE_INFO[design.space].name}`,
    bgFrom: pal?.bgFrom ?? "#ece9ff", bgTo: pal?.bgTo ?? "#f7f7f5", accent, accent2: pal?.accent2 ?? "#6366f1",
    desk: pal?.desk ?? "#cfcac0", deskTop: pal?.deskTop ?? "#e5e1d8", screen: pal?.screen ?? "#1f2937",
    lightColor: pal?.lightColor ?? "#ffffff", ambient: (pal?.ambient ?? 0.85) * (sp.ambient ? sp.ambient / 0.85 : 1), sun: (pal?.sun ?? 1.1) * (sp.sun ? sp.sun / 1.1 : 1),
    margin: sp.margin, pattern: sp.pattern !== "none" ? sp.pattern : pal?.pattern ?? "none",
    backdrop: sp.backdrop, skyFrom: pal?.skyFrom ?? sp.skyFrom, skyTo: pal?.skyTo ?? sp.skyTo,
    decor: design.fx.premium ? decor : decor.slice(0, 4),
    fx: { motion, lights: design.fx.lights, premium: design.fx.premium, immersive: design.fx.immersive },
  };
  return { key: `${design.style}+${design.space}`, floor: pal?.floor ?? base.floor, wall: pal?.wall ?? base.wall, accent, premium: design.fx.premium, look };
}

// ---------- Colocación de la decoración (pura: mismas medidas → mismas posiciones) ----------
export interface DecorItem { kind: DecorKind; x: number; z: number; s: number; i: number }
/** Reparte la decoración por el perímetro libre (fuera de las zonas, que están dentro de `bounds`). */
export function placeDecor(look: ThemeLook, bounds: { w: number; d: number }): DecorItem[] {
  const hw = bounds.w / 2 + look.margin, hd = bounds.d / 2 + look.margin, inset = 0.9;
  const slots: [number, number][] = [];
  const along = (len: number, step: number) => Math.max(1, Math.round(len / step));
  const nx = along(hw * 2, 5), nz = along(hd * 2, 5);
  for (let i = 0; i <= nx; i++) { const x = -hw + inset + (i / nx) * (hw * 2 - inset * 2); slots.push([x, hd - inset]); if (look.fx.premium) slots.push([x, -hd + inset]); }
  for (let i = 1; i < nz; i++) { const z = -hd + inset + (i / nz) * (hd * 2 - inset * 2); slots.push([hw - inset, z]); slots.push([-hw + inset, z]); }
  const cap = look.fx.premium ? 16 : 8;
  const kinds = look.decor.length ? look.decor : (["plant"] as DecorKind[]);
  // Orden estable que reparte los tipos: esquinas primero, luego alternando lados.
  const order = slots.map((p, i) => ({ p, k: (i * 7) % slots.length })).sort((a, b) => a.k - b.k).map((o) => o.p).slice(0, cap);
  return order.map(([x, z], i) => ({ kind: kinds[i % kinds.length], x: +x.toFixed(2), z: +z.toFixed(2), s: 1, i }));
}
