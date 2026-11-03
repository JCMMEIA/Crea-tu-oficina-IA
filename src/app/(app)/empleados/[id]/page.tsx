import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, money, when } from "@/lib/session";
import { Flash, StatusChip, EmptyState, Help, Tip } from "@/lib/ui";
import { getCurrentSkill } from "@/server/skills";
import { assignTaskAction, employeeOpAction, permissionsAction } from "../../../actions";
import { getToolkit } from "@/server/connectors/catalog";
import { practiceExample } from "@/server/guide/practice";
import { Toast } from "@/lib/guide";

export const metadata = { title: "Mi empleado" };
const PERM = [["none", "No puede usarla"], ["read", "Mirar y proponer (tú apruebas cada cambio)"], ["write", "Puede actuar si tú lo permitiste al enseñarle"]] as const;
export default async function Empleado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const e = (await db.query("SELECT * FROM employees WHERE id=$1 AND company_id=$2", [id, actor.companyId]))[0]; if (!e) notFound();
  const sk = await getCurrentSkill(db, actor, id);
  const tasks = await db.query("SELECT id,title,status,created_at,cost_usd::float c FROM tasks WHERE employee_id=$1 AND company_id=$2 ORDER BY created_at DESC LIMIT 6", [id, actor.companyId]);
  const connected = new Set((await db.query("SELECT toolkit FROM connections WHERE company_id=$1 AND status='conectado'", [actor.companyId])).map((c) => c.toolkit as string));
  const toolkits = [...new Set([...sk.spec.authorizedTools, ...Object.keys(e.permissions)])];
  const ex = practiceExample(e.template_key ?? "");
  const op = (o: string, label: string, cls = "ghost") => <form className="inline" action={employeeOpAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={o} /><button className={cls}>{label}</button></form>;
  return (<><p><Link href="/departamentos">← Mis empleados</Link></p>{sp.ok && <Toast message={sp.ok} />}<h1>🧑‍💼 {e.name}</h1><p className="lead">{e.role_title} · {e.description}</p><Flash sp={{ error: sp.error }} />
    <p><span className={`state ${e.status === "active" ? "ok" : "warn"}`}>{e.status === "active" ? "✅ Listo para trabajar" : "⏸ En pausa"}</span> <span className="state">Enseñanza n.º {e.current_skill_version}</span></p>
    <div className="actions"><a className="action" href="#tarea"><span className="ic" aria-hidden="true">📝</span><b>Darle una tarea</b><span className="t">Pídele un trabajo ahora.</span></a>
      <Link className="action" href={`/empleados/${id}/ensenar`} data-testid="teach-link"><span className="ic" aria-hidden="true">🎓</span><b>Enseñarle</b><span className="t">Cuéntale cómo quieres que trabaje.</span></Link>
      <Link className="action" href="/actividad"><span className="ic" aria-hidden="true">📋</span><b>Ver su historial</b><span className="t">Todo lo que ha hecho.</span></Link></div>
    <div className="card" id="tarea"><h2>📝 Darle una tarea</h2><form action={assignTaskAction}><input type="hidden" name="employeeId" value={id} /><label htmlFor="ins">¿Qué necesitas?</label><Help>Escríbelo como se lo dirías a una persona.</Help>
      <textarea id="ins" name="instruction" required rows={3} placeholder={`Ejemplo: ${ex.pedido.replace(" para Café Luna", "")}`} data-testid="emp-task-text" />
      <p><button className="big" disabled={e.status !== "active"} data-testid="emp-task-send">Pedir tarea</button></p></form>
      <p className="muted">Puede tardar hasta {sk.spec.autonomy.maxTaskSeconds} segundos. Si hay que cambiar algo importante, te pedirá permiso.</p></div>
    <div className="card" style={{ marginTop: 12 }}><h2>📋 Trabajo reciente</h2>{tasks.length ? <table><tbody>{tasks.map((t) => <tr key={t.id}><td><Link href={`/actividad/${t.id}`}>{t.title}</Link><div className="muted">{when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <EmptyState icon="🌱" title="Todavía no ha trabajado" text="Pídele su primera tarea: verás aquí cómo le fue." />}</div>
    <details className="card" style={{ marginTop: 12 }}><summary><b>🔧 Más opciones</b></summary>
      <h3>Qué puede hacer con tus aplicaciones</h3>{toolkits.length ? <form action={permissionsAction}><input type="hidden" name="id" value={id} />{toolkits.map((t) => <div key={t}><label>{getToolkit(t)?.label ?? t} {connected.has(t) ? <span className="state ok">✅ Conectada</span> : <span className="state warn">🔌 Sin conectar</span>}</label>
        <select name={`perm_${t}`} defaultValue={e.permissions[t] ?? "none"}>{PERM.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>)}
        <label>Cuánto puede escribir en cada respuesta</label><input type="number" name="maxOutputTokens" defaultValue={e.max_output_tokens} min={100} max={8000} /><Help>Un número más alto permite respuestas más largas (y gasta más).</Help>
        <label>Máximo de tareas al día</label><input type="number" name="maxRunsPerDay" defaultValue={e.max_runs_per_day} min={1} max={500} /><p><button>Guardar</button></p></form> : <p className="muted">Este empleado no usa aplicaciones.</p>}
      <div className="row">{op("duplicate", "Hacer una copia")}{e.status === "active" ? op("pause", "Poner en pausa") : op("activate", "Volver a activar")}<Link className="btn ghost" href={`/empleados/${id}/skill?modo=avanzado`}>Modo experto</Link></div>
      <form action={employeeOpAction} className="card" style={{ marginTop: 12, borderColor: "var(--bad)" }}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="delete" /><h3>Eliminar a este empleado</h3><p className="muted">Se borra también lo que le enseñaste. No se puede deshacer.</p>
        <label style={{ fontWeight: 400 }}><input type="checkbox" name="confirm" style={{ width: "auto" }} required /> Sí, quiero eliminarlo.</label><button className="danger">Eliminar</button></form></details></>);
}
