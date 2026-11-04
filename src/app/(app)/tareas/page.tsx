import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { tasksByArea } from "@/features/tasks/catalog";
import { identityFor } from "@/features/employees/catalog";
import { EmployeePhoto } from "@/features/employees/components/EmployeePhoto";
import { limitStatus } from "@/server/usage/report";
import { completeness, getBrain } from "@/server/brain";

export const metadata = { title: "Tareas guiadas" };
export default async function Tareas({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const hired = new Set((await db.query("SELECT template_key FROM employees WHERE company_id=$1 AND status='active'", [actor.companyId])).map((r) => r.template_key as string));
  const lim = await limitStatus(db, actor.companyId); const comp = completeness((await getBrain(db, actor.companyId)).profile);
  return (<><h1>Tareas guiadas</h1><p className="lead">Elige un trabajo, contesta unas preguntas (ya vienen llenas con los datos de tu negocio) y recibe una propuesta lista para revisar.</p><Flash sp={sp} />
    {comp.filled < comp.total && <div className="tip" role="note" data-testid="brain-hint">Para mejores resultados completa <Link href="/cerebro">el Cerebro de tu empresa</Link> ({comp.filled} de {comp.total} datos clave).</div>}
    {lim.blockedReason && <div className="notice bad" role="alert" data-testid="limit-banner">{lim.blockedReason}</div>}
    {tasksByArea().map((g) => <section key={g.area} style={{ marginTop: 16 }}><h2>{g.label}</h2><div className="emp-grid">{g.tasks.map((t) => { const id = identityFor(t.employeeKey); return (
      <article className="card emp-card" key={t.key} data-testid={`tarea-${t.key}`}><div className="row" style={{ alignItems: "center", gap: 10 }}><EmployeePhoto name={id?.nombre ?? t.employeeKey} templateKey={t.employeeKey} size={44} /><div><b>{id?.nombre}</b><div className="muted" style={{ fontSize: ".85rem" }}>{id?.puesto}</div></div></div>
        <h3 style={{ margin: "8px 0 4px" }}>{t.title}</h3><p style={{ margin: 0 }}>{t.purpose}</p>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>≈ {(t.estTokens.in + t.estTokens.out).toLocaleString("es-MX")} tokens · Resultado: {t.resultLabel}</p>
        <div className="emp-actions">{hired.has(t.employeeKey) ? <span className="state ok">Empleado contratado</span> : <span className="state warn">Falta contratarlo</span>}<Link className="btn" href={`/tareas/${t.key}`} data-testid={`usar-${t.key}`}>Usar esta tarea</Link></div></article>); })}</div></section>)}</>);
}
