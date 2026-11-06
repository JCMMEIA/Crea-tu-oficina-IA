import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, money, when } from "@/lib/session";
import { Flash, StatusChip, Tip } from "@/lib/ui";
import { friendlyError } from "@/lib/lang";
import { getTask } from "@/server/tasks";
import { retryTaskAction } from "../../../actions";

export const metadata = { title: "Seguimiento de la tarea" };
const KIND: Record<string, string> = { requested: "📝 Se pidió la tarea", started: "⏳ El empleado empezó a trabajar", completed: "✅ Terminó", failed: "⚠️ No pudo terminar", not_configured: "🔧 Falta activar algo", approval_requested: "✋ Pidió tu permiso", approval_rejected: "🚫 Rechazaste el permiso", tool_executed: "✅ Hizo el cambio (con tu permiso)", tool_failed: "⚠️ No se pudo hacer el cambio", tool_blocked: "🔒 Intentó algo que no tiene permitido", delegated: "🤝 Le pidió ayuda a otro empleado", retry_requested: "🔁 Se volvió a intentar", github_sources: "📚 Consultó documentación de GitHub (fuentes abajo)", limit_budget: "💸 Se acabó el presupuesto", limit_rate_company: "⏱ Demasiadas tareas seguidas", limit_rate_employee: "⏱ Ya trabajó lo máximo de hoy", limit_agency_budget: "💸 Se acabó el presupuesto de la agencia" };
const STAGES = [["requested", "Pedida"], ["in_progress", "Trabajando"], ["awaiting_approval", "Tu permiso"], ["completed", "Lista"]] as const;
export default async function Tarea({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const g = await getTask(db, actor, id); if (!g) notFound(); const { task: t, events } = g;
  const idx = t.status === "completed" ? 3 : t.status === "awaiting_approval" ? 2 : t.status === "in_progress" ? 1 : 0;
  return (<><p><Link href="/actividad">← Historial de trabajo</Link></p><h1>{t.title}</h1><Flash sp={sp} />
    <p className="row"><StatusChip s={t.status} /><span className="muted">{t.employee_name} · costo estimado {money(Number(t.cost_usd))}</span></p>
    {["failed", "rejected"].includes(t.status) ? null : <div className="steps-bar" role="list" aria-label="Seguimiento">{STAGES.map(([k, l], i) => <div key={k} role="listitem" className={`s ${i < idx ? "done" : i === idx ? "on" : ""}`}>{i < idx ? "✓ " : ""}{l}</div>)}</div>}
    <div className="card"><h2>📝 Lo que pediste</h2><p style={{ whiteSpace: "pre-wrap" }}>{t.instruction}</p>{t.context && <details><summary>Información que recibió de otro empleado</summary><pre>{t.context}</pre></details>}</div>
    {t.result && <div className="card" style={{ marginTop: 12 }}><h2>🧑‍💼 Lo que entregó {t.employee_name}</h2><pre>{t.result}</pre><p className="muted">Solo cuenta como «hecho» lo que aparece abajo en el paso a paso con ✅. Lo demás es una propuesta.</p></div>}
    {t.error && <div className="notice bad"><b>😕 No salió como esperábamos.</b> {friendlyError(t.error)}{t.status === "failed" && <form action={retryTaskAction}><input type="hidden" name="id" value={id} /><p><button className="big">Volver a intentar</button></p></form>}</div>}
    {t.status === "awaiting_approval" && <div className="hero-card"><h2>✋ Esta tarea espera tu permiso</h2><p>El empleado quiere hacer un cambio y no lo hará sin tu sí.</p><Link className="btn big" href="/aprobaciones">Revisar y decidir</Link></div>}
    <div className="card" style={{ marginTop: 12 }}><h2>🧭 Paso a paso</h2><table><tbody>{events.map((e: any, i: number) => <tr key={i}><td>{when(e.created_at)}</td><td>{KIND[e.kind] ?? "• " + e.kind}{e.kind === "github_sources" && <ul data-testid="github-sources">{(e.detail.sources ?? []).map((x: any) => <li key={x.repo + x.path}>{x.repo} / {x.path} · revisión {String(x.revision).slice(0, 7)}</li>)}</ul>}{Object.keys(e.detail).length > 0 && <details><summary>Ver detalle técnico</summary><pre>{JSON.stringify(e.detail, null, 1)}</pre></details>}</td></tr>)}</tbody></table></div>
    <Tip>¿Quieres que este empleado lo haga mejor la próxima vez? Entra a su ficha y pulsa «Enseñarle».</Tip></>);
}
