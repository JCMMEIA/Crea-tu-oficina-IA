import Link from "next/link";
import { requireAgency, when } from "@/lib/session";
import { EmptyState } from "@/lib/ui";
import { friendlyError } from "@/lib/lang";
import { supportQueue } from "@/server/agency";
import { enterClientAction } from "../../../agency_actions";
export default async function Soporte() {
  const { db, agency } = await requireAgency(); const q = await supportQueue(db, agency);
  const enter = (id: string, label: string) => <form action={enterClientAction} className="inline"><input type="hidden" name="companyId" value={id} /><button className="ghost">{label}</button></form>;
  return (<><h1>Por aprobar y problemas</h1><p className="lead">Lo que tus empleados quieren hacer y esperan tu permiso, y los trabajos que no salieron. Solo aparecen tus clientes.</p>
    <div className="card"><h2>✋ Esperan tu permiso ({q.approvals.length})</h2>{q.approvals.length ? <table><tbody>{q.approvals.map((a: any) => <tr key={a.id}><td>{a.summary}<div className="muted">{a.company_name} · {when(a.created_at)}</div></td><td>{enter(a.company_id, "Revisar y decidir")}</td></tr>)}</tbody></table> : <EmptyState icon="🎉" title="No hay nada esperando tu permiso" text="Cuando un empleado quiera publicar o cambiar algo, te lo preguntará aquí." />}</div>
    <div className="card" style={{ marginTop: 12 }}><h2>⚠️ Trabajos que no salieron ({q.failed.length})</h2>{q.failed.length ? <table><tbody>{q.failed.map((t: any) => <tr key={t.id}><td>{t.title}<div className="muted">{t.company_name} · {when(t.created_at)}</div><div className="bad">{friendlyError(t.error)}</div></td><td>{enter(t.company_id, "Abrir su oficina")}</td></tr>)}</tbody></table> : <EmptyState icon="👍" title="Todo ha salido bien" text="No hay trabajos con problemas." />}</div><p><Link href="/agencia">← Panel</Link></p></>);
}
