import Link from "next/link";
import { requireOperator, money } from "@/lib/session";
import { funnel } from "@/server/commercial/metrics";
import { crmSummary } from "@/server/commercial/crm";
import { billingStatus } from "@/server/commercial/billing";
import { LEAD_STATUSES } from "@/server/leads";

export default async function Resumen({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { db, op } = await requireOperator(); const days = [7, 30, 90].includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const f = await funnel(db, op, days); const c = await crmSummary(db, op); const b = billingStatus();
  const pct = (a: number, bb: number) => (bb ? `${Math.round((a / bb) * 100)} %` : "—");
  const tile = (t: string, v: string | number, note = "", id = "") => <div className="card" data-testid={id}><div className="muted">{t}</div><div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{v}</div>{note && <div className="muted" style={{ fontSize: ".8rem" }}>{note}</div>}</div>;
  const tbl = (rows: any[], k: string, v: string, label: string) => rows.length ? <table><tbody>{rows.map((r) => <tr key={r[k]}><td>{r[k]}</td><td>{r[v]}</td></tr>)}</tbody></table> : <p className="muted">Sin datos todavía en {label}.</p>;
  return (<><p className="row">Periodo: {[7, 30, 90].map((d) => <Link key={d} href={`/admin?dias=${d}`} className={d === days ? "btn" : "btn ghost"}>{d} días</Link>)}</p>
    {(c.demosPorAtender > 0 || c.recordatoriosVencidos > 0) && <div className="tip" role="alert">🔔 {c.demosPorAtender} demostración(es) por atender · {c.recordatoriosVencidos} recordatorio(s) vencido(s). <Link href="/admin/prospectos?due=1">Ver pendientes</Link></div>}
    <h2>Embudo (últimos {days} días)</h2>
    <div className="cols" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
      {tile("Visitas", f.visitas, "vistas de landing, demo y registro; no son personas únicas", "m-visitas")}{tile("Clics en botones", f.clicsCta)}{tile("Prospectos", f.leads, `conv. visita→prospecto ${pct(f.leads, f.visitas)}`, "m-leads")}
      {tile("Demos solicitadas", f.demos, "", "m-demos")}{tile("Registros (agencias)", f.registros, "", "m-registros")}{tile("Activaciones", f.activaciones, `${pct(f.activaciones, f.registros)} de los registros`, "m-activ")}
      {tile("Planes solicitados", f.planesSolicitados, "solicitudes, no pagos")}</div>
    <p className="muted">Activación = agencia con ≥1 empleado y ≥1 tarea completada. Con pocos datos los porcentajes no significan nada: no los uses para decidir con menos de decenas de casos.</p>
    <h2>Compras, cancelaciones y retención</h2>
    <div className="cols" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
      {tile("Compras", f.compras.activo ? f.compras.cantidad : "No activo", b.enabled ? "pasarela activa" : "cobros desactivados: no hay compras posibles", "m-compras")}
      {tile("Cancelaciones", f.cancelaciones.cantidad, "licencias canceladas (manuales hasta que haya pasarela)")}
      {tile("Retención 7 días", f.retencion7d ? `${f.retencion7d.pct} %` : "Sin datos", f.retencion7d ? `${f.retencion7d.activas} de ${f.retencion7d.base} agencias con ≥7 días` : "aún no hay agencias con 7 días de antigüedad")}
      {tile("Costo de IA", money(f.costoIA.usd), `${f.costoIA.llamadas} llamadas registradas`, "m-ia")}</div>
    <div className="cols" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: 14 }}>
      <div className="card"><h3>Visitas por fuente</h3>{tbl(f.visitsBySource, "source", "visitas", "visitas")}</div>
      <div className="card"><h3>Prospectos por fuente</h3>{f.bySource.length ? <table><thead><tr><th>Fuente</th><th>Prosp.</th><th>Demos</th></tr></thead><tbody>{f.bySource.map((r: any) => <tr key={r.source}><td>{r.source}</td><td>{r.leads}</td><td>{r.demos}</td></tr>)}</tbody></table> : <p className="muted">Sin datos todavía.</p>}</div>
      <div className="card"><h3>Registros por fuente</h3>{tbl(f.regBySource, "source", "registros", "registros")}</div>
      <div className="card"><h3>Costo de IA por agencia</h3>{f.costoIA.porAgencia.length ? <table><tbody>{f.costoIA.porAgencia.map((r: any) => <tr key={r.name}><td>{r.name}</td><td>{money(r.cost)}</td></tr>)}</tbody></table> : <p className="muted">Sin uso de IA registrado.</p>}</div></div>
    <h2>Estado de ventas</h2><div className="card"><table><tbody>{LEAD_STATUSES.map(([k, t]) => <tr key={k}><td><Link href={`/admin/prospectos?status=${k}`}>{t}</Link></td><td>{c.byStatus[k] ?? 0}</td></tr>)}</tbody></table></div></>);
}
