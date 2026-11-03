import { requireActor, when } from "@/lib/session";
import { Flash, EmptyState } from "@/lib/ui";
import { listAutomations } from "@/server/automations";
import { automationAction } from "../../actions";
export default async function Automatizaciones({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const autos = await listAutomations(db, actor); const emps = await db.query("SELECT id,name FROM employees WHERE company_id=$1 AND status='active'", [actor.companyId]);
  return (<><h1>Tareas automáticas</h1><p className="lead">Pídele a un empleado que haga algo solo, cada cierto tiempo o cuando pase algo. Por ejemplo: «cada mañana, prepara el resumen de ventas». Si hay que cambiar algo importante, igual te pedirá permiso.</p><Flash sp={sp} />
    <div className="card"><h2>➕ Nueva tarea automática</h2><form action={automationAction}><label>Nombre</label><input name="name" required />
      <label>¿Cuándo debe hacerlo?</label><select name="type"><option value="interval">Cada cierto tiempo</option><option value="event">Cuando pase algo en particular</option></select>
      <label>Cada cuántos minutos (si es cada cierto tiempo)</label><span className="help">1440 minutos = una vez al día. Mínimo 15.</span><input type="number" name="everyMinutes" defaultValue={1440} min={15} />
      <label>¿Qué debe pasar? (si es cuando pase algo)</label><span className="help">Es una palabra corta, por ejemplo: inventario_bajo.</span><input name="event" />
      <label>Solo si… (opcional)</label><div className="row"><input name="condField" placeholder="stock" style={{ width: 140 }} /><select name="condOp" style={{ width: 90 }}><option value="lt">es menor que</option><option value="gt">es mayor que</option><option value="eq">es igual a</option></select><input name="condValue" style={{ width: 140 }} /></div>
      <label>¿Quién lo hará?</label><select name="employeeId" required>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <label>¿Qué debe hacer?</label><textarea name="instruction" required />
      <div className="row"><div><label>Máximo de veces al día</label><input type="number" name="maxRunsPerDay" defaultValue={5} min={1} /></div><div><label>Si falla, volver a intentar (veces)</label><input type="number" name="maxRetries" defaultValue={1} min={0} max={3} /></div></div>
      <p><button className="big" disabled={!emps.length}>Crear tarea automática</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>🔁 Mis tareas automáticas</h2>{autos.length ? autos.map((a: any) => <div key={a.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}><b>{a.name}</b> <span className={`chip ${a.enabled ? "ok" : ""}`}>{a.enabled ? "✅ Activa" : "⏸ En pausa"}</span><div className="muted">{a.trigger.type === "interval" ? `cada ${a.trigger.everyMinutes} min · próxima ${when(a.next_run_at)}` : `evento ${a.trigger.event}`} · {a.employee_name}</div>
      <form className="inline" action={automationAction}><input type="hidden" name="op" value="toggle" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="enabled" value={String(!a.enabled)} /><button className="ghost">{a.enabled ? "Poner en pausa" : "Activar"}</button></form>
      {a.runs.length > 0 && <details><summary>Ver cuándo se hizo ({a.runs.length})</summary><table><tbody>{a.runs.map((r: any, i: number) => <tr key={i}><td>{when(r.created_at)}</td><td>{r.status} (intento {r.attempt})</td><td className="bad">{r.error}</td></tr>)}</tbody></table></details>}</div>) : <EmptyState icon="🔁" title="Aún no tienes tareas automáticas" text="Crea la primera: por ejemplo, un resumen diario de lo que pasó en tu oficina." />}</div></>);
}
