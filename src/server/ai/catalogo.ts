/**
 * Preselección de candidatos desde el catálogo PÚBLICO de OpenRouter (GET /models). Función PURA y probada con un ejemplo del formato.
 * IMPORTANTE: esto solo propone candidatos por precio, contexto y parámetros soportados. NO decide la política de datos, la disponibilidad, la latencia ni la calidad:
 * eso exige verificación humana en la página del modelo y del proveedor, y la prueba real. El formato del catálogo es el que recordamos de la documentación pública: si cambia, el parser se niega a seleccionar.
 */
export interface CatalogModel { id: string; name?: string; created?: number; context_length?: number; pricing?: { prompt?: string | number; completion?: string | number }; supported_parameters?: string[]; architecture?: { modality?: string; input_modalities?: string[]; output_modalities?: string[] } }
export interface Candidate { id: string; name: string; inUsdMtok: number; outUsdMtok: number; context: number; tools: boolean; json: boolean; created: number | null }
export interface Criteria { slot: "gratuito" | "economico" | "avanzado"; minContext: number; needTools: boolean; maxOutUsdMtok?: number; limit: number }
export const SLOTS: Record<Criteria["slot"], Criteria> = {
  gratuito: { slot: "gratuito", minContext: 16_000, needTools: false, limit: 8 },          // solo para información PÚBLICA, nivel A
  economico: { slot: "economico", minContext: 32_000, needTools: true, maxOutUsdMtok: 3, limit: 8 }, // tareas empresariales nivel B: política «sin entrenamiento» obligatoria (se verifica a mano)
  avanzado: { slot: "avanzado", minContext: 100_000, needTools: true, maxOutUsdMtok: 25, limit: 8 },   // respaldo/nivel C
};
const perMtok = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : null; };
export class CatalogFormatError extends Error {}
export function parseCatalog(json: unknown): Candidate[] {
  const data = (json as any)?.data; if (!Array.isArray(data) || !data.length) throw new CatalogFormatError("El catálogo no trae una lista «data»: el formato cambió o la respuesta no es la esperada.");
  const out: Candidate[] = []; let sinPrecio = 0;
  for (const m of data as CatalogModel[]) {
    if (!m?.id || typeof m.id !== "string") continue; const i = perMtok(m.pricing?.prompt), o = perMtok(m.pricing?.completion); if (i === null || o === null) { sinPrecio++; continue; }
    const textOut = !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text"); if (!textOut) continue;
    out.push({ id: m.id, name: m.name ?? m.id, inUsdMtok: i, outUsdMtok: o, context: Number(m.context_length) || 0, tools: !!m.supported_parameters?.includes("tools"), json: !!(m.supported_parameters?.includes("response_format") || m.supported_parameters?.includes("structured_outputs")), created: typeof m.created === "number" ? m.created : null });
  }
  if (!out.length) throw new CatalogFormatError(`Ningún modelo trae precio legible (${sinPrecio} sin precio): el formato de precios cambió.`);
  return out;
}
/** Candidatos ordenados: primero el más barato y, a igual precio, el más reciente. Los gratuitos exigen precio 0 en entrada Y salida; los de pago, precio > 0 (no se confunde «sin precio» con «gratis»). */
export function shortlist(models: Candidate[], c: Criteria): Candidate[] {
  const base = models.filter((m) => m.context >= c.minContext && (!c.needTools || m.tools) && (c.maxOutUsdMtok === undefined || m.outUsdMtok <= c.maxOutUsdMtok));
  const pool = c.slot === "gratuito" ? base.filter((m) => m.inUsdMtok === 0 && m.outUsdMtok === 0) : base.filter((m) => m.inUsdMtok > 0 && m.outUsdMtok > 0);
  return [...pool].sort((a, b) => a.inUsdMtok + a.outUsdMtok - (b.inUsdMtok + b.outUsdMtok) || (b.created ?? 0) - (a.created ?? 0)).slice(0, c.limit);
}
