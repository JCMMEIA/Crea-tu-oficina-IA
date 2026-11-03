import { Db } from "../db";

export class LimitError extends Error { constructor(msg: string, public code: string) { super(msg); this.name = "LimitError"; } }

export function costUsd(p: { inUsd: number; outUsd: number }, inTok: number, outTok: number) {
  return (inTok * p.inUsd + outTok * p.outUsd) / 1_000_000;
}

export async function monthSpend(db: Db, companyId: string): Promise<number> {
  const r = await db.query<{ s: string }>("SELECT coalesce(sum(cost_usd),0) s FROM usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now())", [companyId]);
  return Number(r[0].s);
}

/** Bloqueo previo: no se llama al modelo si no caben el costo máximo, el tope por hora o el tope diario del empleado. */
export async function assertWithinLimits(db: Db, a: { companyId: string; employeeId: string; maxCostUsd: number }) {
  const c = (await db.query("SELECT monthly_budget_usd, max_runs_per_hour FROM companies WHERE id=$1", [a.companyId]))[0];
  const spent = await monthSpend(db, a.companyId);
  if (spent + a.maxCostUsd > Number(c.monthly_budget_usd))
    throw new LimitError(`Presupuesto mensual de IA agotado (gastado ${spent.toFixed(4)} de ${Number(c.monthly_budget_usd).toFixed(2)} USD).`, "budget");
  const hour = await db.query<{ n: string }>("SELECT count(*) n FROM usage_events WHERE company_id=$1 AND created_at > now() - interval '1 hour'", [a.companyId]);
  if (Number(hour[0].n) >= c.max_runs_per_hour) throw new LimitError("Límite de ejecuciones por hora de la empresa alcanzado.", "rate_company");
  const e = (await db.query("SELECT max_runs_per_day FROM employees WHERE id=$1 AND company_id=$2", [a.employeeId, a.companyId]))[0];
  const day = await db.query<{ n: string }>("SELECT count(*) n FROM usage_events WHERE company_id=$1 AND employee_id=$2 AND created_at > now() - interval '1 day'", [a.companyId, a.employeeId]);
  if (Number(day[0].n) >= e.max_runs_per_day) throw new LimitError("Este empleado alcanzó su límite diario de ejecuciones.", "rate_employee");
}

export async function recordUsage(db: Db, u: { companyId: string; employeeId: string; taskId: string; inputTokens: number; outputTokens: number; costUsd: number }) {
  await db.query("INSERT INTO usage_events(company_id,employee_id,task_id,input_tokens,output_tokens,cost_usd) VALUES($1,$2,$3,$4,$5,$6)",
    [u.companyId, u.employeeId, u.taskId, u.inputTokens, u.outputTokens, u.costUsd]);
}

export async function usageSummary(db: Db, companyId: string) {
  const byEmployee = await db.query(`SELECT e.name, count(u.id)::int calls, coalesce(sum(u.input_tokens),0)::int input_tokens, coalesce(sum(u.output_tokens),0)::int output_tokens, coalesce(sum(u.cost_usd),0)::float cost_usd
    FROM usage_events u LEFT JOIN employees e ON e.id=u.employee_id WHERE u.company_id=$1 AND u.created_at >= date_trunc('month', now()) GROUP BY e.name ORDER BY 5 DESC`, [companyId]);
  const spent = await monthSpend(db, companyId);
  const c = (await db.query("SELECT monthly_budget_usd FROM companies WHERE id=$1", [companyId]))[0];
  return { spent, budget: Number(c.monthly_budget_usd), byEmployee };
}
