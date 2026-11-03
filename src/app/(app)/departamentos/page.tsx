import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { listOffice } from "@/server/catalog/office";
import { customEmployeeAction } from "../../actions";

export default async function Departamentos({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const office = await listOffice(db, actor);
  return (<><h1>Mis departamentos</h1><Flash sp={sp} />
    {!office.length && <Empty>Tu oficina está vacía. <Link href="/construir?paso=2">Elige tus departamentos</Link>.</Empty>}
    {office.map((d) => (<section className="card" key={d.id} style={{ marginBottom: 12 }}><h2>{d.name}</h2>
      {d.employees.length ? <div className="grid">{d.employees.map((e: any) => (<Link key={e.id} href={`/empleados/${e.id}`} className="card" style={{ color: "inherit" }}><h3>{e.name}</h3><p className="muted">{e.role_title}</p><span className={`chip ${e.status === "active" ? "ok" : "warn"}`}>{e.status === "active" ? "Activo" : e.status === "paused" ? "En pausa" : "Inactivo"}</span><span className="chip">skill v{e.current_skill_version}</span></Link>))}</div> : <p className="muted">Sin empleados todavía.</p>}
      <details><summary>Agregar puesto personalizado</summary><form action={customEmployeeAction}><input type="hidden" name="departmentId" value={d.id} />
        <label>Nombre</label><input name="name" required /><label>Puesto</label><input name="roleTitle" required /><label>Qué hace</label><textarea name="description" /><p><button>Crear puesto</button></p></form></details></section>))}</>);
}
