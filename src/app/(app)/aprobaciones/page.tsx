import Link from "next/link";
import { requireActor, when } from "@/lib/session";
import { Flash, EmptyState } from "@/lib/ui";
import { listApprovals } from "@/server/tasks";
import { approvalAction } from "../../actions";
import { can } from "@/server/auth";
export default async function Aprobaciones({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const pending = await listApprovals(db, actor, "pending"); const done = (await listApprovals(db, actor, "approved")).concat(await listApprovals(db, actor, "rejected")).slice(0, 15);
  return (<><h1>Por aprobar</h1><p className="lead">Tus empleados te piden permiso antes de cambiar algo importante. Aquí decides.</p><Flash sp={sp} />
    {!pending.length ? <EmptyState icon="🎉" title="No hay nada esperando tu permiso" text="Cuando un empleado quiera publicar, enviar un mensaje o cambiar un precio, te lo preguntará aquí antes de hacerlo." /> :
      pending.map((a) => (<div className="card" key={a.id} style={{ marginBottom: 12 }}><h3>{a.summary}</h3><p className="muted">{when(a.created_at)} · <Link href={`/actividad/${a.task_id}`}>ver tarea</Link></p><details><summary>Ver los datos del cambio</summary><pre>{JSON.stringify(a.args, null, 1)}</pre></details>
        {can(actor, "approvals:decide") ? <div className="row"><form action={approvalAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="approve" /><button>✅ Sí, hazlo</button></form>
          <form action={approvalAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="reject" /><button className="ghost">🚫 No, cancelar</button></form></div> : <p className="muted">Solo el dueño o un administrador puede decidir esto.</p>}</div>))}
    {done.length > 0 && <div className="card"><h2>Decisiones anteriores</h2><table><tbody>{done.map((a) => <tr key={a.id}><td>{a.summary}<div className="muted">{a.decided_by} · {when(a.decided_at)}</div></td><td><span className={`chip ${a.status === "approved" ? "ok" : "bad"}`}>{a.status === "approved" ? "✅ Dijiste que sí" : "🚫 Dijiste que no"}</span>{a.evidence && <details><summary>Ver qué pasó exactamente</summary><pre>{JSON.stringify(a.evidence, null, 1)}</pre></details>}</td></tr>)}</tbody></table></div>}</>);
}
