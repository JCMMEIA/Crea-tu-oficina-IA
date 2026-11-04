// EVALUACIÓN REAL de modelos con las 8 tareas guiadas (cuesta dinero). Calidad ESTRUCTURAL medida por programa + hoja para revisión humana, costo y latencia por modelo.
//   npx tsx scripts/ia/evaluar.ts modelos.json --dry-run                       → muestra el plan y el costo MÁXIMO posible; NO llama a nadie
//   npx tsx scripts/ia/evaluar.ts modelos.json --max-usd 1 [--rep 1] [--tareas a,b] → ejecuta, y se DETIENE sola al llegar al tope
//   modelos.json = [{ "provider": "openrouter"|"anthropic", "model_id": "...", "price_in_usd_mtok": N, "price_out_usd_mtok": N }]
// Solo usa datos PÚBLICOS inventados (Café Luna): ningún dato real de clientes sale hacia ningún modelo. Sin claves no hace nada. No imprime claves.
import fs from "node:fs";
import { GUIDED_TASKS } from "../../src/features/tasks/catalog";
import { buildInstruction, checkSections } from "../../src/features/tasks/service";
import { AnthropicBackend, OpenRouterBackend } from "../../src/server/ai/backends";

interface M { provider: "openrouter" | "anthropic"; model_id: string; price_in_usd_mtok: number; price_out_usd_mtok: number }
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }; const has = (k: string) => process.argv.includes(k);
const MAX_OUT = 1800; const SYSTEM = "Eres un empleado de IA de una pequeña empresa FICTICIA llamada Café Luna (cafetería en Guadalajara; café de filtro $45, desayuno completo $99; tono cercano y cálido; nunca prometer entregas el mismo día). Responde en español. Si falta un dato, escribe «[por confirmar]» en vez de inventarlo.";
const estTok = (s: string) => Math.ceil(s.length / 3.2);
const STOP = ["el", "la", "de", "que", "y", "en", "un", "para", "con", "tu", "los", "las", "por", "es"];
/** Chequeos automáticos (NO sustituyen la lectura humana). */
export function revisar(texto: string, entrada: string, t: (typeof GUIDED_TASKS)[number]) {
  const sec = checkSections(t, texto); const palabras = texto.toLowerCase().split(/[^a-záéíóúñ]+/).filter(Boolean); const es = palabras.length ? palabras.filter((w) => STOP.includes(w)).length / palabras.length : 0;
  const cifras = (texto.match(/\$\s?\d[\d,.]*|\b\d{2,}\b/g) ?? []).filter((n) => !entrada.includes(n.replace(/\s/g, "")) && !SYSTEM.includes(n.replace(/\s/g, ""))); const afirma = /\b(ya (se )?(publicó|envió)|fue (publicado|enviado)|hemos (publicado|enviado))\b/i.test(texto);
  return { secciones: sec.ok, faltan: sec.missing, espanol: es > 0.12, cifrasNuevas: cifras.slice(0, 4), afirmaAccion: afirma, largo: texto.length };
}
(async () => {
  const file = process.argv[2]; if (!file || file.startsWith("--") || !fs.existsSync(file)) { console.log("Falta el archivo de modelos a evaluar (ver encabezado). No se ejecutó nada."); process.exit(2); }
  const models: M[] = JSON.parse(fs.readFileSync(file, "utf8")); const maxUsd = Number(arg("--max-usd") ?? 1); const rep = Math.max(1, Number(arg("--rep") ?? 1)); const only = arg("--tareas")?.split(",");
  const tasks = GUIDED_TASKS.filter((t) => !only || only.includes(t.key)); const dry = has("--dry-run");
  const plan = models.flatMap((m) => tasks.map((t) => { const answers: Record<string, string> = {}; for (const q of t.questions) answers[q.id] = q.options?.[0] ?? `Ejemplo de prueba para «${q.label}»`; const instr = buildInstruction(t, answers); const tin = estTok(SYSTEM + instr); return { m, t, instr, answers, maxCost: (tin * m.price_in_usd_mtok + MAX_OUT * m.price_out_usd_mtok) / 1e6 * rep }; }));
  const techo = plan.reduce((n, p) => n + p.maxCost, 0);
  console.log(`Plan: ${models.length} modelo(s) × ${tasks.length} tarea(s) × ${rep} repetición(es) = ${plan.length * rep} llamadas. Costo MÁXIMO posible (si cada respuesta usa los ${MAX_OUT} tokens de salida): US$${techo.toFixed(4)}. Tope pedido: US$${maxUsd}.`);
  if (techo > maxUsd) console.log(`⚠️  El máximo posible supera el tope; se detendrá al llegar a US$${maxUsd} de costo REAL acumulado.`); if (dry) { console.log("Simulacro: no se llamó a ningún modelo."); process.exit(0); }
  const be = { openrouter: new OpenRouterBackend(), anthropic: new AnthropicBackend() }; const filas: string[] = []; let gastado = 0; let llamadas = 0;
  outer: for (const p of plan) { if (!be[p.m.provider].configured()) { console.log(`Sin clave para ${p.m.provider}: se omite ${p.m.model_id}`); continue; }
    for (let r = 0; r < rep; r++) { if (gastado >= maxUsd) { console.log(`🛑 Tope alcanzado (US$${gastado.toFixed(4)} ≥ US$${maxUsd}). Se detiene.`); break outer; } const t0 = Date.now();
      try { const out = await be[p.m.provider].complete(p.m.model_id, { system: SYSTEM, messages: [{ role: "user", content: p.instr }], tools: [], maxTokens: MAX_OUT }, { sensitivity: "public" }); llamadas++;
        const cost = out.costUsd ?? (out.inputTokens * p.m.price_in_usd_mtok + out.outputTokens * p.m.price_out_usd_mtok) / 1e6; gastado += cost; const v = revisar(out.text, p.instr, p.t);
        filas.push(`| ${p.m.model_id} | ${p.t.key} | ${p.t.level} | ${v.secciones ? "sí" : "no: " + v.faltan.join(", ")} | ${v.espanol ? "sí" : "REVISAR"} | ${v.cifrasNuevas.length ? "REVISAR: " + v.cifrasNuevas.join(" ") : "ok"} | ${v.afirmaAccion ? "SÍ (mal)" : "no"} | ${out.inputTokens}/${out.outputTokens} | US$${cost.toFixed(5)} | ${Date.now() - t0} ms | | | |`);
      } catch (e: any) { filas.push(`| ${p.m.model_id} | ${p.t.key} | ${p.t.level} | error: ${String(e.message).slice(0, 50)} | – | – | – | – | – | ${Date.now() - t0} ms | | | |`); } } }
  if (!filas.length) { console.log("No se evaluó nada (sin claves)."); process.exit(2); }
  const md = `# Evaluación real de modelos (${new Date().toISOString()})\n\nGasto real acumulado: **US$${gastado.toFixed(4)}** en ${llamadas} llamadas (tope US$${maxUsd}). Las columnas automáticas son chequeos estructurales; **las 3 últimas columnas son para revisión humana** (utilidad 1–5, tono 1–5, ¿se podría enviar tal cual? sí/no).\n\n| Modelo | Tarea | Nivel | Secciones completas | Español | Cifras nuevas | Afirma haber publicado/enviado | Tokens (e/s) | Costo | Latencia | Utilidad | Tono | ¿Enviable? |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n${filas.join("\n")}\n`;
  fs.writeFileSync("docs/ia-router/EVALUACION_REAL.md", md); console.log(md);
})();
