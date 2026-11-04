// Lee el catálogo PÚBLICO de OpenRouter (sin clave, sin costo) y escribe una preselección de candidatos con la fecha de consulta.
//   npx tsx scripts/ia/catalogo_openrouter.ts        (requiere que el servidor donde corre pueda abrir openrouter.ai)
// No verifica política de datos, disponibilidad, latencia ni calidad: ver docs/ia-router/SELECCION_MODELOS.md.
import fs from "node:fs";
import { CatalogFormatError, SLOTS, parseCatalog, shortlist } from "../../src/server/ai/catalogo";

(async () => {
  const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  let json: unknown; try { const r = await fetch(`${base}/models`, { signal: AbortSignal.timeout(30_000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); json = await r.json(); }
  catch (e: any) { console.log(`❌ No se pudo leer ${base}/models (${String(e?.message ?? e).slice(0, 120)}). Si es un problema de red, hay que permitir el dominio openrouter.ai en este servidor. No se escribió nada.`); process.exit(2); }
  let cands; try { cands = parseCatalog(json); } catch (e) { console.log("❌", e instanceof CatalogFormatError ? e.message : e); process.exit(3); }
  const fecha = new Date().toISOString().slice(0, 10); let md = `# Preselección de candidatos de OpenRouter — consultado el ${fecha}\n\nFuente: \`${base}/models\` (catálogo público). **Solo propone por precio, contexto y parámetros; la política de datos, la disponibilidad, la latencia y la calidad se verifican a mano y con la prueba real.** ${cands.length} modelos de texto con precio legible.\n\n`;
  for (const slot of ["gratuito", "economico", "avanzado"] as const) { const c = SLOTS[slot]; const l = shortlist(cands, c); md += `## ${slot}\n\nCriterios: contexto ≥ ${c.minContext}${c.needTools ? ", admite herramientas" : ""}${c.maxOutUsdMtok ? `, salida ≤ US$${c.maxOutUsdMtok}/M` : ""}.\n\n| Modelo | Entrada US$/M | Salida US$/M | Contexto | Herramientas | JSON |\n|---|---|---|---|---|---|\n${l.map((m) => `| \`${m.id}\` | ${m.inUsdMtok.toFixed(3)} | ${m.outUsdMtok.toFixed(3)} | ${m.context} | ${m.tools ? "sí" : "no"} | ${m.json ? "sí" : "no"} |`).join("\n") || "| (ninguno cumple) | | | | | |"}\n\n`; }
  fs.writeFileSync(`docs/ia-router/CATALOGO_OPENROUTER_${fecha}.md`, md); fs.writeFileSync(`docs/ia-router/CATALOGO_OPENROUTER_${fecha}.json`, JSON.stringify(cands, null, 1)); console.log(md);
})();
