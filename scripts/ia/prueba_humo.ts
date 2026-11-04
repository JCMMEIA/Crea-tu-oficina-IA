// PRUEBA DE HUMO: UNA llamada mínima y facturable a UN modelo, con tope de costo y confirmación explícita. Sin --confirmo solo muestra lo que haría.
//   npx tsx scripts/ia/prueba_humo.ts --modelo vendor/modelo --precio-in 0.2 --precio-out 0.8 [--max-usd 0.01] --confirmo
import { OpenRouterBackend } from "../../src/server/ai/backends";

(async () => {
  const a = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }; const modelo = a("--modelo"); const pin = Number(a("--precio-in")), pout = Number(a("--precio-out")); const max = Number(a("--max-usd") ?? 0.01);
  if (!modelo || !(pin >= 0) || !(pout >= 0)) { console.log("Uso: --modelo ID --precio-in USD/M --precio-out USD/M [--max-usd 0.01] --confirmo"); process.exit(2); }
  const peor = (60 * pin + 30 * pout) / 1e6; console.log(`Modelo: ${modelo} · peor caso de esta llamada: US$${peor.toFixed(6)} (tope US$${max}).`);
  if (peor > max) { console.log("❌ El peor caso supera el tope: no se llama."); process.exit(3); }
  const be = new OpenRouterBackend(); if (!be.configured()) { console.log("❌ No hay OPENROUTER_API_KEY en el entorno de este proceso (no se imprime). No se llamó a nadie."); process.exit(4); }
  if (!process.argv.includes("--confirmo")) { console.log("Simulacro: añade --confirmo para hacer la llamada (cuesta centavos como máximo)."); process.exit(0); }
  const t0 = Date.now(); try { const r = await be.complete(modelo, { system: "Responde en una frase.", messages: [{ role: "user", content: "Di «hola» en español." }], tools: [], maxTokens: 30 }, { sensitivity: "public" });
    const cost = r.costUsd ?? (r.inputTokens * pin + r.outputTokens * pout) / 1e6; console.log(`✅ Respondió en ${Date.now() - t0} ms · ${r.inputTokens} tokens de entrada, ${r.outputTokens} de salida · costo ${r.costUsd !== undefined ? "reportado por el proveedor" : "estimado"}: US$${cost.toFixed(6)} · proveedor: ${r.providerName ?? "n/d"}\nRespuesta: ${r.text.slice(0, 120)}`); }
  catch (e: any) { console.log(`❌ Falló (${e?.name}): ${String(e?.message ?? e).slice(0, 140)}`); process.exit(1); }
})();
