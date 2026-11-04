import { Db } from "../db";

/** Consumo y límites, separados: TOKENS consumidos · COSTO estimado (USD, con la tarifa configurada) · LÍMITES (presupuesto mensual y topes de ejecución). Todo por company_id. */
export interface Limits { budgetUsd: number; spentUsd: number; pct: number; level: "ok" | "aviso" | "bloqueado"; maxRunsPerHour: number; runsLastHour: number; blockedReason: string | null }
export async function limitStatus(db: Db, companyId: string): Promise<Limits> {
  const c = (await db.query("SELECT monthly_budget_usd, max_runs_per_hour FROM companies WHERE id=$1", [companyId]))[0]; if (!c) throw new Error("Oficina no encontrada.");
  const spent = Number((await db.query("SELECT coalesce(sum(cost_usd),0) s FROM usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now())", [companyId]))[0].s);
  const runs = Number((await db.query("SELECT count(*) n FROM usage_events WHERE company_id=$1 AND created_at > now() - interval '1 hour'", [companyId]))[0].n);
  const budget = Number(c.monthly_budget_usd), pct = budget > 0 ? spent / budget : 1;
  const ag = (await db.query("SELECT a.id, a.status, a.monthly_budget_usd FROM agencies a JOIN companies c ON c.agency_id=a.id WHERE c.id=$1", [companyId]))[0];
  let reason: string | null = null;
  if (ag && ag.status === "pausada") reason = "Esta oficina está pausada. Reanúdala desde «Mis oficinas» para volver a ejecutar tareas.";
  else if (ag && ag.status !== "activa") reason = "Esta oficina está cancelada: no se pueden ejecutar tareas.";
  else if (spent >= budget) reason = `Alcanzaste el límite mensual de uso de IA de esta oficina (${spent.toFixed(2)} de ${budget.toFixed(2)} USD). No se ejecutarán nuevas tareas hasta el próximo mes o hasta que se amplíe el límite.`;
  else if (runs >= Number(c.max_runs_per_hour)) reason = "Alcanzaste el límite de ejecuciones por hora. Espera un rato e inténtalo de nuevo.";
  else if (ag) { const as = Number((await db.query("SELECT coalesce(sum(u.cost_usd),0) s FROM usage_events u JOIN companies c ON c.id=u.company_id WHERE c.agency_id=$1 AND u.created_at >= date_trunc('month', now())", [ag.id]))[0].s); if (as >= Number(ag.monthly_budget_usd)) reason = "La oficina completa alcanzó su límite mensual de uso de IA. No se ejecutarán nuevas tareas hasta que se amplíe."; }
  return { budgetUsd: budget, spentUsd: spent, pct, level: reason ? "bloqueado" : pct >= 0.8 ? "aviso" : "ok", maxRunsPerHour: Number(c.max_runs_per_hour), runsLastHour: runs, blockedReason: reason };
}
export async function officeUsage(db: Db, companyId: string) {
  const limits = await limitStatus(db, companyId);
  const tot = (await db.query("SELECT count(*)::int calls, coalesce(sum(input_tokens),0)::int tin, coalesce(sum(output_tokens),0)::int tout, coalesce(sum(cost_usd),0)::float cost FROM usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now())", [companyId]))[0];
  const byEmployee = await db.query(`SELECT coalesce(e.name,'(empleado eliminado)') name, count(u.id)::int calls, coalesce(sum(u.input_tokens),0)::int tin, coalesce(sum(u.output_tokens),0)::int tout, coalesce(sum(u.cost_usd),0)::float cost
    FROM usage_events u LEFT JOIN employees e ON e.id=u.employee_id WHERE u.company_id=$1 AND u.created_at >= date_trunc('month', now()) GROUP BY 1 ORDER BY 5 DESC`, [companyId]);
  const recent = await db.query(`SELECT t.id, t.title, t.status, t.input_tokens tin, t.output_tokens tout, t.cost_usd::float cost, t.created_at, e.name employee FROM tasks t LEFT JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 AND (t.input_tokens>0 OR t.output_tokens>0) ORDER BY t.created_at DESC LIMIT 15`, [companyId]);
  return { limits, totals: tot, byEmployee, recent };
}
/** Vista de la OFICINA completa (agencia) con el reparto por cliente. */
export async function agencyUsage(db: Db, agencyId: string) {
  const ag = (await db.query("SELECT id, name, status, monthly_budget_usd::float budget FROM agencies WHERE id=$1", [agencyId]))[0]; if (!ag) throw new Error("Oficina no encontrada.");
  const clients = await db.query(`SELECT c.id, c.name, c.is_demo, c.monthly_budget_usd::float budget, coalesce(sum(u.input_tokens),0)::int tin, coalesce(sum(u.output_tokens),0)::int tout, coalesce(sum(u.cost_usd),0)::float cost, count(u.id)::int calls
    FROM companies c LEFT JOIN usage_events u ON u.company_id=c.id AND u.created_at >= date_trunc('month', now()) WHERE c.agency_id=$1 GROUP BY c.id ORDER BY cost DESC, c.name`, [agencyId]);
  const spent = clients.reduce((n: number, c: any) => n + c.cost, 0);
  return { office: ag, spent, pct: ag.budget > 0 ? spent / ag.budget : 1, level: spent >= ag.budget ? "bloqueado" : spent >= ag.budget * 0.8 ? "aviso" : "ok", clients };
}
