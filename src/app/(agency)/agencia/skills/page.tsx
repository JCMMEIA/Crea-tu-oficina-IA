import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash, Tip } from "@/lib/ui";
import { getAgencySkill } from "@/server/agency";
import { allPlainEmployees } from "@/server/guide/services";
import { DEPARTMENTS, EMPLOYEES } from "@/server/catalog/data";
import { TeachForm } from "@/components/TeachForm";
import { agencySkillAction, teachAgencyAction } from "../../../agency_actions";

export const metadata = { title: "Lo que saben mis empleados" };
export default async function Skills({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; plantilla?: string; modo?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  const customs = new Set((await db.query("SELECT template_key FROM agency_skill_templates WHERE agency_id=$1", [agency.agencyId])).map((r) => r.template_key as string));
  const sel = EMPLOYEES.find((e) => e.key === sp.plantilla); const cur = sel ? await getAgencySkill(db, agency, sel.key) : null; const plain = sel ? allPlainEmployees().find((p) => p.key === sel.key) : null;
  return (<><h1>Lo que saben mis empleados</h1><p className="lead">Enséñale a un empleado <b>una sola vez</b> y lo sabrá en todos tus clientes nuevos. Los clientes que ya tienes no cambian.</p><Flash sp={sp} />
    <div className="grid"><div className="card" style={{ maxHeight: 560, overflow: "auto" }}><h3>Elige a quién enseñar</h3>{DEPARTMENTS.map((d) => <div key={d.key}><h4 style={{ margin: "12px 0 4px" }}>{d.icon} {d.name}</h4>{EMPLOYEES.filter((e) => e.department === d.key).map((e) => <div key={e.key}><Link href={`/agencia/skills?plantilla=${e.key}`}>{e.name}</Link> {customs.has(e.key) && <span className="state ok">🎓 Ya le enseñaste</span>}</div>)}</div>)}</div>
      {sel && cur && plain && <div className="card" style={{ gridColumn: "span 2" }}><h2>🎓 Enseña a {sel.name}</h2><p className="muted">{plain.que} {cur.custom ? "Ya tiene tu enseñanza." : "Todavía trabaja a su manera de fábrica."}</p>
        <Tip>Responde como se lo dirías a una persona. Verás una vista previa antes de guardar.</Tip>
        <TeachForm action={teachAgencyAction} hidden={{ key: sel.key }} employeeName={sel.name} />
        <details style={{ marginTop: 16 }}><summary>Modo experto (instrucciones completas)</summary><form action={agencySkillAction}><input type="hidden" name="key" value={sel.key} /><label>Instrucciones completas</label><textarea name="systemPrompt" rows={9} defaultValue={cur.spec.systemPrompt} />
          <label>Pasos que sigue (uno por línea)</label><textarea name="procedures" rows={5} defaultValue={cur.spec.procedures.join("\n")} /><label>Cómo entrega el trabajo</label><textarea name="outputFormat" rows={3} defaultValue={cur.spec.outputFormat} /><label>Nota para ti</label><input name="note" /><p><button>Guardar (modo experto)</button></p></form></details></div>}
      {!sel && <div className="card" style={{ gridColumn: "span 2" }}><h3>👈 Elige a un empleado de la lista</h3><p className="muted">Te haremos 5 preguntas sencillas sobre cómo quieres que trabaje.</p></div>}</div></>);
}
