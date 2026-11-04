import Link from "next/link";
import { requireActor, when } from "@/lib/session";
import { EmptyState, Flash } from "@/lib/ui";
import { listRuns } from "@/features/tasks/service";

export const metadata = { title: "Mis resultados" };
const ST: Record<string, [string, string]> = { listo: ["Listo para revisar", "ok"], error: ["No se pudo completar", "bad"], en_proceso: ["En proceso", "warn"] };
export default async function Resultados({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor(); const runs = await listRuns(db, actor);
  return (<><h1>Mis resultados</h1><p className="lead">Todo lo que tus empleados prepararon. Son propuestas: revísalas, edítalas y descárgalas.</p><Flash sp={sp} />
    {runs.length ? <table><thead><tr><th>Resultado</th><th>Empleado</th><th>Estado</th><th>Consumo</th></tr></thead><tbody>{runs.map((r: any) => <tr key={r.id}><td><Link href={`/resultados/${r.id}`}>{r.title}</Link><div className="muted">{when(r.created_at)}{r.edited_at ? " · editado" : ""}</div></td><td>{r.employee_name ?? "—"}</td><td><span className={`state ${ST[r.status]?.[1] ?? ""}`}>{ST[r.status]?.[0] ?? r.status}</span></td><td>{(r.tin + r.tout).toLocaleString("es-MX")} tokens</td></tr>)}</tbody></table>
      : <EmptyState icon="📝" title="Todavía no hay resultados" text="Elige una tarea guiada y tu primer resultado aparecerá aquí." href="/tareas" cta="Ver tareas guiadas" />}</>);
}
