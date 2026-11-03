import Link from "next/link";
import { requireActor, money, when } from "@/lib/session";
import { StatusChip, Empty } from "@/lib/ui";
import { listTasks } from "@/server/tasks";
export default async function Actividad() {
  const { db, actor } = await requireActor(); const tasks = await listTasks(db, actor);
  const groups: [string, string[]][] = [["Esperando autorización", ["awaiting_approval"]], ["En progreso o solicitado", ["in_progress", "requested"]], ["Completado", ["completed"]], ["Fallido o rechazado", ["failed", "rejected"]]];
  return (<><h1>Actividad empresarial</h1><p className="muted">Solo se muestra trabajo real registrado, en orden cronológico.</p>
    {!tasks.length && <Empty>No hay actividad todavía. Asigna una tarea desde la ficha de un empleado.</Empty>}
    {groups.map(([l, st]) => { const t = tasks.filter((x) => st.includes(x.status)); return t.length ? <section className="card" key={l} style={{ marginBottom: 12 }}><h2>{l} ({t.length})</h2><table><tbody>{t.map((x) => <tr key={x.id}><td><Link href={`/actividad/${x.id}`}>{x.depth ? "↳ " : ""}{x.title}</Link><div className="muted">{x.employee_name} · {when(x.created_at)}</div></td><td><StatusChip s={x.status} /></td><td>{money(x.cost_usd)}</td></tr>)}</tbody></table></section> : null; })}</>);
}
