import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency, money } from "@/lib/session";
import { Flash, Help, EmptyState } from "@/lib/ui";
import { roleLabel } from "@/lib/lang";
import { listServices } from "@/server/agency";
import { enterClientAction, deployAction, clientLimitsAction, clientUserAction } from "../../../../agency_actions";

export const metadata = { title: "Detalles del cliente" };
export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, agency } = await requireAgency();
  const c = (await db.query("SELECT * FROM companies WHERE id=$1 AND agency_id=$2", [id, agency.agencyId]))[0]; if (!c) notFound();
  const services = await listServices(db, agency);
  const dep = await db.query("SELECT s.name FROM client_services cs JOIN agency_services s ON s.id=cs.service_id WHERE cs.company_id=$1 AND cs.agency_id=$2", [id, agency.agencyId]);
  const deployed = new Set((await db.query("SELECT service_id FROM client_services WHERE company_id=$1", [id])).map((r) => r.service_id));
  const emps = await db.query("SELECT id,name,status FROM employees WHERE company_id=$1 ORDER BY created_at", [id]);
  const users = await db.query("SELECT u.email, m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1", [id]);
  const spend = Number((await db.query<{ s: string }>("SELECT coalesce(sum(cost_usd),0) s FROM usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now())", [id]))[0].s);
  const enter = (label: string, next: string, cls = "") => <form action={enterClientAction} className="inline"><input type="hidden" name="companyId" value={id} /><input type="hidden" name="next" value={next} /><button className={cls}>{label}</button></form>;
  return (<><p><Link href="/agencia/clientes">← Mis clientes</Link></p><h1>{c.name}</h1><p className="lead">{c.industry || "Sin tipo de negocio"} · Consumo de inteligencia artificial este mes: {money(spend)} de {money(Number(c.monthly_budget_usd))}</p><Flash sp={sp} />
    <div className="row" style={{ marginBottom: 12 }}>{enter("Abrir su oficina", "/oficina", "big")}{enter("Conectar sus aplicaciones", "/conexiones", "ghost")}<Link className="btn ghost" href={`/agencia/tarea?cliente=${id}`}>Darle una tarea</Link></div>
    <div className="grid">
      <div className="card"><h2>🛍️ Qué le ofreces</h2>{services.length ? <form action={deployAction}><input type="hidden" name="companyId" value={id} /><label htmlFor="sv">Elige un servicio</label><Help>Se agregarán a su oficina los empleados que lo hacen.</Help><select id="sv" name="serviceId">{services.map((s: any) => <option key={s.id} value={s.id} disabled={deployed.has(s.id)}>{s.name}{deployed.has(s.id) ? " (ya lo tiene)" : ""}</option>)}</select><p><button className="big">Agregar empleados de este servicio</button></p></form> : <EmptyState icon="🛍️" title="Aún no tienes servicios" text="Crea tu lista de lo que ofreces y vuelve aquí." href="/agencia/servicios" cta="Elegir qué ofrezco" />}
        {dep.length > 0 && <><h3>Ya tiene</h3><ul>{dep.map((d: any) => <li key={d.name}>{d.name}</li>)}</ul></>}</div>
      <div className="card"><h2>🧑‍💼 Sus empleados ({emps.length})</h2>{emps.length ? <ul>{emps.map((e: any) => <li key={e.id}>{e.name} {e.status !== "active" && <span className="state warn">⏸ En pausa</span>} {enter("Enseñarle", `/empleados/${e.id}/ensenar`, "ghost")}</li>)}</ul> : <p className="muted">Todavía no tiene empleados. Elige un servicio para agregarlos.</p>}</div>
      <div className="card"><h2>💸 Cuánto puede gastar</h2><form action={clientLimitsAction}><input type="hidden" name="companyId" value={id} /><label htmlFor="bg">Presupuesto del mes en inteligencia artificial (US$)</label><Help>Si se acaba, sus empleados dejan de trabajar hasta el mes siguiente.</Help><input id="bg" type="number" name="budget" defaultValue={Number(c.monthly_budget_usd)} step="0.5" min={0} />
        <details><summary>Más opciones</summary><label>Tareas por hora (máximo)</label><input type="number" name="perHour" defaultValue={c.max_runs_per_hour} min={1} /></details><p><button>Guardar</button></p></form></div>
      <div className="card"><h2>🔑 Quién puede entrar</h2>{users.length ? <ul>{users.map((u: any) => <li key={u.email}>{u.email} <span className="state">{roleLabel(u.role)}</span></li>)}</ul> : <p className="muted">Nadie del cliente tiene acceso todavía.</p>}
        <details><summary>Darle acceso a una persona del cliente</summary><form action={clientUserAction}><input type="hidden" name="companyId" value={id} /><label>Nombre</label><input name="name" required /><label>Correo</label><input name="email" type="email" required /><label>Contraseña inicial</label><Help>Al menos 10 letras o números. Compártela por un medio seguro y pídele que la cambie.</Help><input name="password" type="password" minLength={10} required />
          <label>¿Qué podrá hacer?</label><select name="role"><option value="viewer">Solo ver</option><option value="member">Pedir tareas</option><option value="admin">Administrar</option><option value="owner">Todo (dueño)</option></select><p><button>Dar acceso</button></p></form><p className="muted">Esa persona solo verá la oficina de este cliente.</p></details></div></div></>);
}
