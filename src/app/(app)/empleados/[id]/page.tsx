import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, money, when } from "@/lib/session";
import { Flash, StatusChip, Empty } from "@/lib/ui";
import { getCurrentSkill } from "@/server/skills";
import { assignTaskAction, employeeOpAction, permissionsAction } from "../../../actions";
import { TOOLKITS, getToolkit } from "@/server/connectors/catalog";

export default async function Empleado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const e = (await db.query("SELECT * FROM employees WHERE id=$1 AND company_id=$2", [id, actor.companyId]))[0]; if (!e) notFound();
  const sk = await getCurrentSkill(db, actor, id);
  const tasks = await db.query("SELECT id,title,status,created_at,cost_usd::float c FROM tasks WHERE employee_id=$1 AND company_id=$2 ORDER BY created_at DESC LIMIT 10", [id, actor.companyId]);
  const conns = await db.query("SELECT toolkit FROM connections WHERE company_id=$1 AND status='conectado'", [actor.companyId]);
  const connected = new Set(conns.map((c) => c.toolkit as string));
  const toolkits = [...new Set([...sk.spec.authorizedTools, ...Object.keys(e.permissions)])];
  const op = (o: string, label: string, cls = "ghost") => <form className="inline" action={employeeOpAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={o} /><button className={cls}>{label}</button></form>;
  return (<><p><Link href="/departamentos">← Departamentos</Link></p><h1>{e.name}</h1><p className="muted">{e.role_title} · {e.description}</p><Flash sp={sp} />
    <p className="row"><span className={`chip ${e.status === "active" ? "ok" : "warn"}`}>{e.status === "active" ? "Activo" : "En pausa"}</span><span className="chip">skill v{e.current_skill_version}</span>
      <Link className="btn ghost" href={`/empleados/${id}/skill`}>Editar instrucciones y skill</Link>
      {op("duplicate", "Duplicar")}{e.status === "active" ? op("pause", "Pausar") : op("activate", "Reactivar")}{op("delete", "Eliminar", "danger")}</p>
    <div className="card"><h2>Asignar una tarea</h2>
      <form action={assignTaskAction}><input type="hidden" name="employeeId" value={id} /><label htmlFor="ins">¿Qué necesitas?</label><textarea id="ins" name="instruction" required placeholder="Describe el trabajo con el contexto necesario." />
        <p><button disabled={e.status !== "active"}>Asignar y ejecutar</button> <span className="muted">Es una ejecución real con IA y puede tardar hasta {sk.spec.autonomy.maxTaskSeconds} s.</span></p></form></div>
    <div className="grid" style={{ marginTop: 12 }}>
      <div className="card"><h2>Herramientas y permisos</h2>
        <form action={permissionsAction}><input type="hidden" name="id" value={id} />
          {toolkits.length ? toolkits.map((t) => (<div key={t}><label>{getToolkit(t)?.label ?? t} {connected.has(t) ? <span className="chip ok">conectada</span> : <span className="chip warn">sin conectar</span>}</label>
            <select name={`perm_${t}`} defaultValue={e.permissions[t] ?? "none"}><option value="none">Sin acceso</option><option value="read">Lectura (puede proponer cambios que tú apruebas)</option><option value="write">Escritura (ejecuta sin preguntar solo si la skill lo permite)</option></select></div>)) : <p className="muted">Este empleado no usa aplicaciones.</p>}
          <label>Límite de salida por tarea (tokens)</label><input type="number" name="maxOutputTokens" defaultValue={e.max_output_tokens} min={100} max={8000} />
          <label>Máximo de ejecuciones al día</label><input type="number" name="maxRunsPerDay" defaultValue={e.max_runs_per_day} min={1} max={500} />
          <p><button>Guardar permisos</button></p></form>
        <p className="muted">Agrega más herramientas en la skill (modo avanzado → herramientas autorizadas). Disponibles: {TOOLKITS.filter((t) => t.tools.length).map((t) => t.key).join(", ")}.</p></div>
      <div className="card"><h2>Resultados y actividad</h2>{tasks.length ? <table><tbody>{tasks.map((t) => <tr key={t.id}><td><Link href={`/actividad/${t.id}`}>{t.title}</Link><div className="muted">{when(t.created_at)} · {money(t.c)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <Empty>Sin tareas todavía.</Empty>}</div></div></>);
}
