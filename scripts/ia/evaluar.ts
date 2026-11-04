// EVALUACIÓN REAL de modelos con las 8 tareas guiadas (cuesta dinero: usa las claves del servidor). Mide calidad estructural, costo y latencia POR MODELO.
//   OPENROUTER_API_KEY=… ANTHROPIC_API_KEY=… npx tsx scripts/ia/evaluar.ts modelos.json      (modelos.json = lista de { provider, model_id, price_in_usd_mtok, price_out_usd_mtok })
// Sin claves o sin lista de modelos NO hace nada y lo dice: una evaluación simulada no es una evaluación. No imprime claves.
import fs from "node:fs";
import { GUIDED_TASKS } from "../../src/features/tasks/catalog";
import { buildInstruction, checkSections } from "../../src/features/tasks/service";
import { AnthropicBackend, OpenRouterBackend } from "../../src/server/ai/backends";

(async () => {
  const file = process.argv[2]; if (!file || !fs.existsSync(file)) { console.log("Falta el archivo de modelos a evaluar (ver encabezado). No se ejecutó nada."); process.exit(2); }
  const models: { provider: "openrouter" | "anthropic"; model_id: string; price_in_usd_mtok: number; price_out_usd_mtok: number }[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const be = { openrouter: new OpenRouterBackend(), anthropic: new AnthropicBackend() }; const rows: string[] = []; let skipped = 0;
  for (const m of models) { if (!be[m.provider].configured()) { console.log(`Sin clave para ${m.provider}: se omite ${m.model_id}`); skipped++; continue; }
    for (const t of GUIDED_TASKS) {
      const answers: Record<string, string> = {}; for (const q of t.questions) answers[q.id] = (q.options?.[0]) ?? `Ejemplo de prueba para «${q.label}»`; const instr = buildInstruction(t, answers); const t0 = Date.now();
      try { const r = await be[m.provider].complete(m.model_id, { system: "Eres un empleado de IA de una pequeña empresa ficticia llamada Café Luna (cafetería en Guadalajara). Responde en español.", messages: [{ role: "user", content: instr }], tools: [], maxTokens: 1800 }, { sensitivity: "public" });
        const ok = checkSections(t, r.text); const cost = r.costUsd ?? (r.inputTokens * m.price_in_usd_mtok + r.outputTokens * m.price_out_usd_mtok) / 1e6;
        rows.push(`| ${m.model_id} | ${t.key} | ${t.level} | ${ok.ok ? "sí" : "no: " + ok.missing.join(", ")} | ${r.inputTokens}/${r.outputTokens} | US$${cost.toFixed(5)} | ${Date.now() - t0} ms |`);
      } catch (e: any) { rows.push(`| ${m.model_id} | ${t.key} | ${t.level} | error: ${String(e.message).slice(0, 60)} | – | – | ${Date.now() - t0} ms |`); }
    } }
  if (!rows.length) { console.log("No se evaluó ningún modelo (sin claves)."); process.exit(2); }
  const md = `# Evaluación real de modelos (${new Date().toISOString()})\n\nCalidad MEDIDA solo de forma estructural (secciones pedidas presentes). La calidad de redacción requiere revisión humana.\n\n| Modelo | Tarea | Nivel | Secciones completas | Tokens (e/s) | Costo | Latencia |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
  fs.writeFileSync("docs/ia-router/EVALUACION_REAL.md", md); console.log(md);
})();
