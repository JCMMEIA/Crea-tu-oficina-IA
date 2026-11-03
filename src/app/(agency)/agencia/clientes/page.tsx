import Link from "next/link";
import { requireAgency, money } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { listClients } from "@/server/agency";
import { INDUSTRIES } from "@/server/agency/industries";
import { clientCreateAction, enterClientAction } from "../../../agency_actions";
export default async function Clientes({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const list = await listClients(db, agency);
  return (<><h1>Empresas clientes</h1><p className="muted">Cada cliente tiene su propia oficina, datos y conexiones, aislados de los demás.</p><Flash sp={sp} />
    <div className="card"><h2>Agregar empresa cliente</h2><form action={clientCreateAction}><div className="grid"><div><label>Nombre de la empresa</label><input name="name" required /></div>
      <div><label>Industria</label><select name="industry"><option value="">—</option>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select></div>
      <div><label>Presupuesto mensual de IA (US$)</label><input type="number" name="budget" defaultValue={10} min={0} step="0.5" /></div></div>
      <label>Objetivos del cliente</label><textarea name="goals" rows={2} /><p><button>Crear cliente y su oficina</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Mis clientes ({list.length})</h2>{list.length ? <table><tbody>{list.map((c: any) => <tr key={c.id}><td><Link href={`/agencia/clientes/${c.id}`}><b>{c.name}</b></Link><div className="muted">{c.industry || "sin industria"} · {c.employees} empleados · {c.tasks} tareas</div></td><td>{c.pending_approvals > 0 && <span className="chip warn">{c.pending_approvals} por aprobar</span>}<div className="muted">{money(c.month_cost)} / US$ {c.budget}</div></td>
      <td><form action={enterClientAction}><input type="hidden" name="companyId" value={c.id} /><button className="ghost">Entrar a su oficina</button></form></td></tr>)}</tbody></table> : <Empty>Todavía no tienes clientes.</Empty>}</div></>);
}
