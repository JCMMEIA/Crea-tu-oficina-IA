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
  return (<><p><Link href={`/empleados/${id}`}>← {e.name}</Link></p><h1>Modo experto: {e.name}</h1><p className="lead">Para quien quiere controlar cada detalle. Si prefieres lo fácil, <Link href={`/empleados/${id}/ensenar`}>enséñale con preguntas sencillas</Link>. Estás en la enseñanza n.º {version}; cada cambio guarda una versión nueva y puedes volver atrás.</p><Flash sp={sp} />
    <p className="steps"><Link className={!adv ? "on" : ""} href={`/empleados/${id}/skill`}>Preguntas sencillas</Link><Link className={adv ? "on" : ""} href={`/empleados/${id}/skill?modo=avanzado`}>Instrucciones completas</Link></p>
    {!adv ? <form action={skillSaveAction} className="card"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value="beginner" />
      <h2>Cuéntanos de tu negocio</h2>{BEGINNER_QUESTIONS.map((q) => <div key={q.key}><label htmlFor={q.key}>{q.label}</label><textarea id={q.key} name={q.key} rows={2} /></div>)}
      <label>Nota de la versión</label><input name="note" /><p><button>Guardar lo que le enseñé</button></p></form>
    : <form action={skillSaveAction} className="card"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value="advanced" />
      {area("systemPrompt", "Instrucciones completas", spec.systemPrompt, 10)}{area("procedures", "Pasos que sigue (uno por línea)", L(spec.procedures))}{area("authorizedTools", "Aplicaciones que puede usar (una por línea)", L(spec.authorizedTools), 3)}
      {area("knowledgeSources", "Dónde consulta información", L(spec.knowledgeSources), 3)}{area("outputFormat", "Cómo entrega el trabajo", spec.outputFormat, 3)}{area("goals", "Objetivos", L(spec.goals), 3)}{area("metrics", "Métricas", L(spec.metrics), 3)}
      {area("actionConditions", "Cuándo puede actuar", L(spec.actionConditions), 3)}{area("collaborationRules", "Cómo trabaja con otros empleados", L(spec.collaborationRules), 3)}
      <label><input type="checkbox" name="requireApproval" defaultChecked={spec.autonomy.requireApprovalForWrites} style={{ width: "auto" }} /> Siempre debe pedirme permiso antes de cambiar algo</label>
      <label>Tiempo máximo por tarea (segundos)</label><input type="number" name="maxTaskSeconds" min={5} max={300} defaultValue={spec.autonomy.maxTaskSeconds} />
      <label>Nota de la versión</label><input name="note" /><p><button>Guardar</button></p></form>}
    <div className="grid" style={{ marginTop: 12 }}>
      <div className="card"><h2>Versiones anteriores</h2><table><tbody>{versions.map((v: any) => (<tr key={v.version}><td>v{v.version}{v.version === version && <span className="chip ok">activa</span>}<div className="muted">{v.note} · {when(v.created_at)}</div></td><td className="row">
        <Link className="chip" href={`/empleados/${id}/skill?cmp=${v.version}`}>Ver cambios</Link>
        {v.version !== version && <form className="inline" action={skillRestoreAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={v.version} /><button className="ghost">Volver a esta versión</button></form>}</td></tr>))}</tbody></table>
        {cmp && <><h3>Cambios entre v{sp.cmp} y la activa</h3>{cmp.length ? cmp.map((d) => <details key={d.field} open><summary>{d.field}</summary><pre>- {JSON.stringify(d.before, null, 1)}{"\n"}+ {JSON.stringify(d.after, null, 1)}</pre></details>) : <p className="muted">Sin diferencias.</p>}</>}</div>
      <div className="card"><h2>Copia de seguridad</h2><label>Copia (guárdala o pásala a otro empleado)</label><textarea readOnly rows={6} defaultValue={exp} />
        <form action={skillImportAction}><input type="hidden" name="id" value={id} /><label>Pegar una copia</label><textarea name="json" rows={4} placeholder="Pega aquí un JSON exportado" /><p><button className="ghost">Usar esta copia</button></p></form></div></div>
    <p className="muted">Para probar un cambio, pídele una tarea desde su ficha y mira el resultado en el historial de trabajo.</p></>);
}
