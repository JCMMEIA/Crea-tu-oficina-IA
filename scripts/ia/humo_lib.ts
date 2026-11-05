// PRUEBA DE HUMO de OpenRouter — lógica pura y sin efectos (la usa scripts/ia/prueba_humo.ts y las pruebas). NO importa el router, ni la base de datos, ni el catálogo.
// Una sola solicitud, con TODAS las restricciones fijadas en el cuerpo. Si el cuerpo no cumple exactamente lo previsto, NO se envía nada.

/** Parámetros fijos de la prueba. Tarifas verificadas en el catálogo público de OpenRouter (endpoints amazon-bedrock/us-east-1 y /eu-west-1, 2026-11): US$ 2.20 entrada / US$ 11 salida por millón de tokens. */
export const HUMO = {
  model: "anthropic/claude-sonnet-5.5",
  providers: ["amazon-bedrock/us-east-1", "amazon-bedrock/eu-west-1"] as readonly string[],
  priceUsdMtok: { in: 2.2, out: 11 },
  /** Mismo margen que el router (PRICE_MARGIN en src/server/ai/router.ts; una prueba comprueba que coinciden). */
  priceMargin: 1.25, inputTokenMargin: 1.25,
  maxTokens: 16, budgetUsd: 0.01,
  system: "Responde solo con la palabra «hola». Es una prueba técnica con datos ficticios.",
  user: "Prueba técnica ficticia: di «hola».",
};
export const ceiling = () => ({ prompt: +(HUMO.priceUsdMtok.in * HUMO.priceMargin).toFixed(6), completion: +(HUMO.priceUsdMtok.out * HUMO.priceMargin).toFixed(6) });
/** Estimación MUY conservadora de tokens de entrada (1 token cada 2 caracteres + 64 de sobrecarga del formato). No es un conteo exacto. */
export const estimateInputTokens = (system = HUMO.system, user = HUMO.user) => Math.ceil((system.length + user.length) / 2) + 64;
/** Peor caso con el tope de precio (max_price) y el máximo de tokens de salida. Estimación de control, NO un límite absoluto de facturación. */
export function worstCaseUsd(maxTokens = HUMO.maxTokens) { const c = ceiling(); return (estimateInputTokens() * HUMO.inputTokenMargin * c.prompt + maxTokens * c.completion) / 1e6; }
export function buildBody() {
  const c = ceiling();
  return { model: HUMO.model, messages: [{ role: "system", content: HUMO.system }, { role: "user", content: HUMO.user }], max_tokens: HUMO.maxTokens,
    provider: { allow_fallbacks: false, data_collection: "deny", zdr: true, only: [...HUMO.providers], max_price: { prompt: c.prompt, completion: c.completion } } };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Devuelve la lista de problemas del cuerpo (vacía = seguro). Exige EXACTAMENTE lo previsto: nada de herramientas, modelos alternativos, rutas, plugins ni claves extra. */
export function assertSafeBody(body: any): string[] {
  const p: string[] = []; const exp = buildBody(); if (!body || typeof body !== "object") return ["no hay cuerpo"];
  if (!same(Object.keys(body).sort(), Object.keys(exp).sort())) p.push(`claves del cuerpo no permitidas: ${Object.keys(body).join(",")}`);
  if (body.model !== exp.model) p.push("modelo distinto al autorizado");
  if (!same(body.messages, exp.messages)) p.push("el prompt no es el ficticio autorizado");
  if (body.max_tokens !== HUMO.maxTokens) p.push("max_tokens distinto al autorizado");
  const pr = body.provider; if (!pr || typeof pr !== "object") { p.push("falta provider"); return p; }
  if (!same(Object.keys(pr).sort(), Object.keys(exp.provider).sort())) p.push(`claves de provider no permitidas o faltantes: ${Object.keys(pr).join(",")}`);
  if (pr.zdr !== true) p.push("falta provider.zdr=true"); if (pr.data_collection !== "deny") p.push('falta provider.data_collection="deny"'); if (pr.allow_fallbacks !== false) p.push("falta provider.allow_fallbacks=false");
  if (!same(pr.only, [...HUMO.providers])) p.push("provider.only no es exactamente amazon-bedrock/us-east-1 y amazon-bedrock/eu-west-1");
  const c = ceiling(); if (!pr.max_price || pr.max_price.prompt !== c.prompt || pr.max_price.completion !== c.completion) p.push("provider.max_price ausente o distinto al tope autorizado");
  return p;
}
export function checkBudget(budgetUsd = HUMO.budgetUsd): { ok: boolean; worstUsd: number; reason?: string } {
  const worst = worstCaseUsd(); if (!(budgetUsd > 0) || budgetUsd > HUMO.budgetUsd) return { ok: false, worstUsd: worst, reason: `el presupuesto debe estar entre 0 y US$ ${HUMO.budgetUsd} (se pidió ${budgetUsd})` };
  return worst <= budgetUsd ? { ok: true, worstUsd: worst } : { ok: false, worstUsd: worst, reason: `el peor caso estimado (US$ ${worst.toFixed(6)}) supera el presupuesto (US$ ${budgetUsd})` };
}
export class HumoAbort extends Error { constructor(msg: string, public code: number) { super(msg); this.name = "HumoAbort"; } }
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/; export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
/** La clave solo se envía a openrouter.ai (o a un servidor local de pruebas). Cualquier otro destino se rechaza. */
export function resolveBase(env: string | undefined): string { const b = (env || OPENROUTER_BASE).replace(/\/$/, ""); if (b === OPENROUTER_BASE || LOOPBACK.test(b)) return b; throw new HumoAbort("OPENROUTER_BASE_URL apunta a un destino no permitido: la clave solo se envía a openrouter.ai.", 5); }
/** UNA sola solicitud, sin reintentos. Valida el cuerpo y el presupuesto ANTES de tocar la red; si algo falta, lanza HumoAbort y no hace ninguna llamada. */
export async function sendOnce(body: unknown, o: { base: string; key: string; budgetUsd?: number; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<{ status: number; json: any }> {
  const problems = assertSafeBody(body); if (problems.length) throw new HumoAbort(`No se envía nada: ${problems.join("; ")}`, 3);
  const b = checkBudget(o.budgetUsd); if (!b.ok) throw new HumoAbort(`No se envía nada: ${b.reason}`, 3); if (!o.key || o.key.length < 10) throw new HumoAbort("No hay OPENROUTER_API_KEY en el entorno de este proceso. No se envía nada.", 4);
  const f = o.fetchImpl ?? fetch; const res = await f(`${o.base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(o.timeoutMs ?? 60_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.key}`, "X-Title": "Crea tu Oficina IA (prueba de humo)" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
/** Resume la respuesta de GET /key sin mostrar la clave: ¿tiene límite propio o guardrail/presupuestos que la restrinjan? */
export function describeKey(j: any): string[] {
  const d = j?.data; if (!d) return ["No se pudo leer la información de la clave."]; const out: string[] = [];
  out.push(`Etiqueta: ${d.label ?? "—"} · límite propio de la clave: ${d.limit == null ? "SIN límite" : `US$ ${d.limit} (${d.limit_reset ?? "no se reinicia"}, restante US$ ${d.limit_remaining})`} · gasto total: US$ ${d.usage ?? "—"} · hoy: US$ ${d.usage_daily ?? "—"}`);
  const budgets: any[] = Array.isArray(d.budgets) ? d.budgets : []; const guard = budgets.filter((x) => x.guardrail_id || /guardrail/.test(String(x.scope)));
  out.push(budgets.length ? `Presupuestos que aplican a esta clave: ${budgets.map((x) => `${x.scope}${x.guardrail_id ? ` [guardrail ${x.guardrail_id}]` : ""} US$ ${x.limit_usd} (restante US$ ${x.remaining_usd}${x.reset_interval ? `, ${x.reset_interval}` : ""})`).join(" · ")}` : "Presupuestos/guardrails que apliquen a esta clave: NINGUNO (la respuesta no lista ninguno).");
  out.push(guard.length ? `Guardrail propio de la clave o del espacio: SÍ (${guard.length}).` : "Guardrail propio de la clave: NO se ve ninguno. Esta consulta solo LEE; no crea ni asigna guardrails (eso requiere tu autorización en openrouter.ai).");
  return out;
}
