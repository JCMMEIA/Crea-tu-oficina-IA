import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getGuided, PROPOSAL_NOTICE } from "@/features/tasks/catalog";
import { prefillFor } from "@/features/tasks/service";
import { identityFor } from "@/features/employees/catalog";
import { EmployeePhoto } from "@/features/employees/components/EmployeePhoto";
import { guidedRunAction } from "../../../tareas_actions";
import { hireAction } from "../../../actions";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) { return { title: getGuided((await params).key)?.title ?? "Tarea" }; }
export default async function Tarea({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const t = getGuided((await params).key); if (!t) notFound(); const sp = await searchParams; const { db, actor } = await requireActor();
  const pf = await prefillFor(db, actor, t); const id = identityFor(t.employeeKey); const blocked = !!pf.limits.blockedReason; const noEmp = !pf.employee || pf.employee.status !== "active";
  return (<><p><Link href="/tareas">← Todas las tareas</Link></p><h1>{t.title}</h1><p className="lead">{t.purpose}</p><Flash sp={sp} />
    <div className="card"><div className="row" style={{ alignItems: "center", gap: 12 }}><EmployeePhoto name={id?.nombre ?? ""} templateKey={t.employeeKey} size={56} /><div><b>{id?.nombre}</b> · {id?.puesto}<div className="muted">Quien hará esta tarea · {pf.employee ? (pf.employee.status === "active" ? "ya contratado" : "en pausa") : "aún no contratado"}</div></div></div></div>
    {pf.missingNeeds.length > 0 && <div className="tip" role="note" data-testid="missing-brain">Para un mejor resultado falta en <Link href="/cerebro">tu Cerebro</Link>: {pf.missingNeeds.map((m) => m.label).join(" · ")}. Puedes seguir, pero la propuesta será más genérica.</div>}
    {pf.limits.level === "aviso" && !blocked && <div className="notice" role="status" data-testid="limit-warning">Llevas el {Math.round(pf.limits.pct * 100)}% de tu uso mensual de IA.</div>}
    {blocked && <div className="notice bad" role="alert" data-testid="limit-banner">{pf.limits.blockedReason}</div>}
    {!pf.employee && <form action={hireAction} className="card" style={{ marginTop: 12 }}><input type="hidden" name="empleado" value={t.employeeKey} /><input type="hidden" name="next" value={`/tareas/${t.key}`} /><p>Primero contrata a <b>{id?.nombre}</b>. Contratar no cuesta nada ni envía nada.</p><button className="big" data-testid="contratar">Contratar a {id?.nombre}</button></form>}
    <form action={guidedRunAction} className="card" style={{ marginTop: 12 }} data-testid="guided-form"><input type="hidden" name="key" value={t.key} /><h2>Cuéntanos lo necesario</h2><p className="muted">Lo que ya sabemos de tu negocio viene llenado; corrígelo si hace falta.</p>
      {t.questions.map((qu) => { const v = pf.answers[qu.id] ?? ""; return (<div key={qu.id}><label htmlFor={`a_${qu.id}`}>{qu.label}{!qu.required && " (opcional)"}{v && <span className="chip" style={{ marginLeft: 8 }}>Prellenado desde tu Cerebro</span>}</label>
        {qu.type === "select" ? <select id={`a_${qu.id}`} name={`a_${qu.id}`} required={qu.required} defaultValue=""><option value="" disabled>Elige una opción</option>{qu.options!.map((o) => <option key={o}>{o}</option>)}</select>
          : qu.type === "textarea" ? <textarea id={`a_${qu.id}`} name={`a_${qu.id}`} rows={3} maxLength={qu.max} required={qu.required} defaultValue={v} placeholder={qu.placeholder} /> : <input id={`a_${qu.id}`} name={`a_${qu.id}`} maxLength={qu.max} required={qu.required} defaultValue={v} placeholder={qu.placeholder} />}</div>); })}
      <p className="muted" style={{ fontSize: ".9rem" }}>Se usará la IA de tu oficina (≈ {(t.estTokens.in + t.estTokens.out).toLocaleString("es-MX")} tokens). {PROPOSAL_NOTICE.split(".")[1]?.trim() ? "El resultado es una propuesta: no se publica ni se envía nada." : ""}</p>
      <p><button className="big" disabled={blocked || noEmp} data-testid="guided-run">{blocked ? "Límite alcanzado" : noEmp ? "Contrata al empleado para continuar" : "Crear propuesta"}</button></p></form></>);
}
