import Link from "next/link";
import { requireOperator, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getLead } from "@/server/commercial/crm";
import { INTERESTS, LEAD_STATUSES } from "@/server/leads";
import { leadDeleteAction, leadFollowupAction, leadNoteAction, leadStatusAction } from "../../../admin_actions";

const IT = Object.fromEntries(INTERESTS);
export default async function Prospecto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, op } = await requireOperator();
  let l: any; try { l = await getLead(db, op, id); } catch { return <p>No encontramos ese prospecto. <Link href="/admin/prospectos">← Volver</Link></p>; }
  const field = (t: string, v: React.ReactNode) => <tr><td className="muted">{t}</td><td>{v || "—"}</td></tr>;
  return (<><p><Link href="/admin/prospectos">← Prospectos</Link></p><h1>{l.name || l.email}</h1><Flash sp={sp} />
    <div className="cols" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
      <div className="card"><table><tbody>{field("Correo", l.email)}{field("Negocio", l.company)}{field("Teléfono", l.phone)}{field("Tipo", l.kind === "demo" ? "Solicitud de demostración" : "Acceso anticipado")}
        {field("Interés", (l.interests as string[]).map((k) => IT[k] ?? k).join(", "))}{field("Horario preferido", l.preferred_time)}{field("Etapa", l.stage)}{field("Mensaje", l.message)}
        {field("Fuente", l.source)}{field("Página de entrada", l.landing)}{field("Campaña", (l.utm as any)?.utm_campaign)}{field("Llegó", when(l.created_at))}{field("Demo pedida", l.demo_requested_at && when(l.demo_requested_at))}</tbody></table></div>
      <div><div className="card"><h3>Estado de venta</h3><form action={leadStatusAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={`/admin/prospectos/${l.id}`} />
        <select name="status" defaultValue={l.status}>{LEAD_STATUSES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> <button data-testid="save-status">Guardar</button></form></div>
        <div className="card" style={{ marginTop: 12 }}><h3>Recordatorio</h3>{l.next_followup_at && <p>Pendiente: <b>{when(l.next_followup_at)}</b>{l.followup_note ? ` — ${l.followup_note}` : ""}</p>}
          <form action={leadFollowupAction}><input type="hidden" name="id" value={l.id} /><label htmlFor="w">Cuándo</label><input id="w" name="when" type="datetime-local" required /><label htmlFor="n">Para qué</label><input id="n" name="note" maxLength={300} /><p className="row"><button data-testid="save-followup">Programar</button>{l.next_followup_at && <button className="ghost" name="clear" value="1" formNoValidate>Quitar</button>}</p></form>
          <p className="muted" style={{ fontSize: ".85rem" }}>Es un recordatorio dentro de este panel: no se envía ningún correo ni mensaje.</p></div></div></div>
    <div className="card" style={{ marginTop: 14 }}><h3>Privacidad</h3><p className="muted">Si la persona pide que borremos sus datos, usa este botón. No se puede deshacer.</p><form action={leadDeleteAction}><input type="hidden" name="id" value={l.id} /><button className="ghost" data-testid="delete-lead">Borrar a este prospecto definitivamente</button></form></div>
    <div className="card" style={{ marginTop: 14 }}><h3>Notas</h3><form action={leadNoteAction}><input type="hidden" name="id" value={l.id} /><textarea name="body" rows={2} maxLength={1000} required aria-label="Nueva nota" /><p><button data-testid="save-note">Agregar nota</button></p></form>
      {l.notes.length ? l.notes.map((n: any) => <p key={n.id}><span className="muted">{when(n.created_at)}</span> {n.body}</p>) : <p className="muted">Sin notas.</p>}</div></>);
}
