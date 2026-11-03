import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash, EmptyState, Help } from "@/lib/ui";
import { listOffice } from "@/server/catalog/office";
import { customEmployeeAction } from "../../actions";

export const metadata = { title: "Mis empleados" };
export default async function Departamentos({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor(); const office = await listOffice(db, actor); const total = office.reduce((n, d) => n + d.employees.length, 0);
  return (<><h1>Mis empleados</h1><p className="lead">Tus empleados de inteligencia artificial, ordenados por área. Toca uno para pedirle trabajo o enseñarle.</p><Flash sp={sp} />
    <p><Link className="btn big" href="/agregar-empleado" data-testid="add-employee">➕ Agregar empleado</Link></p>
    {!office.length || !total ? <EmptyState icon="🧑‍💼" title="¡Vamos a contratar a tu primer empleado!" text="Elige qué trabajo quieres que haga y te mostramos quién puede hacerlo." href="/agregar-empleado" cta="Elegir empleado" /> :
      office.map((d) => (<section className="card" key={d.id} style={{ marginBottom: 12 }}><h2>{d.name}</h2>
        {d.employees.length ? <div className="grid">{d.employees.map((e: any) => (<Link key={e.id} href={`/empleados/${e.id}`} className="card" style={{ color: "inherit", textDecoration: "none" }} data-testid={`emp-${e.id}`}><h3>🧑‍💼 {e.name}</h3><p className="muted">{e.role_title}</p><span className={`state ${e.status === "active" ? "ok" : "warn"}`}>{e.status === "active" ? "✅ Listo" : "⏸ En pausa"}</span></Link>))}</div> : <p className="muted">Nadie todavía en esta área.</p>}
        <details><summary>Crear un puesto con otro nombre</summary><form action={customEmployeeAction}><input type="hidden" name="departmentId" value={d.id} /><label>Nombre del empleado</label><input name="name" required /><label>¿Cómo se llama su puesto?</label><input name="roleTitle" required /><label>¿Qué hace?</label><Help>Con tus palabras.</Help><textarea name="description" /><p><button>Crear puesto</button></p></form></details></section>))}</>);
}
