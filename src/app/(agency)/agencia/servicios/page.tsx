import { requireAgency } from "@/lib/session";
import { Flash, EmptyState, Help } from "@/lib/ui";
import { listServices, estimateServiceCost } from "@/server/agency";
import { INDUSTRIES } from "@/server/agency/industries";
import { EMPLOYEES } from "@/server/catalog/data";
import { industryAction, serviceCreateAction, serviceUpdateAction } from "../../../agency_actions";

export const metadata = { title: "Qué ofrezco" };
export default async function Servicios({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const list = await listServices(db, agency);
  const name = (k: string) => EMPLOYEES.find((e) => e.key === k)?.name ?? k;
  return (<><h1>Qué ofrezco</h1><p className="lead">Tu lista de servicios para vender. Tú pones el precio; aquí no se cobra nada a nadie.</p><Flash sp={sp} />
    {!list.length && <EmptyState icon="🛍️" title="Todavía no ofreces nada" text="Elige un tipo de negocio y te preparamos servicios de ejemplo. Después ajustas los precios." />}
    <div className="grid" style={{ marginTop: 12 }}>{list.map((s: any) => { const est = estimateServiceCost(s.est_tasks_per_month); const on = s.status === "publicado"; return (<div className="card" key={s.id}>
      <h3>{s.name}</h3><p><span className={`state ${on ? "ok" : ""}`}>{on ? "✅ Listo para ofrecer" : "📝 Aún no lo ofrezco"}</span> <span className="state">{s.deployments} cliente(s)</span></p>
      <p className="muted">{s.description}</p><p className="muted">Lo hacen: {(s.template_keys as string[]).map(name).join(", ")}</p>
      <form action={serviceUpdateAction}><input type="hidden" name="id" value={s.id} /><label>Precio (US$ {s.price_unit === "mes" ? "al mes" : "por proyecto"})</label><input type="number" name="price" defaultValue={s.price} step="1" min={0} />
        <div className="row"><button className="ghost">Guardar precio</button><button className="ghost" name="status" value={on ? "borrador" : "publicado"}>{on ? "Dejar de ofrecer" : "Marcar listo para ofrecer"}</button></div></form>
      <details><summary>¿Cuánto me cuesta hacerlo? (estimación)</summary><p className="muted">{est ? `Aproximadamente US$ ${est.monthlyUsd.toFixed(2)} al mes en inteligencia artificial, y te quedarían US$ ${(s.price - est.monthlyUsd).toFixed(2)} (${est.assumptions}). Es solo una estimación.` : "Para calcularlo hay que terminar de activar la inteligencia artificial en esta instalación."}</p></details></div>); })}</div>
    <div className="card" style={{ marginTop: 12 }}><h2>💡 Ideas listas por tipo de negocio</h2><p className="muted">Agrega servicios de ejemplo y luego cambia lo que quieras.</p>
      <div className="row">{INDUSTRIES.map((i) => <form key={i.key} action={industryAction}><input type="hidden" name="industry" value={i.key} /><button className="ghost" title={i.description}>+ {i.name}</button></form>)}</div></div>
    <details className="card" style={{ marginTop: 12 }}><summary><b>Crear un servicio desde cero (opcional)</b></summary><form action={serviceCreateAction}>
      <label>Nombre del servicio</label><input name="name" required /><label>¿Qué hace por el cliente?</label><textarea name="description" rows={2} />
      <label>¿Quién lo hace?</label><Help>Marca a los empleados que participan.</Help><div style={{ columns: "220px" }}>{EMPLOYEES.map((e) => <label key={e.key} style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name="templateKeys" value={e.key} style={{ width: "auto" }} /> {e.name}</label>)}</div>
      <div className="row"><div><label>Precio (US$)</label><input type="number" name="price" defaultValue={0} min={0} /></div><div><label>Se cobra</label><select name="unit"><option value="mes">cada mes</option><option value="proyecto">una sola vez</option></select></div><input type="hidden" name="tasks" value="20" /></div><p><button className="big">Crear servicio</button></p></form></details></>);
}
