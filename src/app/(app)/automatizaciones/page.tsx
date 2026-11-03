import { requireActor, when } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { listAutomations } from "@/server/automations";
import { automationAction } from "../../actions";
export default async function Automatizaciones({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const autos = await listAutomations(db, actor); const emps = await db.query("SELECT id,name FROM employees WHERE company_id=$1 AND status='active'", [actor.companyId]);
  return (<><h1>Automatizaciones</h1><p className="muted">CUANDO ocurra X → un empleado hace Y. Cada ejecución crea una tarea real con límites, reintentos y aprobaciones. Los disparos por tiempo los ejecuta un programador externo (<code>npm run automations:tick</code>).</p><Flash sp={sp} />
    <div className="card"><h2>Nueva automatización</h2><form action={automationAction}><label>Nombre</label><input name="name" required />
      <label>Cuándo</label><select name="type"><option value="interval">Cada cierto tiempo</option><option value="event">Cuando ocurra un evento</option></select>
      <label>Cada cuántos minutos (si es por tiempo; mínimo 15)</label><input type="number" name="everyMinutes" defaultValue={1440} min={15} />
      <label>Nombre del evento (si es por evento, p. ej. inventory_low)</label><input name="event" />
      <label>Condición opcional (campo / operador / valor)</label><div className="row"><input name="condField" placeholder="stock" style={{ width: 140 }} /><select name="condOp" style={{ width: 90 }}><option value="lt">menor que</option><option value="gt">mayor que</option><option value="eq">igual a</option></select><input name="condValue" style={{ width: 140 }} /></div>
      <label>Empleado responsable</label><select name="employeeId" required>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <label>Qué debe hacer</label><textarea name="instruction" required />
      <div className="row"><div><label>Máx. ejecuciones/día</label><input type="number" name="maxRunsPerDay" defaultValue={5} min={1} /></div><div><label>Reintentos</label><input type="number" name="maxRetries" defaultValue={1} min={0} max={3} /></div></div>
      <p><button disabled={!emps.length}>Crear</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Mis automatizaciones</h2>{autos.length ? autos.map((a: any) => <div key={a.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}><b>{a.name}</b> <span className={`chip ${a.enabled ? "ok" : ""}`}>{a.enabled ? "activa" : "pausada"}</span><div className="muted">{a.trigger.type === "interval" ? `cada ${a.trigger.everyMinutes} min · próxima ${when(a.next_run_at)}` : `evento ${a.trigger.event}`} · {a.employee_name}</div>
      <form className="inline" action={automationAction}><input type="hidden" name="op" value="toggle" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="enabled" value={String(!a.enabled)} /><button className="ghost">{a.enabled ? "Pausar" : "Activar"}</button></form>
      {a.runs.length > 0 && <details><summary>Historial ({a.runs.length})</summary><table><tbody>{a.runs.map((r: any, i: number) => <tr key={i}><td>{when(r.created_at)}</td><td>{r.status} (intento {r.attempt})</td><td className="bad">{r.error}</td></tr>)}</tbody></table></details>}</div>) : <Empty>Aún no tienes automatizaciones.</Empty>}</div></>);
}
