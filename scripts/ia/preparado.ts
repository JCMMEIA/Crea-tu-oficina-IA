// ¿Está lista la plataforma para ENCENDER el router? Solo lee (base de datos y entorno). No llama a ningún modelo y NO imprime claves ni valores secretos.
//   npm run ia:preparado
import { getDb } from "../../src/server/db";
import { getSettings, listModels, listPlanLimits } from "../../src/server/ai/config";

(async () => {
  const db = await getDb(); const r: { ok: boolean; nivel: "FALTA" | "AVISO" | "OK"; t: string }[] = []; const add = (c: boolean, ok: string, falta: string, aviso = false) => r.push({ ok: c, nivel: c ? "OK" : aviso ? "AVISO" : "FALTA", t: c ? ok : falta });
  const on = process.env.AI_ROUTER === "on"; add(!on, "AI_ROUTER está APAGADO (comportamiento actual: Anthropic directo).", "AI_ROUTER está ENCENDIDO: confirma que ya pasó la prueba real.", true);
  const or = !!process.env.OPENROUTER_API_KEY, an = !!process.env.ANTHROPIC_API_KEY; add(or || an, `Hay clave de proveedor (OpenRouter: ${or ? "sí" : "no"}, Anthropic: ${an ? "sí" : "no"}).`, "No hay ninguna clave de proveedor (OPENROUTER_API_KEY / ANTHROPIC_API_KEY).");
  const models = await listModels(db); const usable = models.filter((m) => m.enabled && m.verified);
  add(usable.length > 0, `${usable.length} modelo(s) activos y verificados.`, "No hay modelos activos y verificados en /admin/ia: el router no ejecutaría nada.");
  add(usable.some((m) => m.tier === "economy"), "Hay un modelo económico verificado (tareas empresariales).", "Falta un modelo ECONÓMICO verificado (nivel B).", true); add(usable.some((m) => m.tier === "premium"), "Hay un modelo avanzado verificado (respaldo / nivel C).", "Falta un modelo AVANZADO verificado de respaldo.", true);
  const free = usable.filter((m) => m.tier === "free"); add(free.length === 0 || free.every((m) => m.data_policy !== "unknown"), "Los modelos gratuitos tienen política de datos definida (solo recibirán datos públicos).", "Un modelo gratuito activo tiene política de datos «unknown».");
  add(usable.filter((m) => m.tier !== "free").every((m) => m.price_in_usd_mtok > 0 && m.price_out_usd_mtok > 0), "Todos los modelos de pago tienen precio.", "Hay modelos de pago sin precio.");
  add(usable.filter((m) => m.tier !== "free").every((m) => m.data_policy === "no_training" || m.data_policy === "zero_retention"), "Los modelos de pago activos tienen política «sin entrenamiento» o «retención cero» verificada.", "Un modelo de pago activo no tiene política «sin entrenamiento»/«retención cero»: no podría recibir datos internos.", true);
  const s = await getSettings(db); add(s.maxCallUsd <= 0.1, `Tope por llamada: US$${s.maxCallUsd}.`, `El tope por llamada (US$${s.maxCallUsd}) es alto para una prueba pequeña (recomendado ≤ 0.10).`, true); add(!s.allowPaidFallback, "Un gratuito que falla NO escala a pago (regla de la cuenta).", "Se permite escalar de gratuito a pago (confírmalo conscientemente).", true);
  const lim = await listPlanLimits(db); add(lim.length > 0 && lim.every((l) => l.monthly_budget_usd > 0 && l.max_task_usd <= l.monthly_budget_usd), `${lim.length} plan(es) con cuota y tope de gasto.`, "Faltan límites por plan o son incoherentes.");
  for (const x of r) console.log(`${x.nivel === "OK" ? "✅" : x.nivel === "AVISO" ? "⚠️ " : "❌"} ${x.t}`);
  const falta = r.filter((x) => x.nivel === "FALTA").length; console.log(falta ? `\nNO LISTO para encender el router (${falta} requisito(s) faltan).` : "\nLISTO para PROBAR el router en un entorno controlado. Enciéndelo (AI_ROUTER=on) solo con tu autorización y tras la prueba real."); process.exit(falta ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e?.message); process.exit(1); });
