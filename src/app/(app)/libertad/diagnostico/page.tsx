import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { QBY, STAGES } from "@/features/libertad/cuestionario";
import { getPlan, stateOf } from "@/server/libertad/service";
import { libertadAnswerAction, libertadBackAction, libertadDepthAction, libertadSkipAction } from "../../../libertad_actions";

export const metadata = { title: "Mi diagnóstico · Mi Plan de Libertad" };
export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; editar?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor(); const plan = await getPlan(db, actor); if (!plan) redirect("/libertad");
  const st = stateOf(plan); const q = (sp.editar && QBY.get(sp.editar)) || st.next; const pr = st.progress;
  if (!q) return (<><h1>¡Terminaste este diagnóstico!</h1><Flash sp={sp} /><div className="card lb-done"><p className="lead">Ya tienes tu Mapa de Libertad con lo que respondiste. Las preguntas que omitiste aparecen como «dato faltante».</p>
    <div className="lb-actions"><Link className="btn big" href="/libertad">Ver mi Mapa de Libertad</Link>{plan.depth === "corto" && <form action={libertadDepthAction}><input type="hidden" name="depth" value="profundo" /><button className="ghost">Profundizar con más preguntas</button></form>}</div></div></>);
  const cur = plan.data.answers[q.id]; const aprox = plan.data.conf[q.id] === "aprox"; const stage = STAGES[q.stage];
  return (<>
    <p><Link href="/libertad">← Guardar y salir</Link></p>
    <div className="lb-steps" aria-label="Avance">{pr.byStage.map((b) => <span key={b.stage} className={`lb-step${b.stage === q.stage ? " on" : ""}${b.total > 0 && b.done === b.total ? " done" : ""}`}>{b.stage}. {b.name}</span>)}</div>
    <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={pr.total} aria-valuenow={pr.done} aria-label="Avance del diagnóstico"><div className="bar" style={{ width: `${pr.total ? (pr.done / pr.total) * 100 : 0}%` }} /></div>
    <p className="muted">{pr.done} de {pr.total} preguntas · {plan.depth === "corto" ? "diagnóstico corto" : "diagnóstico profundo"}</p>
    <Flash sp={sp} />
    <section className="card lb-q" data-testid="lb-question"><div className="lb-eyebrow">Etapa {q.stage} · {stage.name}</div>
      <form action={libertadAnswerAction}><input type="hidden" name="qid" value={q.id} />
        <label htmlFor="value" className="lb-prompt">{q.prompt}</label>{q.why && <p className="help">{q.why}</p>}
        {q.kind === "texto" && <textarea id="value" name="value" rows={4} maxLength={q.max} defaultValue={typeof cur === "string" ? cur : ""} autoFocus />}
        {q.kind === "opcion" && <div role="radiogroup" aria-label={q.prompt} className="lb-opts">{q.options!.map((o) => <label key={o.value} className="lb-opt"><input type="radio" name="value" value={o.value} defaultChecked={cur === o.value} required /> {o.label}</label>)}</div>}
        {q.kind === "si_no" && <div role="radiogroup" aria-label={q.prompt} className="lb-opts"><label className="lb-opt"><input type="radio" name="value" value="si" defaultChecked={cur === true} required /> Sí</label><label className="lb-opt"><input type="radio" name="value" value="no" defaultChecked={cur === false} /> No</label></div>}
        {["numero", "horas", "porcentaje"].includes(q.kind) && <div className="lb-num"><input id="value" name="value" inputMode="decimal" autoComplete="off" defaultValue={typeof cur === "number" ? String(cur) : ""} placeholder="0" autoFocus /><span className="muted">{q.unit}</span></div>}
        {q.allowApprox && <label className="lb-chk"><input type="checkbox" name="aprox" value="1" defaultChecked={aprox} /> Es una cifra aproximada</label>}
        <div className="lb-actions"><button className="big" data-testid="lb-next">Guardar y continuar</button>
          <button className="ghost" formAction={libertadSkipAction} formNoValidate data-testid="lb-skip">Omitir por ahora</button>
          <button className="ghost" name="leave" value="1" formNoValidate>Guardar y continuar después</button></div>
      </form>
      <p className="muted" style={{ marginTop: 12 }}>Omitir está bien: ese cálculo quedará marcado como incompleto y nunca inventamos una cifra. {q.stage === 2 && "No pedimos contraseñas, números de cuenta ni tarjetas."}</p>
    </section>
    <details className="card" style={{ marginTop: 12 }}><summary>Ver y corregir mis respuestas anteriores</summary>
      <ul className="lb-list">{Object.entries(plan.data.answers).slice(-12).reverse().map(([k, v]) => <li key={k}><span>{QBY.get(k)?.prompt ?? k}<br /><b>{typeof v === "boolean" ? (v ? "Sí" : "No") : String(v)}</b></span><form action={libertadBackAction}><input type="hidden" name="qid" value={k} /><button className="ghost">Cambiar</button></form></li>)}</ul></details>
  </>);
}
