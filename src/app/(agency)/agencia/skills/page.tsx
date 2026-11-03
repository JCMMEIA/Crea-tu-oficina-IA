import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getAgencySkill } from "@/server/agency";
import { DEPARTMENTS, EMPLOYEES } from "@/server/catalog/data";
import { agencySkillAction } from "../../../agency_actions";
export default async function Skills({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; plantilla?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  const customs = new Set((await db.query("SELECT template_key FROM agency_skill_templates WHERE agency_id=$1", [agency.agencyId])).map((r) => r.template_key as string));
  const sel = EMPLOYEES.find((e) => e.key === sp.plantilla); const cur = sel ? await getAgencySkill(db, agency, sel.key) : null;
  return (<><h1>Skills y agentes reutilizables</h1><p className="muted">Personaliza una vez el método de tu agencia: se usará al contratar ese agente en cualquier cliente nuevo. Cada cliente puede después ajustarlo sin afectar a los demás ni a esta plantilla.</p><Flash sp={sp} />
    <div className="grid"><div className="card" style={{ maxHeight: 560, overflow: "auto" }}>{DEPARTMENTS.map((d) => <div key={d.key}><h3 style={{ marginTop: 10 }}>{d.icon} {d.name}</h3>{EMPLOYEES.filter((e) => e.department === d.key).map((e) => <div key={e.key}><Link href={`/agencia/skills?plantilla=${e.key}`}>{e.name}</Link> {customs.has(e.key) && <span className="chip ok">de tu agencia</span>}</div>)}</div>)}</div>
      {sel && cur && <div className="card" style={{ gridColumn: "span 2" }}><h2>{sel.name}</h2><p className="muted">{sel.mission} {cur.custom ? "Usando la skill de tu agencia." : "Usando la skill base de la plataforma."}</p>
        <form action={agencySkillAction}><input type="hidden" name="key" value={sel.key} /><label>Instrucciones del sistema</label><textarea name="systemPrompt" rows={9} defaultValue={cur.spec.systemPrompt} />
          <label>Procedimientos (uno por línea)</label><textarea name="procedures" rows={5} defaultValue={cur.spec.procedures.join("\n")} /><label>Formato de entrega</label><textarea name="outputFormat" rows={3} defaultValue={cur.spec.outputFormat} /><label>Nota</label><input name="note" /><p><button>Guardar skill de la agencia</button></p></form></div>}</div></>);
}
