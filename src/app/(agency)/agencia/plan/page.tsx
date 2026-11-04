import Link from "next/link";
import { requireAgency, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { PLAN_ORDER, PLANS, planPriceInfo, formatPrice, isPlanKey } from "@/server/agency/plans";
import { billingEnabled, entitlements } from "@/server/commercial/billing";
import { requestPlanAction } from "../../../agency_actions";

export const dynamic = "force-dynamic";
async function Comprobantes({ db, agencyId }: { db: any; agencyId: string }) {
  const rows = await db.query("SELECT id,amount_paid,currency,status,hosted_invoice_url,created_at FROM invoices WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 12", [agencyId]);
  return (<div className="card" style={{ marginTop: 14 }} data-testid="comprobantes"><h2>Comprobantes de pago</h2>{rows.length ? <table><tbody>{rows.map((r: any) => <tr key={r.id}><td>{when(r.created_at)}</td><td>{r.currency?.toUpperCase()} {(Number(r.amount_paid) / 100).toFixed(2)}</td><td>{r.status === "paid" ? "✅ Pagado" : "⚠️ No se pudo cobrar"}</td><td>{r.hosted_invoice_url ? <a href={r.hosted_invoice_url} rel="noopener noreferrer" target="_blank">Ver comprobante</a> : "—"}</td></tr>)}</tbody></table> : <p className="muted">Aún no hay comprobantes. Aparecerán aquí con cada cobro.</p>}</div>);
}
export default async function Plan({ searchParams }: { searchParams: Promise<{ plan?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const e = await entitlements(db, agency); const buy = billingEnabled();
  const sub = (await db.query("SELECT stripe_subscription_id s FROM agencies WHERE id=$1", [agency.agencyId]))[0]?.s as string | null;
  const want = sp.plan && isPlanKey(sp.plan) && sp.plan !== "prueba" ? sp.plan : null;
  const bar = (n: number, max: number) => <progress value={n} max={max} aria-label={`${n} de ${max}`} style={{ width: "100%" }} />;
  return (<><h1>Mi plan</h1><Flash sp={sp} />
    <div className="card"><h2>Hoy tienes: {e.label}</h2>
      <p>Clientes: <b>{e.clients}</b> de {e.maxClients}</p>{bar(e.clients, e.maxClients)}
      <p>Empleados digitales: <b>{e.employees}</b> de {e.maxEmployees}</p>{bar(e.employees, e.maxEmployees)}
      <p className="muted">No cuenta tu oficina de práctica ni las demostraciones.</p>
      {e.license && <p className="muted">Licencia {e.license.status}: plan {e.license.plan} ({e.license.origin === "manual" ? "concedida por el equipo" : "por pasarela"}) desde {when(e.license.starts_at)}.</p>}</div>
    {e.pendingRequest && <div className="tip" role="status" data-testid="plan-pending">✅ Ya recibimos tu solicitud del plan <b>{PLANS[e.pendingRequest.plan as keyof typeof PLANS]?.label}</b> ({when(e.pendingRequest.created_at)}). Una persona te escribirá. No se ha cobrado nada.</div>}
    {sub ? <div className="tip" role="note" data-testid="sub-managed" style={{ marginTop: 14 }}>Tu suscripción se administra en <Link href="/oficinas">Mis oficinas</Link> (pausar, cancelar al final del periodo, forma de pago y comprobantes).</div> : <>
    <h2 style={{ marginTop: 18 }}>Planes</h2>
    <div className="cols" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>{PLAN_ORDER.filter((k) => k !== "prueba").map((k) => { const p = PLANS[k]; const pr = planPriceInfo(k); return (
      <div className="card" key={k} style={want === k ? { outline: "2px solid var(--brand)" } : undefined}><h3>{p.label}</h3><p><b>{formatPrice(pr)}</b></p><p className="muted">{p.maxClients} clientes · {p.maxEmployees} empleados</p>
        {e.plan === k ? <p><span className="state ok">Tu plan actual</span></p> :
          <form action={requestPlanAction}><input type="hidden" name="plan" value={k} /><button data-testid={`request-${k}`}>{buy ? "Contratar" : "Quiero este plan"}</button></form>}</div>); })}</div>
    </>}
    {!sub && !buy && <p className="muted" style={{ marginTop: 12 }}><b>Cobros desactivados.</b> «Quiero este plan» solo deja tu solicitud; no se cobra ni se cambia tu plan hasta que el equipo hable contigo.</p>}
    <Comprobantes db={db} agencyId={agency.agencyId} />
    <p><Link href="/agencia">← Mi oficina</Link></p></>);
}
