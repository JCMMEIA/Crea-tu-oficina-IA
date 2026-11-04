import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getRun, mdToHtml } from "@/features/tasks/service";
import { getGuided, PROPOSAL_NOTICE } from "@/features/tasks/catalog";
import { brainField } from "@/server/brain";
import { editResultAction } from "../../../tareas_actions";

export const metadata = { title: "Resultado" };
export default async function Resultado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; editar?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const run = await getRun(db, actor, id); if (!run) notFound(); const t = getGuided(run.task_key);
  const text: string = run.result_edited ?? run.result ?? ""; const ctx = run.context_used as { profileFields?: string[]; docs?: { title: string }[] } | null;
  return (<><p><Link href="/resultados">← Mis resultados</Link></p><h1>{run.title}</h1><p className="muted">{run.employee_name} · {when(run.created_at)}{run.edited_at ? " · editado por ti" : ""}</p><Flash sp={sp} />
    {run.status === "error" ? <div className="notice bad" role="alert" data-testid="run-error"><b>No se pudo completar.</b> {run.error}<p className="muted">No se generó ningún resultado y no se hizo nada fuera de la plataforma.</p></div> : <>
      <div className="notice" role="note" data-testid="proposal-notice"><b>Estado: propuesta.</b> {PROPOSAL_NOTICE}</div>
      {run.sections_ok === false && <div className="notice bad" role="alert" data-testid="sections-warning">La IA no incluyó estas secciones pedidas: {(run.sections_missing as string[]).join(", ")}. Revísalo o vuelve a pedirlo.</div>}
      <article className="card" data-testid="result-body" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
      <div className="row" style={{ marginTop: 12, gap: 8 }}><a className="btn" href={`/api/resultados/${id}/descargar?formato=md`} data-testid="dl-md">Descargar (.md)</a><a className="btn ghost" href={`/api/resultados/${id}/descargar?formato=html`} data-testid="dl-html">Descargar para imprimir (.html)</a>
        {sp.editar ? null : <Link className="btn ghost" href={`/resultados/${id}?editar=1`} data-testid="editar">Editar texto</Link>}</div>
      {sp.editar && <form action={editResultAction} className="card" style={{ marginTop: 12 }}><input type="hidden" name="id" value={id} /><label htmlFor="rt">Edita el texto (el original de la IA se conserva)</label><textarea id="rt" name="text" rows={14} defaultValue={text} data-testid="edit-text" /><p className="row" style={{ gap: 8 }}><button className="big" data-testid="edit-save">Guardar cambios</button><Link className="btn ghost" href={`/resultados/${id}`}>Cancelar</Link></p></form>}
      {run.result_edited && <form action={editResultAction} style={{ marginTop: 8 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="restore" /><button className="ghost">Volver al texto original de la IA</button></form>}
      {t && <details className="card" style={{ marginTop: 12 }}><summary><b>Criterios de calidad que se le pidieron</b></summary><p className="muted">Se los pedimos a la IA; la revisión final es tuya.</p><ul>{t.quality.map((c) => <li key={c}>{c}</li>)}</ul></details>}</>}
    <details className="card" style={{ marginTop: 12 }} data-testid="run-context"><summary><b>Qué información usó este empleado y cuánto consumió</b></summary>
      <p><b>Datos de tu negocio enviados:</b> {ctx?.profileFields?.length ? ctx.profileFields.map((k) => brainField(k)?.label ?? k).join(" · ") : "ninguno (tu Cerebro estaba vacío)"}</p>
      <p><b>Documentos usados:</b> {ctx?.docs?.length ? ctx.docs.map((d) => d.title).join(", ") : "ninguno"}</p>
      <p><b>Consumo:</b> {run.input_tokens.toLocaleString("es-MX")} tokens de entrada · {run.output_tokens.toLocaleString("es-MX")} de salida · costo estimado US$ {Number(run.cost_usd).toFixed(4)} · <Link href="/consumo">ver mi consumo</Link></p></details></>);
}
