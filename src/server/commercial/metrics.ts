import { Db } from "../db";
import { assertOperator, Operator } from "./admin";

/**
 * Medición REAL desde la base. Regla: si algo no existe todavía (compras, renovaciones) se devuelve `activo:false` / null, nunca un número inventado.
 * Definiciones (se muestran en el panel):
 *  - visitas = eventos «visita» (no son personas únicas: no usamos cookies ni IP).
 *  - registro = agencia creada. activación = agencia con ≥1 empleado contratado Y ≥1 tarea completada.
 *  - retención 7 d = de las agencias creadas hace ≥7 días, % con alguna tarea en los últimos 7 días (null si no hay agencias con esa antigüedad).
 */
export async function funnel(db: Db, op: Operator | null, days = 30) {
  assertOperator(op);
  const d = Math.min(365, Math.max(1, Math.floor(days)));
  const since = `now() - interval '${d} days'`;
  const n = async (sql: string) => Number((await db.query<{ n: string }>(sql))[0].n);
  const visitas = await n(`SELECT count(*) n FROM events WHERE name='visita' AND created_at > ${since}`);
  const clicsCta = await n(`SELECT count(*) n FROM events WHERE name='cta_click' AND created_at > ${since}`);
  const leads = await n(`SELECT count(*) n FROM leads WHERE created_at > ${since}`);
  const demos = await n(`SELECT count(*) n FROM leads WHERE demo_requested_at > ${since}`);
  const registros = await n(`SELECT count(*) n FROM agencies WHERE created_at > ${since} AND id NOT LIKE 'ag-%'`);
  const activaciones = await n(`SELECT count(*) n FROM agencies a WHERE a.created_at > ${since} AND a.id NOT LIKE 'ag-%'
    AND EXISTS (SELECT 1 FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=a.id)
    AND EXISTS (SELECT 1 FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=a.id AND t.status='completed')`);
  const planesSolicitados = await n(`SELECT count(*) n FROM plan_requests WHERE created_at > ${since}`);
  const bySource = await db.query(`SELECT source, count(*)::int leads, count(*) FILTER (WHERE kind='demo')::int demos FROM leads WHERE created_at > ${since} GROUP BY source ORDER BY 2 DESC LIMIT 10`);
  const visitsBySource = await db.query(`SELECT source, count(*)::int visitas FROM events WHERE name='visita' AND created_at > ${since} GROUP BY source ORDER BY 2 DESC LIMIT 10`);
  const regBySource = await db.query(`SELECT signup_source source, count(*)::int registros FROM agencies WHERE created_at > ${since} AND id NOT LIKE 'ag-%' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  // Compras: solo cuentan licencias con origen 'pasarela'. Sin pasarela no hay ninguna.
  const compras = await n(`SELECT count(*) n FROM licenses WHERE origin='pasarela' AND created_at > ${since}`);
  const cancelaciones = await n(`SELECT count(*) n FROM licenses WHERE status='cancelada' AND ends_at > ${since}`);
  const veteranas = await n(`SELECT count(*) n FROM agencies WHERE created_at <= now() - interval '7 days' AND id NOT LIKE 'ag-%'`);
  const activas7 = veteranas ? await n(`SELECT count(*) n FROM agencies a WHERE a.created_at <= now() - interval '7 days' AND a.id NOT LIKE 'ag-%'
    AND EXISTS (SELECT 1 FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=a.id AND t.created_at > now() - interval '7 days')`) : 0;
  const ai = (await db.query<{ cost: string; runs: string }>(`SELECT coalesce(sum(u.cost_usd),0) cost, count(*) runs FROM usage_events u JOIN companies c ON c.id=u.company_id WHERE u.created_at > ${since}`))[0];
  const aiByAgency = await db.query(`SELECT a.name, coalesce(sum(u.cost_usd),0)::float cost FROM usage_events u JOIN companies c ON c.id=u.company_id JOIN agencies a ON a.id=c.agency_id WHERE u.created_at > ${since} GROUP BY a.name ORDER BY 2 DESC LIMIT 10`);
  return {
    days: d, visitas, clicsCta, leads, demos, registros, activaciones, planesSolicitados,
    bySource, visitsBySource, regBySource,
    compras: { activo: compras > 0 || process.env.BILLING_ENABLED === "true", cantidad: compras },
    cancelaciones: { activo: false || cancelaciones > 0, cantidad: cancelaciones },
    retencion7d: veteranas ? { base: veteranas, activas: activas7, pct: Math.round((activas7 / veteranas) * 100) } : null,
    costoIA: { usd: Number(ai.cost), llamadas: Number(ai.runs), porAgencia: aiByAgency },
  };
}
