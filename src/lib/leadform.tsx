import { leadAction } from "@/app/lead_action";
export function LeadForm({ utm = {} }: { utm?: Record<string, string> }) {
  return (<form action={leadAction} className="card" id="acceso">
    <h2>Acceso anticipado</h2><p className="muted">Déjanos tu correo y te avisamos cuando abramos más cupos. Sin cobros y sin tarjeta.</p>
    {Object.entries(utm).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    <div className="hp" aria-hidden="true"><label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label htmlFor="lead-name">Nombre</label><input id="lead-name" name="name" autoComplete="name" />
    <label htmlFor="lead-email">Correo</label><input id="lead-email" name="email" type="email" required autoComplete="email" />
    <label htmlFor="lead-stage">¿En qué punto estás?</label><select id="lead-stage" name="stage"><option value="">Prefiero no decir</option><option value="idea">Tengo la idea de abrir una agencia</option><option value="ya-vendo-servicios">Ya vendo servicios y quiero escalar</option><option value="tengo-clientes">Ya tengo clientes</option></select>
    <label htmlFor="lead-msg">¿Qué te gustaría resolver? (opcional)</label><textarea id="lead-msg" name="message" rows={3} maxLength={1000} />
    <label style={{ fontWeight: 400, display: "flex", gap: 8 }}><input type="checkbox" name="consent" required style={{ width: "auto", marginTop: 4 }} /> <span>Acepto la <a href="/privacidad">política de privacidad</a> y que me contacten sobre el acceso anticipado.</span></label>
    <p><button className="big">Quiero acceso anticipado</button></p></form>);
}
