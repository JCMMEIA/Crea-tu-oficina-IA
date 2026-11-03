import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, money, when } from "@/lib/session";
import { Flash, StatusChip } from "@/lib/ui";
import { getTask } from "@/server/tasks";
import { retryTaskAction } from "../../../actions";
const KIND: Record<string, string> = { requested: "Solicitada", started: "Iniciada", completed: "Completada", failed: "Falló", not_configured: "No configurado", approval_requested: "Autorización solicitada", approval_rejected: "Autorización rechazada", tool_executed: "Acción ejecutada (evidencia de la herramienta)", tool_failed: "La herramienta falló", tool_blocked: "Herramienta bloqueada", delegated: "Delegada a otro empleado", retry_requested: "Reintento solicitado" };
export default async function Tarea({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const g = await getTask(db, actor, id); if (!g) notFound(); const { task: t, events } = g;
  return (<><p><Link href="/actividad">← Actividad</Link></p><h1>{t.title}</h1><Flash sp={sp} />
    <p className="row"><StatusChip s={t.status} /><span className="muted">{t.employee_name} · skill v{t.skill_version ?? "—"} · {t.input_tokens + t.output_tokens} tokens · {money(Number(t.cost_usd))} (estimado)</span></p>
    <div className="card"><h2>Instrucción</h2><pre>{t.instruction}</pre>{t.context && <><h3>Contexto recibido</h3><pre>{t.context}</pre></>}</div>
    {t.result && <div className="card" style={{ marginTop: 12 }}><h2>Resultado del empleado</h2><pre>{t.result}</pre><p className="muted">Lo que el empleado dice haber hecho solo es válido si aparece abajo como «Acción ejecutada».</p></div>}
    {t.error && <div className="notice bad"><b>Error:</b> {t.error}{t.status === "failed" && <form action={retryTaskAction}><input type="hidden" name="id" value={id} /><p><button>Reintentar</button></p></form>}</div>}
    {t.status === "awaiting_approval" && <div className="notice">Esta tarea espera tu decisión en <Link href="/aprobaciones">Aprobaciones</Link>.</div>}
    <div className="card" style={{ marginTop: 12 }}><h2>Registro y evidencia</h2><table><tbody>{events.map((e: any, i: number) => <tr key={i}><td>{when(e.created_at)}</td><td>{KIND[e.kind] ?? e.kind}{Object.keys(e.detail).length > 0 && <details><summary>detalle</summary><pre>{JSON.stringify(e.detail, null, 1)}</pre></details>}</td></tr>)}</tbody></table></div></>);
}
