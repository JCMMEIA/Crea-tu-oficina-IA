import { Db, newId } from "../db";
import { assertOperator, Operator } from "../commercial/admin";

/**
 * Embudo REAL: visitantes → clics de compra → pagos iniciados → pagos confirmados → oficinas activadas. Todo sale de la base; lo que no existe sale en cero o «sin datos».
 *  - visitantes = vistas de la landing (no personas únicas: sin cookies ni IP) · clic de compra = botón «Crear mi oficina IA» · pago iniciado = intención con sesión de Stripe creada
 *  - pago confirmado = pedido por webhook firmado · activada = oficina con ≥1 empleado y ≥1 tarea completada
 *  - costo de adquisición (CAC) = gasto en anuncios registrado a mano ÷ pagos confirmados. Sin gasto registrado → «sin datos» (no se inventa).
 */
export async function conversionFunnel(db: Db, op: Operator | null, days = 30) {
  assertOperator(op); const d = Math.min(365, Math.max(1, Math.floor(days))); const since = `now() - interval '${d} days'`;
  const n = async (sql: string, p: unknown[] = []) => Number((await db.query<{ n: string }>(sql, p))[0].n);
  const visitantes = await n(`SELECT count(*) n FROM events WHERE name='visita' AND path='/' AND created_at > ${since}`);
  const clics = await n(`SELECT count(*) n FROM events WHERE name='cta_click' AND props->>'cta' LIKE 'comprar-%' AND created_at > ${since}`);
  const iniciados = await n(`SELECT count(*) n FROM checkout_intents WHERE checkout_session_id IS NOT NULL AND kind='primera' AND created_at > ${since}`);
  const pagos = await n(`SELECT count(*) n FROM orders WHERE status <> 'error' AND created_at > ${since}`);
  const pagosPrimera = await n(`SELECT count(*) n FROM orders WHERE status <> 'error' AND kind='primera' AND created_at > ${since}`);
  const entregadas = await n(`SELECT count(*) n FROM orders WHERE status='entregada' AND created_at > ${since}`);
  const errores = await n(`SELECT count(*) n FROM orders WHERE status='error'`);
  const activadas = await n(`SELECT count(*) n FROM agencies a WHERE a.created_at > ${since} AND a.id IN (SELECT agency_id FROM orders WHERE agency_id IS NOT NULL)
    AND EXISTS (SELECT 1 FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=a.id) AND EXISTS (SELECT 1 FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=a.id AND t.status='completed')`);
  const ingresos = await db.query(`SELECT upper(currency) currency, sum(amount_total)::float/100 total FROM orders WHERE status<>'error' AND created_at > ${since} GROUP BY 1`);
  const gasto = await n(`SELECT coalesce(sum(amount_mxn),0) n FROM ad_spend WHERE day >= (now() - interval '${d} days')::date`);
  const porFuente = await db.query(`SELECT source, count(*)::int pagos, (SELECT coalesce(sum(s.amount_mxn),0)::float FROM ad_spend s WHERE s.source=o.source AND s.day >= (now() - interval '${d} days')::date) gasto
    FROM orders o WHERE o.status<>'error' AND o.kind='primera' AND o.created_at > ${since} GROUP BY o.source ORDER BY 2 DESC LIMIT 10`);
  const correos = (await db.query("SELECT status, count(*)::int n FROM emails GROUP BY status")).reduce((a: any, r: any) => ({ ...a, [r.status]: r.n }), {});
  const ia = (await db.query("SELECT ok, detail, checked_at FROM system_checks WHERE name='ai'"))[0] ?? null;
  return { days: d, visitantes, clics, iniciados, pagos, pagosPrimera, entregadas, errores, activadas, ingresos, gasto, cac: gasto > 0 && pagosPrimera > 0 ? gasto / pagosPrimera : null, porFuente, correos, ia };
}
export async function addAdSpend(db: Db, op: Operator | null, i: { day: string; source: string; amountMxn: number; note?: string }) {
  assertOperator(op); if (!/^\d{4}-\d{2}-\d{2}$/.test(i.day)) throw new Error("Fecha no válida."); if (!(i.amountMxn >= 0) || !Number.isFinite(i.amountMxn)) throw new Error("Monto no válido.");
  await db.query("INSERT INTO ad_spend(id,day,source,amount_mxn,note) VALUES($1,$2,$3,$4,$5)", [newId(), i.day, (i.source || "meta").toLowerCase().slice(0, 60), i.amountMxn, (i.note ?? "").slice(0, 200)]);
}
export async function recentOrders(db: Db, op: Operator | null) {
  assertOperator(op);
  return db.query(`SELECT o.id,o.email,o.plan,o.kind,o.status,o.last_error,o.amount_total,o.currency,o.source,o.created_at,a.name office FROM orders o LEFT JOIN agencies a ON a.id=o.agency_id ORDER BY o.created_at DESC LIMIT 50`);
}
