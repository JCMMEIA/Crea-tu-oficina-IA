import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency, money } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { listServices } from "@/server/agency";
import { enterClientAction, deployAction, clientLimitsAction, clientUserAction } from "../../../../agency_actions";
export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, agency } = await requireAgency();
  const c = (await db.query("SELECT * FROM companies WHERE id=$1 AND agency_id=$2", [id, agency.agencyId]))[0]; if (!c) notFound(); // otra agencia = no existe
  const services = await listServices(db, agency);
  const dep = await db.query("SELECT s.name, cs.created_at FROM client_services cs JOIN agency_services s ON s.id=cs.service_id WHERE cs.company_id=$1 AND cs.agency_id=$2", [id, agency.agencyId]);
  const deployed = new Set((await db.query("SELECT service_id FROM client_services WHERE company_id=$1", [id])).map((r) => r.service_id));
  const emps = await db.query("SELECT id,name,role_title,status FROM employees WHERE company_id=$1 ORDER BY created_at", [id]);
  const users = await db.query("SELECT u.email, m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1", [id]);
  const spend = Number((await db.query<{ s: string }>("SELECT coalesce(sum(cost_usd),0) s FROM usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now())", [id]))[0].s);
  return (<><p><Link href="/agencia/clientes">← Clientes</Link></p><h1>{c.name}</h1><p className="muted">{c.industry || "Sin industria"} · costo de IA del mes {money(spend)} de US$ {Number(c.monthly_budget_usd).toFixed(2)}</p><Flash sp={sp} />
    <form action={enterClientAction} className="row"><input type="hidden" name="companyId" value={id} /><button>Entrar a su oficina</button><button className="ghost" name="to" value="construir">Contratar agentes sueltos</button></form>
    <div className="grid" style={{ marginTop: 12 }}>
      <div className="card"><h2>Desplegar un servicio</h2>{services.length ? <form action={deployAction}><input type="hidden" name="companyId" value={id} /><select name="serviceId">{services.map((s: any) => <option key={s.id} value={s.id} disabled={deployed.has(s.id)}>{s.name}{deployed.has(s.id) ? " (ya desplegado)" : ""}</option>)}</select><p><button>Contratar sus agentes en esta oficina</button></p></form> : <p className="muted">Primero crea servicios en el <Link href="/agencia/servicios">catálogo</Link>.</p>}
        <h3>Servicios desplegados</h3>{dep.length ? <ul>{dep.map((d: any) => <li key={d.name}>{d.name}</li>)}</ul> : <p className="muted">Ninguno todavía.</p>}</div>
      <div className="card"><h2>Empleados de IA ({emps.length})</h2>{emps.length ? <ul>{emps.map((e: any) => <li key={e.id}><Link href="#" aria-disabled>{e.name}</Link> <span className="muted">{e.role_title} · {e.status}</span></li>)}</ul> : <p className="muted">Sin empleados.</p>}<p className="muted">Para personalizar o asignar tareas, entra a su oficina.</p></div>
      <div className="card"><h2>Límites de consumo</h2><form action={clientLimitsAction}><input type="hidden" name="companyId" value={id} /><label>Presupuesto mensual (US$)</label><input type="number" name="budget" defaultValue={Number(c.monthly_budget_usd)} step="0.5" min={0} /><label>Ejecuciones por hora</label><input type="number" name="perHour" defaultValue={c.max_runs_per_hour} min={1} /><p><button>Guardar límites</button></p></form></div>
      <div className="card"><h2>Acceso del cliente</h2>{users.length ? <ul>{users.map((u: any) => <li key={u.email}>{u.email} <span className="chip">{u.role}</span></li>)}</ul> : <p className="muted">Sin usuarios del cliente.</p>}
        <details><summary>Crear usuario del cliente</summary><form action={clientUserAction}><input type="hidden" name="companyId" value={id} /><label>Nombre</label><input name="name" required /><label>Correo</label><input name="email" type="email" required /><label>Contraseña inicial (10+)</label><input name="password" type="password" minLength={10} required /><label>Rol</label><select name="role"><option value="viewer">Solo lectura</option><option value="member">Miembro (asigna tareas)</option><option value="admin">Administrador</option><option value="owner">Propietario</option></select><p><button>Crear usuario</button></p></form><p className="muted">El cliente solo verá su propia empresa.</p></details></div></div></>);
}
