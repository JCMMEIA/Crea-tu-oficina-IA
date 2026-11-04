import type { Db } from "../db";
import { getDb } from "../db";
import { TransientProviderError, type CompleteRequest, type CompleteResult, type ModelProvider } from "../models";
import { defaultBackends, type Backend } from "./backends";
import { getSettings, usableModels } from "./config";
import { accountOf, checkAlerts, periodStart, planOfAccount, QuotaError, release, reserve, settle, type Reservation } from "./quota";
import { LEVEL_RANK, SENS_RANK, TIER_ORDER, type AiSettings, type Level, type ModelRow, type PlanLimit, type Sensitivity, type Tier } from "./types";
import type { TaskMeta } from "./classify";
import { audit } from "../auth/audit";

/**
 * ROUTER INTELIGENTE (uno solo para todas las oficinas y los 41 puestos).
 * 1) elige el modelo ELEGIBLE más económico para el nivel de la tarea; 2) reserva cuota; 3) llama; 4) valida la respuesta; 5) si falla, pasa a otro modelo AUTORIZADO;
 * nunca supera el presupuesto, nunca repite acciones externas (las herramientas se ejecutan en el motor, fuera de este módulo) y nunca entra en bucle (máx. intentos).
 */
export class RouterError extends Error { constructor(message: string, public attempts: AttemptLog[]) { super(message); this.name = "RouterError"; } }
export interface AttemptLog { attempt: number; model: string; status: string; reason?: string }
export interface Exclusion { id: string; reason: string }
export interface Plan { candidates: { model: ModelRow; maxCostUsd: number }[]; excluded: Exclusion[] }

export const estimateTokens = (req: Pick<CompleteRequest, "system" | "messages" | "tools">) => Math.ceil((req.system.length + JSON.stringify(req.messages).length + JSON.stringify(req.tools).length) / 3.2);
/**
 * UNA sola fuente de verdad para los límites de costo. Todo se calcula con el MISMO tope de precio:
 *  · `priceCeiling(m)` = precio de catálogo × PRICE_MARGIN, en entrada Y en salida. Es lo que se envía a OpenRouter como `provider.max_price`.
 *  · `worstCaseCost` = peor caso con ese tope: (tokens de entrada estimados × INPUT_TOKEN_MARGIN) × tope de entrada + (max_tokens de salida) × tope de salida.
 * Ese costo máximo es el que se compara con los límites por llamada, por tarea y mensual y el que se RESERVA. Son ESTIMACIONES de control, no una garantía absoluta de facturación:
 * el conteo de tokens de entrada es aproximado, el proveedor puede facturar tokens de razonamiento, y el costo final lo informa OpenRouter. Por eso, tras cada llamada se liquida el costo REAL.
 */
export const PRICE_MARGIN = 1.25;
export const INPUT_TOKEN_MARGIN = 1.25;
export const COST_MARGIN = PRICE_MARGIN; // nombre anterior (compatibilidad)
/** Si el costo real supera el máximo estimado por más de este factor, el modelo se desactiva solo. */
export const ANOMALY_FACTOR = 1.5;
export const priceCeiling = (m: Pick<ModelRow, "price_in_usd_mtok" | "price_out_usd_mtok">) => ({ in: m.price_in_usd_mtok * PRICE_MARGIN, out: m.price_out_usd_mtok * PRICE_MARGIN });
export const worstCaseCost = (m: Pick<ModelRow, "price_in_usd_mtok" | "price_out_usd_mtok">, estIn: number, maxOut: number) => { const c = priceCeiling(m); return (estIn * INPUT_TOKEN_MARGIN * c.in + maxOut * c.out) / 1e6; };
const maxCost = worstCaseCost;
const PREFERENCE: Record<Level, Tier[]> = { A: ["free", "economy", "premium"], B: ["economy", "premium", "free"], C: ["premium", "economy"] };
const policyOk = (m: ModelRow, sens: Sensitivity, s: AiSettings): string | null => {
  if (sens === "public") return null;
  // La etiqueta data_policy es lo que ALGUIEN declaró; lo que realmente se aplica en la API es provider.only + data_collection/zdr. Sin proveedores aprobados no hay restricción real.
  if (m.provider === "openrouter" && !m.allowed_providers?.length) return "no tiene proveedores aprobados (la etiqueta de política de datos no basta: hay que fijar los proveedores en OpenRouter)";
  if (sens === "internal") { if (m.data_policy === "unknown" || m.data_policy === "may_train") return "su política de datos no garantiza que no entrene con información interna"; if (m.tier === "free" && !s.freeForInternal) return "los modelos gratuitos no reciben información interna (regla de la cuenta)"; return null; }
  return m.data_policy === "zero_retention" ? null : "la información confidencial solo va a modelos con retención cero verificada";
};
/** Candidatos en orden de preferencia, con los excluidos y el motivo (sirve para el panel de simulación y para auditar). Función pura. */
export function planRoute(models: ModelRow[], i: { meta: Pick<TaskMeta, "level" | "sensitivity" | "needsTools" | "needsJson">; limit: PlanLimit; settings: AiSettings; estIn: number; maxOut: number; remainingUsd: number; taskRemainingUsd: number; perf?: Record<string, { n: number; fail: number }>; exclude?: Set<string> }): Plan {
  const excluded: Exclusion[] = []; const ok: { model: ModelRow; maxCostUsd: number }[] = [];
  if (LEVEL_RANK[i.meta.level] > LEVEL_RANK[i.limit.max_level]) return { candidates: [], excluded: [{ id: "*", reason: `tu plan no incluye tareas de nivel ${i.meta.level}` }] };
  for (const m of models) {
    const why = (r: string) => excluded.push({ id: m.id, reason: r });
    if (!m.enabled || !m.verified) { why("no está activo y verificado"); continue; }
    if (i.exclude?.has(m.id)) { why("ya se intentó en esta llamada"); continue; }
    if (!i.limit.allowed_tiers.includes(m.tier)) { why(`el plan no autoriza modelos ${m.tier}`); continue; }
    if (LEVEL_RANK[m.max_level] < LEVEL_RANK[i.meta.level]) { why(`no está autorizado para nivel ${i.meta.level}`); continue; }
    const p = policyOk(m, i.meta.sensitivity, i.settings); if (p) { why(p); continue; }
    if (i.meta.needsTools && !m.supports_tools) { why("no admite herramientas"); continue; }
    if (i.meta.needsJson && !m.supports_json) { why("no admite salida JSON"); continue; }
    if (m.context_window < i.estIn + i.maxOut) { why("el contexto no cabe en su ventana"); continue; }
    const c = maxCost(m, i.estIn, i.maxOut); const cap = Math.min(i.settings.maxCallUsd, i.taskRemainingUsd, i.remainingUsd);
    if (c > cap + 1e-12) { why(`su costo máximo (US$ ${c.toFixed(4)}) supera el presupuesto disponible (US$ ${cap.toFixed(4)})`); continue; }
    ok.push({ model: m, maxCostUsd: c });
  }
  const pref = PREFERENCE[i.meta.level]; const bad = (id: string) => { const p = i.perf?.[id]; return p && p.n >= 5 && p.fail / p.n >= 0.5 ? 1 : 0; };
  ok.sort((a, b) => bad(a.model.id) - bad(b.model.id) || (pref.indexOf(a.model.tier) < 0 ? 9 : pref.indexOf(a.model.tier)) - (pref.indexOf(b.model.tier) < 0 ? 9 : pref.indexOf(b.model.tier)) || a.maxCostUsd - b.maxCostUsd);
  return { candidates: ok, excluded };
}
/** Validación determinista de la respuesta final (las llamadas con herramientas no se validan como texto). */
export function validateOutput(res: CompleteResult, v: TaskMeta["validate"]): { ok: boolean; problems: string[] } {
  const problems: string[] = []; if (res.toolCalls.length) return { ok: true, problems };
  const t = res.text.trim(); if (!t) problems.push("respuesta vacía");
  if (v?.minChars && t.length < v.minChars) problems.push(`demasiado corta (${t.length} < ${v.minChars} caracteres)`);
  if (v?.sections?.length) { const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); const body = n(t); const miss = v.sections.filter((s) => !body.includes(n(s))); if (miss.length) problems.push(`faltan secciones: ${miss.join(", ")}`); }
  if (v?.json) { try { JSON.parse(t); } catch { problems.push("no es JSON válido"); } }
  return { ok: problems.length === 0, problems };
}

export interface RouterDeps { db?: Db; backends?: Backend[]; now?: () => number }
export class RoutedProvider implements ModelProvider {
  id = "router";
  constructor(private deps: RouterDeps = {}) {}
  private db = () => this.deps.db ?? getDb();
  /** Tarifa nominal (la más alta entre los modelos activos) solo para los pre-chequeos del motor; el costo REAL llega en cada resultado. */
  pricing() { return { inUsd: 3, outUsd: 15 }; }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const db = await this.db(); const backends = this.deps.backends ?? defaultBackends(); const settings = await getSettings(db); const models = await usableModels(db);
    const meta = req.meta; const system = !meta?.companyId; const level: Level = meta?.level ?? "A"; const sens: Sensitivity = meta?.sensitivity ?? "public";
    const accountId = system ? "system" : await accountOf(db, meta!.companyId!); const limit = system ? { plan: "sistema", monthly_credits: 1e12, monthly_budget_usd: 1e6, max_offices: 1, allowed_tiers: TIER_ORDER, max_level: "C" as Level, max_task_usd: 1 } : await planOfAccount(db, accountId);
    const perfRows = await db.query("SELECT used_model m, count(*)::int n, sum(CASE WHEN status='ok' THEN 0 ELSE 1 END)::int f FROM ai_calls WHERE created_at > now() - interval '7 days' AND used_model IS NOT NULL GROUP BY 1");
    const perf: Record<string, { n: number; fail: number }> = {}; for (const r of perfRows) perf[r.m as string] = { n: r.n, fail: r.f };
    const estIn = estimateTokens(req); const tried = new Set<string>(); const log: AttemptLog[] = []; let prevFree = false; let firstModel: string | null = null; let lastReason = "";
    const t0 = (this.deps.now ?? Date.now);
    for (let attempt = 1; attempt <= settings.maxAttempts; attempt++) {
      let remainingUsd = 1e6; if (!system) { const st = (await db.query("SELECT usd_used+usd_reserved u FROM ai_accounts WHERE account_id=$1 AND period=$2", [accountId, periodStart()]))[0]; remainingUsd = limit.monthly_budget_usd - Number(st?.u ?? 0); }
      const spentTask = meta?.taskId ? Number((await db.query("SELECT coalesce(sum(cost_usd),0) s FROM ai_calls WHERE task_id=$1", [meta.taskId]))[0].s) : 0; // incluye los intentos de ESTA llamada
      const plan = planRoute(models, { meta: { level, sensitivity: sens, needsTools: !!meta?.needsTools || req.tools.length > 0, needsJson: !!meta?.needsJson }, limit, settings, estIn, maxOut: req.maxTokens, remainingUsd, taskRemainingUsd: limit.max_task_usd - spentTask, perf, exclude: tried });
      const cand = plan.candidates.find((c) => !(prevFree && c.model.tier !== "free" && !settings.allowPaidFallback));
      if (!cand) {
        const why = plan.excluded.slice(0, 6).map((e) => `${e.id === "*" ? "" : e.id + ": "}${e.reason}`).join("; ");
        if (!log.length && !plan.candidates.length && !models.length) throw new RouterError("No hay modelos de IA activos y verificados en el catálogo (/admin/ia). No se ejecutó nada.", log);
        throw new RouterError(log.length ? `No quedó ningún modelo autorizado para reintentar (${lastReason || "sin alternativa"}). Se detuvo para no gastar de más.` : `Ningún modelo cumple los requisitos de esta tarea (${why || "sin candidatos"}). No se ejecutó nada.`, log);
      }
      const m = cand.model; tried.add(m.id); firstModel ??= m.id; const be = backends.find((b) => b.id === m.provider);
      if (!be || !be.configured()) { log.push({ attempt, model: m.id, status: "sin_proveedor", reason: `proveedor ${m.provider} no configurado` }); lastReason = `proveedor ${m.provider} no configurado`; await this.record(db, { accountId, meta, attempt, requested: firstModel, m, status: "sin_proveedor", reason: lastReason, tin: 0, tout: 0, credits: 0, cost: 0, source: "n/a", ms: 0 }); prevFree = prevFree || m.tier === "free"; continue; }
      let r: Reservation | null = null;
      if (!system) r = await reserve(db, { accountId, companyId: meta!.companyId, taskId: meta!.taskId, credits: (estIn + req.maxTokens) * m.credit_weight, usd: cand.maxCostUsd, limit });
      const started = t0();
      try {
        const out = await be.complete(m.model_id, { ...req, meta: undefined }, { sensitivity: sens, allowedProviders: m.allowed_providers, maxPrice: priceCeiling(m) }); const ms = t0() - started;
        const tokens = out.inputTokens + out.outputTokens; const est = (out.inputTokens * m.price_in_usd_mtok + out.outputTokens * m.price_out_usd_mtok) / 1e6;
        const cost = typeof out.costUsd === "number" ? out.costUsd : est; const credits = tokens * m.credit_weight; const v = validateOutput(out, meta?.validate);
        if (r) await settle(db, r, { credits, usd: cost, tokens });
        await this.record(db, { accountId, meta, attempt, requested: firstModel, m, status: v.ok ? "ok" : "invalida", reason: v.ok ? (cost > cand.maxCostUsd + 1e-9 ? `el costo real (US$ ${cost.toFixed(5)}) superó el máximo estimado (US$ ${cand.maxCostUsd.toFixed(5)}): revisa el precio del modelo` : undefined) : v.problems.join("; "), tin: out.inputTokens, tout: out.outputTokens, credits, cost, source: typeof out.costUsd === "number" ? "proveedor" : "estimado", ms, validation: v, providerName: out.providerName });
        if (!system) await checkAlerts(db, accountId);
        // Freno de seguridad: un costo real MUY superior al máximo estimado indica un precio de catálogo equivocado o un proveedor fuera de lo pactado. Se desactiva el modelo (una persona decide si se reactiva).
        if (cost > cand.maxCostUsd * ANOMALY_FACTOR + 1e-9) { await db.query("UPDATE ai_models SET enabled=false, notes=left(notes || ' [desactivado automáticamente: el costo real superó por mucho el máximo estimado]', 500), updated_by='router', updated_at=now() WHERE id=$1", [m.id]); await audit(db, {}, "ai.model.auto_disabled", m.id, { real_usd: cost, max_estimado_usd: cand.maxCostUsd }); }
        if (v.ok) return { ...out, costUsd: cost, model: m.id, provider: out.providerName ?? m.provider };
        log.push({ attempt, model: m.id, status: "invalida", reason: v.problems.join("; ") }); lastReason = v.problems.join("; "); prevFree = prevFree || m.tier === "free";
        // Una respuesta inválida YA se cobró (se liquidó con su consumo real): el siguiente intento reserva de nuevo y respeta el tope por tarea.
      } catch (e: any) {
        if (r) await release(db, r); const ms = t0() - started; const transient = e instanceof TransientProviderError; const reason = String(e?.message ?? e).slice(0, 160);
        await this.record(db, { accountId, meta, attempt, requested: firstModel, m, status: transient ? "transitorio" : "error", reason, tin: 0, tout: 0, credits: 0, cost: 0, source: "n/a", ms });
        log.push({ attempt, model: m.id, status: transient ? "transitorio" : "error", reason }); lastReason = reason; prevFree = prevFree || m.tier === "free";
        if (e?.name === "AbortError" || req.signal?.aborted) throw new RouterError("La tarea se interrumpió por tiempo.", log);
        if (e instanceof QuotaError) throw e;
      }
    }
    throw new RouterError(`Ningún modelo pudo completar la tarea tras ${settings.maxAttempts} intentos (${lastReason}). Se detuvo sin gastar más.`, log);
  }
  private async record(db: Db, a: { accountId: string; meta?: TaskMeta; attempt: number; requested: string | null; m: ModelRow; status: string; reason?: string; tin: number; tout: number; credits: number; cost: number; source: string; ms: number; validation?: unknown; providerName?: string }) {
    await db.query(`INSERT INTO ai_calls(account_id,company_id,task_id,employee_id,attempt,level,sensitivity,requested_model,used_model,provider,status,fallback_reason,input_tokens,output_tokens,credits,cost_usd,cost_source,latency_ms,validation)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [a.accountId, a.meta?.companyId ?? null, a.meta?.taskId ?? null, a.meta?.employeeId ?? null, a.attempt, a.meta?.level ?? null, a.meta?.sensitivity ?? null, a.requested, a.m.id, a.providerName ?? a.m.provider, a.status, a.reason ?? null, a.tin, a.tout, Math.ceil(a.credits), a.cost, a.source, a.ms, a.validation ? JSON.stringify(a.validation) : null]);
  }
}
export const createRoutedProvider = (deps: RouterDeps = {}) => new RoutedProvider(deps);
