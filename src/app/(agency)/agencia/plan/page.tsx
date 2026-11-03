import Link from "next/link";
import { requireAgency, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { PLAN_ORDER, PLANS, planPrice, isPlanKey } from "@/server/agency/plans";
import { billingEnabled, entitlements } from "@/server/commercial/billing";
import { requestPlanAction } from "../../../agency_actions";

export const dynamic = "force-dynamic";
export default async function Plan({ searchParams }: { searchParams: Promise<{ plan?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const e = await entitlements(db, agency); const buy = billingEnabled();
  const want = sp.plan && isPlanKey(sp.plan) && sp.plan !== "prueba" ? sp.plan : null;
  const bar = (n: number, max: number) => <progress value={n} max={max} aria-label={`${n} de ${max}`} style={{ width: "100%" }} />;
  return (<><h1>Mi plan</h1><Flash sp={sp} />
    <div className="card"><h2>Hoy tienes: {e.label}</h2>
      <p>Clientes: <b>{e.clients}</b> de {e.maxClients}</p>{bar(e.clients, e.maxClients)}
      <p>Empleados digitales: <b>{e.employees}</b> de {e.maxEmployees}</p>{bar(e.employees, e.maxEmployees)}
      <p className="muted">No cuenta tu oficina de práctica ni las demostraciones.</p>
      {e.license && <p className="muted">Licencia {e.license.status}: plan {e.license.plan} ({e.license.origin === "manual" ? "concedida por el equipo" : "por pasarela"}) desde {when(e.license.starts_at)}.</p>}</div>
    {e.pendingRequest && <div className="tip" role="status" data-testid="plan-pending">✅ Ya recibimos tu solicitud del plan <b>{PLANS[e.pendingRequest.plan as keyof typeof PLANS]?.label}</b> ({when(e.pendingRequest.created_at)}). Una persona te escribirá. No se ha cobrado nada.</div>}
    <h2 style={{ marginTop: 18 }}>Planes</h2>
    <div className="cols" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>{PLAN_ORDER.filter((k) => k !== "prueba").map((k) => { const p = PLANS[k]; const pr = planPrice(k); return (
      <div className="card" key={k} style={want === k ? { outline: "2px solid var(--brand)" } : undefined}><h3>{p.label}</h3><p><b>{pr ? `US$ ${pr}/mes` : "Precio por confirmar"}</b></p><p className="muted">{p.maxClients} clientes · {p.maxEmployees} empleados</p>
        {e.plan === k ? <p><span className="state ok">Tu plan actual</span></p> :
          <form action={requestPlanAction}><input type="hidden" name="plan" value={k} /><button data-testid={`request-${k}`}>{buy ? "Contratar" : "Quiero este plan"}</button></form>}</div>); })}</div>
    {!buy && <p className="muted" style={{ marginTop: 12 }}><b>Cobros desactivados.</b> «Quiero este plan» solo deja tu solicitud; no se cobra ni se cambia tu plan hasta que el equipo hable contigo.</p>}
    <p><Link href="/agencia">← Mi oficina</Link></p></>);
}
