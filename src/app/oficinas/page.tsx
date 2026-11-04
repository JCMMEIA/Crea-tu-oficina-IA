import Link from "next/link";
import { requireUser, when } from "@/lib/session";
import { Flash, BigAction } from "@/lib/ui";
import { Icon } from "@/components/Icon";
import { listOffices } from "@/server/commerce/offices";
import { getIndustry } from "@/server/agency/industries";
import { planOf } from "@/server/agency/plans";
import { cancelOfficeAction, keepOfficeAction, pauseOfficeAction, portalAction, resumeOfficeAction, selectOfficeAction } from "../commerce_actions";

const ESTADO: Record<string, [string, string]> = { activa: ["Activa", "ok"], pausada: ["Pausada", "warn"], cancelada: ["Cancelada", "bad"] };
const COBRO: Record<string, string> = { pagado: "Suscripción al corriente", pago_pendiente: "Pago pendiente: actualiza tu forma de pago", cancelada: "Suscripción terminada", cortesia: "Cortesía (sin cobro)", sin_facturacion: "Sin cobro", licencia_manual: "Licencia manual" };
export default async function MisOficinas({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, user } = await requireUser(); const offices = await listOffices(db, user.userId);
  return (<><h1>Mis oficinas IA</h1><Flash sp={sp} />
    <div className="actions" data-testid="office-actions">
      <BigAction href="/oficinas/nueva" icon={<Icon name="plusbox" size={22} />} title="NUEVA OFICINA IA" text="Crea otra oficina con su propio negocio, empleados y suscripción." testId="btn-nueva-oficina" />
      <BigAction href="#mis-oficinas" icon={<Icon name="layers" size={22} />} title="MIS OFICINAS" text={`Tienes ${offices.length}. Entra a cualquiera con un clic.`} testId="btn-mis-oficinas" /></div>
    <h2 id="mis-oficinas" style={{ marginTop: 22 }}>Mis oficinas ({offices.length})</h2>
    {!offices.length && <div className="card"><p>Todavía no tienes oficinas. <Link href="/oficinas/nueva">Crea la primera</Link>.</p></div>}
    <div className="grid">{offices.map((o) => { const [est, tone] = ESTADO[o.status] ?? [o.status, ""]; const owner = o.role === "agency_owner"; const ind = getIndustry(o.business_type);
      return (<div className="card" key={o.id} data-testid={`office-${o.id}`} data-office-name={o.name}>
        <h3>{o.name}</h3><p><span className={`badge ${tone}`}>{est}</span></p>
        <p className="muted">{ind?.name ?? (o.business_type || "Negocio sin definir")} · Plan {planOf(o.plan).label} · {o.employees} empleado(s) · {o.clients} cliente(s)</p>
        <p className="muted">{COBRO[o.billing_status] ?? o.billing_status}{o.cancel_at_period_end ? ` · se cancelará el ${when(o.current_period_end)}` : ""}</p>
        <div className="row">
          {o.status !== "cancelada" || true ? <form action={selectOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button data-testid={`enter-${o.id}`}>Entrar</button></form> : null}
          {owner && o.status === "activa" && <form action={pauseOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost" data-testid={`pause-${o.id}`}>Pausar</button></form>}
          {owner && o.status === "pausada" && <form action={resumeOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost" data-testid={`resume-${o.id}`}>Reanudar</button></form>}
          {owner && o.status !== "cancelada" && !o.cancel_at_period_end && <form action={cancelOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost" data-testid={`cancel-${o.id}`}>Cancelar al final del periodo</button></form>}
          {owner && o.status !== "cancelada" && o.cancel_at_period_end && <form action={keepOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost" data-testid={`keep-${o.id}`}>Mantener mi suscripción</button></form>}
          {owner && o.billing_status !== "cortesia" && <form action={portalAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost">Pagos y comprobantes</button></form>}</div>
        {o.status === "pausada" && <p className="muted">Pausada: sus empleados no trabajan y el cobro está detenido. Tus datos se conservan.</p>}
        {o.status === "cancelada" && <p className="muted">Cancelada: sus empleados ya no trabajan. Tus datos se conservan; puedes seguir consultando y descargando lo que ya tienes.</p>}
      </div>); })}</div></>);
}
