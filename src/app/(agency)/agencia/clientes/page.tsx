import Link from "next/link";
import { requireAgency, money } from "@/lib/session";
import { Flash, EmptyState, Help, Tip } from "@/lib/ui";
import { listClients } from "@/server/agency";
import { INDUSTRIES } from "@/server/agency/industries";
import { clientCreateAction, enterClientAction } from "../../../agency_actions";

export const metadata = { title: "Mis clientes" };
export default async function Clientes({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const list = await listClients(db, agency); const real = list.filter((c: any) => !c.is_demo);
  return (<><h1>Mis clientes</h1><p className="lead">Cada cliente es un negocio al que ayudas. Tiene su propia oficina, separada de las demás.</p><Flash sp={sp} />
    <form action={clientCreateAction} className="card"><h2>➕ Agregar cliente</h2>
      <label htmlFor="nc">¿Cómo se llama su negocio?</label><Help>Solo necesitas el nombre; lo demás es opcional.</Help><input id="nc" name="name" required placeholder="Ejemplo: Café Luna" data-testid="client-name" />
      <details><summary>Más opciones (opcional)</summary>
        <label>¿A qué se dedica?</label><select name="industry"><option value="">No lo sé / otro</option>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select>
        <label>¿Cuánto puede gastar al mes en inteligencia artificial? (US$)</label><Help>Si se acaba, sus empleados dejan de trabajar hasta el mes siguiente.</Help><input type="number" name="budget" defaultValue={10} min={0} step="0.5" />
        <label>¿Qué quiere lograr?</label><textarea name="goals" rows={2} /></details>
      <p><button className="big" data-testid="client-add">Agregar cliente</button></p></form>
    {!real.length && <div style={{ marginTop: 12 }}><EmptyState icon="🤝" title="Aún no tienes clientes" text="Agrega al primero: su oficina se crea sola y podrás contratar empleados para él." /></div>}
    <div className="grid" style={{ marginTop: 12 }}>{list.map((c: any) => (<div className="card" key={c.id} data-testid={`client-${c.id}`}><h3>{c.is_demo ? "🧪 Oficina de práctica" : c.name}</h3>
      <p className="muted">{c.is_demo ? "Aquí practicas sin riesgo, con datos inventados." : c.industry || "Sin tipo de negocio"}</p>
      <p>{c.employees} empleado(s) · {c.tasks} trabajo(s){c.pending_approvals > 0 && <> · <span className="state warn">✋ {c.pending_approvals} por aprobar</span></>}</p>
      <p className="muted">Consumo este mes: {money(c.month_cost)} de {money(c.budget)}</p>
      <div className="row"><form action={enterClientAction}><input type="hidden" name="companyId" value={c.id} /><button>Abrir su oficina</button></form>
        <Link className="btn ghost" href={`/agencia/tarea?cliente=${c.id}`}>Darle una tarea</Link>{!c.is_demo && <Link className="btn ghost" href={`/agencia/clientes/${c.id}`}>Detalles</Link>}</div></div>))}</div>
    {real.length > 0 && <Tip>Para que un cliente vea su propia oficina, entra a «Detalles» y crea su acceso.</Tip>}</>);
}
