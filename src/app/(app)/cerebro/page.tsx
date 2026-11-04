import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash, Tip } from "@/lib/ui";
import { BRAIN_FIELDS, brainByEmployee, completeness } from "@/server/brain";
import { displayName } from "@/features/employees/catalog";
import { brainSaveAction } from "../../tareas_actions";

export const metadata = { title: "Cerebro de mi empresa" };
const GROUPS: Record<string, string> = { negocio: "Tu negocio", clientes: "Tus clientes", marca: "Tu marca", metas: "Tus metas" };
export default async function Cerebro({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor(); const r = await brainByEmployee(db, actor); const c = completeness(r.profile);
  return (<><h1>Cerebro de mi empresa</h1><p className="lead">Cuéntale a tu oficina quién eres <b>una sola vez</b>. Todos tus empleados usan esta información en cada tarea, y tú ves exactamente qué recibe cada uno.</p><Flash sp={sp} />
    <div className="card" data-testid="brain-progress"><b>{c.filled} de {c.total} datos clave completos</b><div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={c.filled} style={{ height: 10, background: "rgba(128,128,128,.25)", borderRadius: 6, margin: "8px 0" }}><div style={{ width: `${(c.filled / c.total) * 100}%`, height: "100%", background: "var(--brand, #6d4ad6)", borderRadius: 6 }} /></div>
      {c.missing.length > 0 && <p className="muted">Falta: {c.missing.join(" · ")}</p>}</div>
    <form action={brainSaveAction} data-testid="brain-form">{Object.entries(GROUPS).map(([g, title]) => <section className="card" key={g} style={{ marginTop: 12 }}><h2>{title}</h2>
      {BRAIN_FIELDS.filter((f) => f.group === g).map((f) => <div key={f.key}><label htmlFor={`b_${f.key}`}>{f.label}</label>{f.help && <span className="help">{f.help}</span>}
        {f.kind === "area" ? <textarea id={`b_${f.key}`} name={f.key} rows={3} maxLength={f.max} defaultValue={r.profile[f.key] ?? ""} placeholder={f.placeholder} /> : <input id={`b_${f.key}`} name={f.key} maxLength={f.max} defaultValue={r.profile[f.key] ?? ""} placeholder={f.placeholder} />}</div>)}</section>)}
      <p><button className="big" data-testid="brain-save">Guardar</button></p></form>
    <section className="card" style={{ marginTop: 12 }} data-testid="brain-review"><h2>Qué recibe cada empleado</h2>
      <p className="muted">Todos reciben la ficha de arriba (≈ {r.ctx.approxTokens} tokens por tarea) y solo los documentos que tú les autorizaste en <Link href="/conocimiento">Lo que debe saber mi negocio</Link>. Nada de otras oficinas llega aquí.</p>
      {r.employees.length ? <table><thead><tr><th>Empleado</th><th>Ficha</th><th>Documentos autorizados</th></tr></thead><tbody>{r.employees.map((e: any) => <tr key={e.id}><td>{displayName(e)}<div className="muted">{e.role_title}</div></td><td>Sí ({r.ctx.fields.length} datos)</td><td>{e.docs.length ? e.docs.map((d: any) => d.title).join(", ") : "Ninguno"}</td></tr>)}</tbody></table> : <p className="muted">Aún no tienes empleados. <Link href="/agregar-empleado">Contrata al primero</Link>.</p>}
      <details><summary>Ver el texto exacto que se envía a la IA</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".85rem" }}>{r.ctx.text.trim()}</pre></details></section>
    <Tip>Esta información se envía a la IA que usa tu oficina. No pongas contraseñas ni datos privados de clientes.</Tip></>);
}
