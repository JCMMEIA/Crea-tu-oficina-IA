import type { Db } from "../db";
import { newId } from "../db";
import { getPlanLimit, getSettings } from "./config";
import type { PlanLimit } from "./types";

/**
 * CUOTA POR CUENTA = dos límites simultáneos: créditos mensuales (tokens × peso del modelo) y tope interno de gasto en USD.
 * «Cuenta» = el dueño de las oficinas: todas sus oficinas comparten la misma cuota. Reservar es UNA sentencia atómica condicionada,
 * así que dos tareas en paralelo nunca pueden pasarse del límite. Después se liquida con el consumo real (o se libera si la llamada falló).
 */
export class QuotaError extends Error { constructor(message: string, public code: "quota_credits" | "quota_usd" | "quota_task" | "quota_none") { super(message); this.name = "QuotaError"; } }
export const periodStart = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

export async function accountOf(db: Db, companyId: string): Promise<string> {
  const r = (await db.query(`SELECT m.user_id FROM companies c JOIN agency_members m ON m.agency_id=c.agency_id AND m.role='agency_owner' WHERE c.id=$1 ORDER BY m.user_id LIMIT 1`, [companyId]))[0];
  return r ? (r.user_id as string) : `company:${companyId}`;
}
/** Plan de la cuenta = el de mayor cuota entre sus oficinas (la cuota se comparte; no se suma por cada oficina). */
export async function planOfAccount(db: Db, accountId: string): Promise<PlanLimit> {
  const plans = accountId.startsWith("company:")
    ? await db.query("SELECT plan FROM companies WHERE id=$1", [accountId.slice(8)])
    : await db.query("SELECT a.plan FROM agencies a JOIN agency_members m ON m.agency_id=a.id AND m.role='agency_owner' AND m.user_id=$1", [accountId]);
  let best: PlanLimit | null = null;
  for (const p of plans) { const l = await getPlanLimit(db, p.plan as string); if (!best || l.monthly_credits > best.monthly_credits) best = l; }
  return best ?? (await getPlanLimit(db, "prueba"));
}
async function ensureRow(db: Db, accountId: string, period: string) { await db.query("INSERT INTO ai_accounts(account_id,period) VALUES($1,$2) ON CONFLICT DO NOTHING", [accountId, period]); }

export interface Reservation { id: string; accountId: string; period: string; credits: number; usd: number }
/** Reserva atómica. Lanza QuotaError (sin llamar a ningún modelo) si no caben los créditos o el gasto. */
export async function reserve(db: Db, i: { accountId: string; companyId?: string | null; taskId?: string | null; credits: number; usd: number; limit: PlanLimit; now?: Date }): Promise<Reservation> {
  const period = periodStart(i.now); const credits = Math.max(1, Math.ceil(i.credits)), usd = Math.max(0, i.usd);
  if (usd > i.limit.max_task_usd + 1e-9) throw new QuotaError(`Esta tarea podría costar más del tope permitido por tarea de tu plan (US$ ${i.limit.max_task_usd.toFixed(2)}). No se ejecutó.`, "quota_task");
  await ensureRow(db, i.accountId, period);
  return db.tx(async (t) => {
    const r = await t.query(`UPDATE ai_accounts SET credits_reserved = credits_reserved + $3, usd_reserved = usd_reserved + $4, updated_at = now()
      WHERE account_id=$1 AND period=$2 AND credits_used + credits_reserved + $3 <= $5 AND usd_used + usd_reserved + $4 <= $6 RETURNING account_id`, [i.accountId, period, credits, usd, i.limit.monthly_credits, i.limit.monthly_budget_usd]);
    if (!r.length) {
      const a = (await t.query("SELECT credits_used,credits_reserved,usd_used,usd_reserved FROM ai_accounts WHERE account_id=$1 AND period=$2", [i.accountId, period]))[0];
      const usdFull = Number(a.usd_used) + Number(a.usd_reserved) + usd > i.limit.monthly_budget_usd; const credFull = Number(a.credits_used) + Number(a.credits_reserved) + credits > i.limit.monthly_credits;
      if (credFull && !usdFull) throw new QuotaError("Alcanzaste los tokens incluidos en tu plan este mes. Las nuevas tareas se reanudan el próximo mes o al ampliar tu plan.", "quota_credits");
      throw new QuotaError(usdFull ? "Se alcanzó el límite interno de gasto de IA de tu cuenta este mes. Las nuevas tareas se detienen hasta el próximo mes o hasta ampliar tu plan." : "No hay cuota disponible.", "quota_usd");
    }
    const id = newId(); await t.query("INSERT INTO ai_reservations(id,account_id,period,company_id,task_id,credits,usd) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, i.accountId, period, i.companyId ?? null, i.taskId ?? null, credits, usd]);
    return { id, accountId: i.accountId, period, credits, usd };
  });
}
/** Liquida con el consumo REAL. Idempotente: liquidar o liberar dos veces la misma reserva no cuenta dos veces. */
export async function settle(db: Db, r: Reservation, actual: { credits: number; usd: number; tokens: number }) {
  await db.tx(async (t) => {
    const done = await t.query("UPDATE ai_reservations SET status='settled', closed_at=now() WHERE id=$1 AND status='reserved' RETURNING id", [r.id]); if (!done.length) return;
    await t.query("UPDATE ai_accounts SET credits_reserved = GREATEST(0, credits_reserved - $3), usd_reserved = GREATEST(0, usd_reserved - $4), credits_used = credits_used + $5, usd_used = usd_used + $6, tokens_used = tokens_used + $7, calls = calls + 1, updated_at = now() WHERE account_id=$1 AND period=$2", [r.accountId, r.period, r.credits, r.usd, Math.ceil(actual.credits), actual.usd, actual.tokens]);
  });
}
export async function release(db: Db, r: Reservation) {
  await db.tx(async (t) => {
    const done = await t.query("UPDATE ai_reservations SET status='released', closed_at=now() WHERE id=$1 AND status='reserved' RETURNING id", [r.id]); if (!done.length) return;
    await t.query("UPDATE ai_accounts SET credits_reserved = GREATEST(0, credits_reserved - $3), usd_reserved = GREATEST(0, usd_reserved - $4), updated_at = now() WHERE account_id=$1 AND period=$2", [r.accountId, r.period, r.credits, r.usd]);
  });
}
/** Reservas huérfanas (proceso caído a media llamada): se liberan para que no bloqueen la cuota para siempre. */
export async function releaseStale(db: Db, minutes = 30): Promise<number> {
  const rows = await db.query("SELECT id,account_id,period,credits,usd FROM ai_reservations WHERE status='reserved' AND created_at < now() - ($1 || ' minutes')::interval", [String(minutes)]);
  for (const r of rows) await release(db, { id: r.id, accountId: r.account_id, period: r.period instanceof Date ? r.period.toISOString().slice(0, 10) : String(r.period).slice(0, 10), credits: Number(r.credits), usd: Number(r.usd) });
  return rows.length;
}
export interface QuotaStatus { accountId: string; plan: string; limit: PlanLimit; creditsUsed: number; creditsReserved: number; tokensUsed: number; usdUsed: number; usdReserved: number; calls: number; pctCredits: number; pctUsd: number; level: "ok" | "aviso" | "bloqueado"; offices: number; resetOn: string }
export async function quotaStatus(db: Db, accountId: string, now = new Date()): Promise<QuotaStatus> {
  const limit = await planOfAccount(db, accountId); const period = periodStart(now); await ensureRow(db, accountId, period);
  const a = (await db.query("SELECT * FROM ai_accounts WHERE account_id=$1 AND period=$2", [accountId, period]))[0];
  const cu = Number(a.credits_used), cr = Number(a.credits_reserved), uu = Number(a.usd_used), ur = Number(a.usd_reserved);
  const pc = (cu + cr) / limit.monthly_credits, pu = (uu + ur) / limit.monthly_budget_usd; const worst = Math.max(pc, pu);
  const offices = accountId.startsWith("company:") ? 1 : Number((await db.query("SELECT count(*) n FROM agency_members WHERE user_id=$1 AND role='agency_owner'", [accountId]))[0].n);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { accountId, plan: limit.plan, limit, creditsUsed: cu, creditsReserved: cr, tokensUsed: Number(a.tokens_used), usdUsed: uu, usdReserved: ur, calls: Number(a.calls), pctCredits: pc, pctUsd: pu, level: worst >= 1 ? "bloqueado" : worst >= 0.8 ? "aviso" : "ok", offices, resetOn: next.toISOString().slice(0, 10) };
}
/** Registra (una sola vez por mes y umbral) las alertas de cuota. Devuelve los umbrales recién cruzados. */
export async function checkAlerts(db: Db, accountId: string): Promise<number[]> {
  const st = await quotaStatus(db, accountId); const th = (await getSettings(db)).alertThresholds; const crossed: number[] = []; const pct = Math.max(st.pctCredits, st.pctUsd) * 100;
  for (const t of th) if (pct >= t) { const r = await db.query("INSERT INTO ai_alerts(account_id,period,threshold) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING threshold", [accountId, periodStart(), t]); if (r.length) crossed.push(t); }
  return crossed;
}
