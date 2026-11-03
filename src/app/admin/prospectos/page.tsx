import Link from "next/link";
import { requireOperator, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { listLeads } from "@/server/commercial/crm";
import { INTERESTS, LEAD_STATUSES } from "@/server/leads";
import { leadStatusAction } from "../../admin_actions";

const IT = Object.fromEntries(INTERESTS);
export default async function Prospectos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const { db, op } = await requireOperator();
  const rows = await listLeads(db, op, { status: sp.status, kind: sp.kind, due: sp.due === "1", q: sp.q });
  const now = Date.now();
  return (<><h1>Prospectos ({rows.length})</h1><Flash sp={sp} />
    <form className="row" method="get"><input name="q" placeholder="Buscar por nombre, correo o negocio" defaultValue={sp.q} style={{ maxWidth: 320 }} />
      <select name="status" defaultValue={sp.status ?? ""}><option value="">Todos los estados</option>{LEAD_STATUSES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      <select name="kind" defaultValue={sp.kind ?? ""}><option value="">Acceso y demos</option><option value="demo">Solo demos</option><option value="acceso">Solo acceso</option></select>
      <label style={{ fontWeight: 400 }}><input type="checkbox" name="due" value="1" defaultChecked={sp.due === "1"} style={{ width: "auto" }} /> Recordatorios vencidos</label><button className="ghost">Filtrar</button></form>
    {rows.length ? <table data-testid="lead-table"><thead><tr><th>Prospecto</th><th>Interés</th><th>Fuente</th><th>Recordatorio</th><th>Estado</th></tr></thead><tbody>{rows.map((l: any) => { const late = l.next_followup_at && new Date(l.next_followup_at).getTime() <= now && !["ganado", "perdido"].includes(l.status); return (
      <tr key={l.id} data-email={l.email}><td><Link href={`/admin/prospectos/${l.id}`}><b>{l.name || l.email}</b></Link>{l.kind === "demo" && <span className="state warn"> 🎯 demo</span>}<div className="muted">{l.email}{l.company ? ` · ${l.company}` : ""}</div><div className="muted">{when(l.created_at)}</div></td>
        <td className="muted">{(l.interests as string[]).map((k) => IT[k] ?? k).join(", ") || "—"}</td><td>{l.source}</td>
        <td>{l.next_followup_at ? <span className={late ? "bad" : ""}>{late ? "⏰ " : ""}{when(l.next_followup_at)}</span> : "—"}</td>
        <td><form action={leadStatusAction} className="inline"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value="/admin/prospectos" /><select name="status" defaultValue={l.status} aria-label="Estado">{LEAD_STATUSES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> <button className="ghost">Guardar</button></form></td></tr>); })}</tbody></table>
      : <p className="muted" data-testid="no-leads">Todavía no hay prospectos con esos filtros.</p>}</>);
}
