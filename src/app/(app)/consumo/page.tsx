import Link from "next/link";
import { requireActor, when } from "@/lib/session";
import { officeUsage } from "@/server/usage/report";

export const metadata = { title: "Mi consumo" };
const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 4 : 2)}`; const num = (n: number) => n.toLocaleString("es-MX");
export default async function Consumo() {
  const { db, actor } = await requireActor(); const u = await officeUsage(db, actor.companyId); const l = u.limits; const pct = Math.min(100, Math.round(l.pct * 100));
  return (<><h1>Mi consumo de IA</h1><p className="lead">Tres cosas distintas: lo que se usó (tokens), lo que cuesta (estimado) y hasta dónde puedes llegar (límites). Se reinicia cada mes.</p>
    {l.blockedReason && <div className="notice bad" role="alert" data-testid="limit-banner">{l.blockedReason}</div>}
    <div className="grid">
      <section className="card" data-testid="usage-tokens"><h2>1 · Tokens consumidos</h2><p style={{ fontSize: "1.6rem", margin: "4px 0" }}><b>{num(u.totals.tin + u.totals.tout)}</b></p><p className="muted">{num(u.totals.tin)} de entrada · {num(u.totals.tout)} de salida · {u.totals.calls} ejecuciones este mes</p></section>
      <section className="card" data-testid="usage-cost"><h2>2 · Costo estimado</h2><p style={{ fontSize: "1.6rem", margin: "4px 0" }}><b>{usd(u.totals.cost)}</b></p><p className="muted">Calculado con la tarifa del modelo configurada en el servidor. Es una estimación, no una factura.</p></section>
      <section className="card" data-testid="usage-limits"><h2>3 · Límites</h2><p><b>Presupuesto mensual de IA:</b> {usd(l.budgetUsd)}</p><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Uso del presupuesto mensual" style={{ height: 10, background: "rgba(128,128,128,.25)", borderRadius: 6 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: l.level === "bloqueado" ? "#dc2626" : l.level === "aviso" ? "#d97706" : "var(--brand,#6d4ad6)" }} /></div>
        <p className="muted">Usado {usd(l.spentUsd)} ({pct}%) · {l.level === "bloqueado" ? "límite alcanzado" : l.level === "aviso" ? "te acercas al límite" : "dentro del límite"}</p><p className="muted">Tope: {l.maxRunsPerHour} ejecuciones por hora (llevas {l.runsLastHour}). Al llegar a un límite, las nuevas tareas se detienen y te avisamos.</p></section></div>
    <section className="card" style={{ marginTop: 12 }}><h2>Por empleado</h2>{u.byEmployee.length ? <table><thead><tr><th>Empleado</th><th>Ejecuciones</th><th>Tokens</th><th>Costo estimado</th></tr></thead><tbody>{u.byEmployee.map((e: any) => <tr key={e.name}><td>{e.name}</td><td>{e.calls}</td><td>{num(e.tin + e.tout)}</td><td>{usd(e.cost)}</td></tr>)}</tbody></table> : <p className="muted">Aún no hay consumo este mes. <Link href="/tareas">Prueba una tarea guiada</Link>.</p>}</section>
    <section className="card" style={{ marginTop: 12 }}><h2>Últimas ejecuciones</h2>{u.recent.length ? <table><tbody>{u.recent.map((r: any) => <tr key={r.id}><td><Link href={`/actividad/${r.id}`}>{r.title}</Link><div className="muted">{r.employee} · {when(r.created_at)}</div></td><td>{num(r.tin + r.tout)} tokens</td><td>{usd(r.cost)}</td></tr>)}</tbody></table> : <p className="muted">Sin ejecuciones.</p>}</section></>);
}
