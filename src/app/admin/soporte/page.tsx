import { requireOperator, when } from "@/lib/session";
import { listSupport } from "@/server/commercial/support";
import { resolveSupportAction } from "../../admin_actions";
export default async function Soporte() {
  const { db, op } = await requireOperator(); const rows = await listSupport(db, op);
  return (<><h1>Soporte</h1><p className="muted">Mensajes del centro de ayuda. No hay correo conectado: respóndelos tú desde tu correo.</p>
    {rows.length ? rows.map((r: any) => <div className="card" key={r.id} style={{ marginBottom: 10 }} data-testid="support-item"><b>{r.subject}</b> <span className={`state ${r.status === "abierta" ? "warn" : "ok"}`}>{r.status}</span><div className="muted">{r.email} · {when(r.created_at)}</div><p>{r.body}</p>
      {r.status === "abierta" && <form action={resolveSupportAction}><input type="hidden" name="id" value={r.id} /><button className="ghost">Marcar resuelta</button></form>}</div>) : <p className="muted">No hay mensajes.</p>}</>);
}
