import { requireAgency } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { listServices, estimateServiceCost } from "@/server/agency";
import { INDUSTRIES } from "@/server/agency/industries";
import { EMPLOYEES } from "@/server/catalog/data";
import { industryAction, serviceCreateAction, serviceUpdateAction } from "../../../agency_actions";
export default async function Servicios({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const list = await listServices(db, agency);
  const name = (k: string) => EMPLOYEES.find((e) => e.key === k)?.name ?? k;
  return (<><h1>Catálogo de servicios</h1><p className="muted">Lo que vendes a tus clientes. Los precios son tuyos; no hay cobros en la plataforma. Los costos de IA son <b>estimaciones</b>.</p><Flash sp={sp} />
    <div className="card"><h2>Plantillas por industria</h2><p className="muted">Agrega paquetes de servicios como borrador. Los precios sugeridos son un punto de partida editable, no una promesa de ingresos.</p>
      <div className="row">{INDUSTRIES.map((i) => <form key={i.key} action={industryAction}><input type="hidden" name="industry" value={i.key} /><button className="ghost" title={i.description}>+ {i.name}</button></form>)}</div></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Servicio nuevo</h2><form action={serviceCreateAction}><label>Nombre comercial</label><input name="name" required /><label>Descripción para el cliente</label><textarea name="description" rows={2} />
      <label>Agentes incluidos</label><div style={{ columns: "220px" }}>{EMPLOYEES.map((e) => <label key={e.key} style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name="templateKeys" value={e.key} style={{ width: "auto" }} /> {e.name}</label>)}</div>
      <div className="row"><div><label>Precio (US$)</label><input type="number" name="price" defaultValue={0} min={0} step="1" /></div><div><label>Cobro</label><select name="unit"><option value="mes">por mes</option><option value="proyecto">por proyecto</option></select></div><div><label>Tareas estimadas/mes</label><input type="number" name="tasks" defaultValue={20} min={1} /></div></div><p><button>Crear servicio</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Mi catálogo ({list.length})</h2>{list.length ? list.map((s: any) => { const est = estimateServiceCost(s.est_tasks_per_month); return (<div key={s.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
      <b>{s.name}</b> <span className={`chip ${s.status === "publicado" ? "ok" : ""}`}>{s.status}</span><span className="chip">{s.deployments} clientes</span>
      <div className="muted">{s.description}</div><div className="muted">Agentes: {(s.template_keys as string[]).map(name).join(", ")}</div>
      <div>Precio: <b>US$ {s.price}</b> / {s.price_unit}{est ? <> · costo de IA estimado: <b>US$ {est.monthlyUsd.toFixed(2)}/mes</b> · margen bruto estimado US$ {(s.price - est.monthlyUsd).toFixed(2)} <span className="muted">({est.assumptions})</span></> : <span className="muted"> · costo de IA: configura las tarifas del modelo para estimarlo</span>}</div>
      <form action={serviceUpdateAction} className="row"><input type="hidden" name="id" value={s.id} /><input type="number" name="price" defaultValue={s.price} step="1" style={{ width: 110 }} aria-label="Precio" /><button className="ghost">Guardar precio</button>
        <button className="ghost" name="status" value={s.status === "publicado" ? "borrador" : "publicado"}>{s.status === "publicado" ? "Pasar a borrador" : "Publicar"}</button></form></div>); }) : <Empty>Aún no tienes servicios. Usa una plantilla por industria o crea el tuyo.</Empty>}</div></>);
}
