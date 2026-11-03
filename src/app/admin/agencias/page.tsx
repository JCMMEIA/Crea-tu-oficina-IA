import { requireOperator, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { PLAN_ORDER, PLANS } from "@/server/agency/plans";
import { billingStatus } from "@/server/commercial/billing";
import { cancelLicenseAction, dismissRequestAction, grantLicenseAction } from "../../admin_actions";

export default async function Agencias({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const { db } = await requireOperator(); const b = billingStatus();
  const reqs = await db.query("SELECT r.id,r.plan,r.created_at,a.id agency_id,a.name FROM plan_requests r JOIN agencies a ON a.id=r.agency_id WHERE r.status='solicitada' ORDER BY r.created_at");
  const ags = await db.query("SELECT a.id,a.name,a.plan,a.billing_status,a.signup_source,a.created_at,(SELECT count(*) FROM companies c WHERE c.agency_id=a.id AND NOT c.is_demo)::int clients FROM agencies a WHERE a.id NOT LIKE 'ag-%' ORDER BY a.created_at DESC LIMIT 200");
  const sel = (def?: string) => <select name="plan" defaultValue={def}>{PLAN_ORDER.map((k) => <option key={k} value={k}>{PLANS[k].label}</option>)}</select>;
  return (<><h1>Agencias y licencias</h1><Flash sp={sp} />
    <div className="tip">Cobros: <b>{b.enabled ? "activos" : "DESACTIVADOS"}</b> (sin pasarela registrada). Conceder una licencia aquí es <b>manual</b>: no mueve dinero; úsala solo para cortesías o cobros hechos fuera de la plataforma.</div>
    <h2>Solicitudes de plan ({reqs.length})</h2>{reqs.length ? <table data-testid="plan-requests"><tbody>{reqs.map((r: any) => <tr key={r.id}><td><b>{r.name}</b> pidió <b>{PLANS[r.plan as keyof typeof PLANS]?.label}</b><div className="muted">{when(r.created_at)}</div></td>
      <td><form action={grantLicenseAction} className="inline"><input type="hidden" name="agencyId" value={r.agency_id} /><input type="hidden" name="plan" value={r.plan} /><input name="note" placeholder="Nota (p. ej. pago recibido fuera)" /><button>Conceder licencia</button></form></td>
      <td><form action={dismissRequestAction} className="inline"><input type="hidden" name="id" value={r.id} /><button className="ghost">Descartar</button></form></td></tr>)}</tbody></table> : <p className="muted">No hay solicitudes pendientes.</p>}
    <h2>Agencias ({ags.length})</h2>{ags.length ? <table data-testid="agencies"><thead><tr><th>Agencia</th><th>Plan</th><th>Clientes</th><th>Fuente</th><th>Licencia</th></tr></thead><tbody>{ags.map((a: any) => <tr key={a.id}><td>{a.name}<div className="muted">{when(a.created_at)}</div></td><td>{PLANS[a.plan as keyof typeof PLANS]?.label ?? a.plan}</td><td>{a.clients}</td><td>{a.signup_source}</td>
      <td><form action={grantLicenseAction} className="inline"><input type="hidden" name="agencyId" value={a.id} />{sel(a.plan)} <button className="ghost">Conceder</button></form>
        {a.plan !== "prueba" && <form action={cancelLicenseAction} className="inline"><input type="hidden" name="agencyId" value={a.id} /><button className="ghost">Cancelar</button></form>}</td></tr>)}</tbody></table> : <p className="muted">Aún no hay agencias.</p>}</>);
}
