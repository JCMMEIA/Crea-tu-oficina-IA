import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { BEGINNER_QUESTIONS, exportSkill, getCurrentSkill, listVersions, getVersion, diffSpecs } from "@/server/skills";
import { skillImportAction, skillRestoreAction, skillSaveAction } from "../../../../actions";

export default async function SkillEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string; modo?: string; cmp?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const e = (await db.query("SELECT name FROM employees WHERE id=$1 AND company_id=$2", [id, actor.companyId]))[0]; if (!e) notFound();
  const { spec, version } = await getCurrentSkill(db, actor, id);
  const versions = await listVersions(db, actor, id);
  const exp = await exportSkill(db, actor, id);
  const cmp = sp.cmp ? diffSpecs(await getVersion(db, actor, id, Number(sp.cmp)), spec) : null;
  const adv = sp.modo === "avanzado"; const L = (a: string[]) => a.join("\n");
  const area = (k: string, label: string, v: string, rows = 4) => <div><label htmlFor={k}>{label}</label><textarea id={k} name={k} rows={rows} defaultValue={v} /></div>;
  return (<><p><Link href={`/empleados/${id}`}>← {e.name}</Link></p><h1>Skill de {e.name}</h1><p className="muted">Versión activa: v{version}. Tus cambios son solo de tu empresa; la plantilla original no se modifica.</p><Flash sp={sp} />
    <p className="steps"><Link className={!adv ? "on" : ""} href={`/empleados/${id}/skill`}>Modo principiante</Link><Link className={adv ? "on" : ""} href={`/empleados/${id}/skill?modo=avanzado`}>Modo avanzado</Link></p>
    {!adv ? <form action={skillSaveAction} className="card"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value="beginner" />
      <h2>Cuéntanos de tu negocio</h2>{BEGINNER_QUESTIONS.map((q) => <div key={q.key}><label htmlFor={q.key}>{q.label}</label><textarea id={q.key} name={q.key} rows={2} /></div>)}
      <label>Nota de la versión</label><input name="note" /><p><button>Convertir en instrucciones y guardar</button></p></form>
    : <form action={skillSaveAction} className="card"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value="advanced" />
      {area("systemPrompt", "Instrucciones del sistema", spec.systemPrompt, 10)}{area("procedures", "Procedimientos operativos (uno por línea)", L(spec.procedures))}{area("authorizedTools", "Herramientas autorizadas (claves, una por línea)", L(spec.authorizedTools), 3)}
      {area("knowledgeSources", "Fuentes de conocimiento", L(spec.knowledgeSources), 3)}{area("outputFormat", "Formato de respuesta", spec.outputFormat, 3)}{area("goals", "Objetivos", L(spec.goals), 3)}{area("metrics", "Métricas", L(spec.metrics), 3)}
      {area("actionConditions", "Condiciones para ejecutar acciones", L(spec.actionConditions), 3)}{area("collaborationRules", "Reglas de colaboración", L(spec.collaborationRules), 3)}
      <label><input type="checkbox" name="requireApproval" defaultChecked={spec.autonomy.requireApprovalForWrites} style={{ width: "auto" }} /> Toda acción que modifique datos requiere mi aprobación</label>
      <label>Tiempo máximo por tarea (segundos)</label><input type="number" name="maxTaskSeconds" min={5} max={300} defaultValue={spec.autonomy.maxTaskSeconds} />
      <label>Nota de la versión</label><input name="note" /><p><button>Guardar nueva versión</button></p></form>}
    <div className="grid" style={{ marginTop: 12 }}>
      <div className="card"><h2>Versiones</h2><table><tbody>{versions.map((v: any) => (<tr key={v.version}><td>v{v.version}{v.version === version && <span className="chip ok">activa</span>}<div className="muted">{v.note} · {when(v.created_at)}</div></td><td className="row">
        <Link className="chip" href={`/empleados/${id}/skill?cmp=${v.version}`}>Comparar</Link>
        {v.version !== version && <form className="inline" action={skillRestoreAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={v.version} /><button className="ghost">Restaurar</button></form>}</td></tr>))}</tbody></table>
        {cmp && <><h3>Cambios entre v{sp.cmp} y la activa</h3>{cmp.length ? cmp.map((d) => <details key={d.field} open><summary>{d.field}</summary><pre>- {JSON.stringify(d.before, null, 1)}{"\n"}+ {JSON.stringify(d.after, null, 1)}</pre></details>) : <p className="muted">Sin diferencias.</p>}</>}</div>
      <div className="card"><h2>Importar / exportar</h2><label>Exportar (copia este JSON)</label><textarea readOnly rows={6} defaultValue={exp} />
        <form action={skillImportAction}><input type="hidden" name="id" value={id} /><label>Importar configuración</label><textarea name="json" rows={4} placeholder="Pega aquí un JSON exportado" /><p><button className="ghost">Importar como nueva versión</button></p></form></div></div>
    <p className="muted">«Probar instrucciones»: asigna una tarea de prueba al empleado desde su ficha y compara el resultado entre versiones en Actividad (cada tarea guarda la versión de skill usada).</p></>);
}
