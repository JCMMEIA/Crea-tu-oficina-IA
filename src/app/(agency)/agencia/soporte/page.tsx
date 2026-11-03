import Link from "next/link";
import { requireAgency, when } from "@/lib/session";
import { Empty } from "@/lib/ui";
import { supportQueue } from "@/server/agency";
import { enterClientAction } from "../../../agency_actions";
export default async function Soporte() {
  const { db, agency } = await requireAgency(); const q = await supportQueue(db, agency);
  const enter = (id: string, label: string) => <form action={enterClientAction} className="inline"><input type="hidden" name="companyId" value={id} /><button className="ghost">{label}</button></form>;
  return (<><h1>Soporte y aprobaciones</h1><p className="muted">Solo se muestran los clientes de tu agencia. Para decidir, entra a la oficina del cliente → Aprobaciones.</p>
    <div className="card"><h2>Aprobaciones pendientes ({q.approvals.length})</h2>{q.approvals.length ? <table><tbody>{q.approvals.map((a: any) => <tr key={a.id}><td>{a.summary}<div className="muted">{a.company_name} · {when(a.created_at)}</div></td><td>{enter(a.company_id, "Ir a decidir")}</td></tr>)}</tbody></table> : <Empty>Nada pendiente.</Empty>}</div>
    <div className="card" style={{ marginTop: 12 }}><h2>Tareas fallidas ({q.failed.length})</h2>{q.failed.length ? <table><tbody>{q.failed.map((t: any) => <tr key={t.id}><td>{t.title}<div className="muted">{t.company_name} · {when(t.created_at)}</div><div className="bad">{t.error}</div></td><td>{enter(t.company_id, "Abrir oficina")}</td></tr>)}</tbody></table> : <Empty>Sin fallos.</Empty>}</div><p><Link href="/agencia">← Panel</Link></p></>);
}
