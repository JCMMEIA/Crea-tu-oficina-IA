import Link from "next/link";
import { requireActor, money, when } from "@/lib/session";
import { StatusChip, EmptyState } from "@/lib/ui";
import { listTasks } from "@/server/tasks";
import { AutoRefresh } from "@/components/Working";
export default async function Actividad() {
  const { db, actor } = await requireActor(); const tasks = await listTasks(db, actor);
  const groups: [string, string[]][] = [["✋ Esperan tu permiso", ["awaiting_approval"]], ["⏳ En marcha", ["in_progress", "requested"]], ["✅ Listos", ["completed"]], ["⚠️ No salieron", ["failed", "rejected"]]];
  return (<><h1>Historial de trabajo</h1><p className="lead">Todo lo que han hecho tus empleados, del más reciente al más antiguo. Solo aparece trabajo que de verdad se pidió.</p><AutoRefresh active={tasks.some((x) => x.status === "in_progress")} />
    {!tasks.length && <EmptyState icon="🌱" title="Aún no hay trabajo" text="Cuando le pidas una tarea a un empleado, aquí verás cómo va y qué entregó." href="/departamentos" cta="Pedir mi primera tarea" />}
    {groups.map(([l, st]) => { const t = tasks.filter((x) => st.includes(x.status)); return t.length ? <section className="card" key={l} style={{ marginBottom: 12 }}><h2>{l} ({t.length})</h2><table><tbody>{t.map((x) => <tr key={x.id}><td><Link href={`/actividad/${x.id}`}>{x.depth ? "↳ " : ""}{x.title}</Link><div className="muted">{x.employee_name} · {when(x.created_at)}</div></td><td><StatusChip s={x.status} /></td><td>{money(x.cost_usd)}</td></tr>)}</tbody></table></section> : null; })}</>);
}
