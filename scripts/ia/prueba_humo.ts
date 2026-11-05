// PRUEBA DE HUMO de OpenRouter con Claude Sonnet 5.5: como máximo UNA solicitud, sin reintentos, con las restricciones de privacidad y de precio fijadas en la propia solicitud.
// No depende del router, de AI_ROUTER ni del catálogo de /admin/ia. Sin la autorización explícita solo hace un SIMULACRO LOCAL (cero llamadas, cero costo).
//   npx tsx scripts/ia/prueba_humo.ts                                    → simulacro local (muestra parámetros, proveedores y costo máximo estimado)
//   npx tsx scripts/ia/prueba_humo.ts --consultar-clave                  → SOLO LECTURA (GET /key, no factura): límite propio y guardrails de la clave
//   npx tsx scripts/ia/prueba_humo.ts --autorizo-una-llamada-facturable  → UNA llamada real (peor caso estimado ≈ US$0.0005; presupuesto máximo US$0.01)
// Los cálculos de tokens son ESTIMACIONES conservadoras, no un límite absoluto de facturación: el tope que se impone al proveedor es provider.max_price y max_tokens.
import { HUMO, HumoAbort, assertSafeBody, buildBody, ceiling, checkBudget, describeKey, estimateInputTokens, resolveBase, sendOnce } from "./humo_lib";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }; const has = (k: string) => process.argv.includes(k);
(async () => {
  try {
    const base = resolveBase(process.env.OPENROUTER_BASE_URL); const key = process.env.OPENROUTER_API_KEY ?? ""; const live = has("--autorizo-una-llamada-facturable");
    const budget = arg("--max-usd") === undefined ? HUMO.budgetUsd : Number(arg("--max-usd")); const body = buildBody(); const c = ceiling(); const b = checkBudget(budget);
    if (has("--consultar-clave")) {
      if (!key) throw new HumoAbort("No hay OPENROUTER_API_KEY en el entorno de este proceso (no se muestra). No se consultó nada.", 4);
      const r = await fetch(`${base}/key`, { method: "GET", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${key}` } }); const j: any = await r.json().catch(() => null);
      if (!r.ok) throw new HumoAbort(`OpenRouter respondió ${r.status} a la consulta de la clave.`, 1); console.log("Consulta de SOLO LECTURA (no factura):"); for (const l of describeKey(j)) console.log("  " + l); process.exit(0);
    }
    console.log("═══ PRUEBA DE HUMO · Claude Sonnet 5.5 en OpenRouter ═══");
    console.log(`Modelo: ${HUMO.model} · solicitudes: EXACTAMENTE 1 (sin reintentos, sin modelos alternativos, sin herramientas)`);
    console.log(`Proveedores autorizados (provider.only): ${HUMO.providers.join(", ")}`);
    console.log(`Privacidad: provider.zdr=true · provider.data_collection="deny" · provider.allow_fallbacks=false`);
    console.log(`Tope de precio (provider.max_price, US$/M tokens): entrada ${c.prompt} · salida ${c.completion}  (tarifas verificadas ${HUMO.priceUsdMtok.in} / ${HUMO.priceUsdMtok.out} × margen ${HUMO.priceMargin})`);
    console.log(`Prompt: ficticio y fijo (${HUMO.system.length + HUMO.user.length} caracteres) · max_tokens de salida: ${HUMO.maxTokens}`);
    console.log(`Costo MÁXIMO estimado: US$ ${b.worstUsd.toFixed(6)} (≈ ${estimateInputTokens()} tokens de entrada × ${HUMO.inputTokenMargin} + ${HUMO.maxTokens} de salida, a los topes de precio) · presupuesto previsto: US$ ${budget}`);
    console.log("Aviso: son estimaciones conservadoras de control, NO un límite absoluto de facturación (el conteo de tokens es aproximado y el costo final lo informa OpenRouter).");
    console.log(`Clave OPENROUTER_API_KEY: ${key ? "definida (no se muestra)" : "NO definida"} · destino: ${base}`);
    const problems = assertSafeBody(body); if (problems.length) throw new HumoAbort(`Cuerpo inseguro: ${problems.join("; ")}`, 3); if (!b.ok) throw new HumoAbort(`Se aborta: ${b.reason}`, 3);
    if (!live) { console.log("\nSIMULACRO LOCAL: no se hizo ninguna llamada y no se gastó nada. Para ejecutar la llamada real hace falta tu autorización expresa: --autorizo-una-llamada-facturable"); process.exit(0); }
    console.log("\nAutorización recibida: se envía UNA solicitud…"); const t0 = Date.now(); const r = await sendOnce(body, { base, key, budgetUsd: budget });
    if (r.status !== 200 || !r.json?.choices?.[0]) { console.log(`❌ OpenRouter respondió ${r.status}: ${String(r.json?.error?.message ?? "sin detalle").slice(0, 160)}. No se reintentó.`); process.exit(1); }
    const u = r.json.usage ?? {}; const cost = typeof u.cost === "number" ? u.cost : undefined; const prov = String(r.json.provider ?? "desconocido");
    console.log(`✅ Respondió en ${Date.now() - t0} ms · proveedor: ${prov} · ${u.prompt_tokens ?? "?"} tokens de entrada, ${u.completion_tokens ?? "?"} de salida · costo ${cost !== undefined ? "reportado por OpenRouter" : "NO reportado"}: ${cost !== undefined ? `US$ ${cost.toFixed(6)}` : "—"}`);
    console.log(`   Respuesta: «${String(r.json.choices[0].message?.content ?? "").slice(0, 120)}»`);
    if (!/bedrock|amazon/i.test(prov)) console.log(`⚠️  El proveedor informado («${prov}») no parece Amazon Bedrock: revisa en openrouter.ai/activity.`);
    if (cost !== undefined && cost > b.worstUsd) console.log(`⚠️  El costo real (US$ ${cost}) superó el máximo estimado (US$ ${b.worstUsd.toFixed(6)}): revisa tarifas.`);
    process.exit(0);
  } catch (e: any) { if (e instanceof HumoAbort) { console.log(`❌ ${e.message}`); process.exit(e.code); } console.log(`❌ Falló (${e?.name}): ${String(e?.message ?? e).slice(0, 140)}. No se reintentó.`); process.exit(1); }
})();
