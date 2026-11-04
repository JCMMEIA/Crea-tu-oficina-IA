import { leadAction } from "@/app/lead_action";
import { Attribution } from "@/features/funnel/tracking/attribution";
import { INTERESTS } from "@/server/leads";

/** Un solo formulario para dos intenciones: «acceso» (lista de espera) y «demo» (pedir demostración, con más datos). */
export interface LeadFormProps { kind?: "acceso" | "demo"; /** Ruta de la página que lo muestra (se guarda como «landing» y es a donde vuelve si hay error). Solo rutas permitidas. */ landing?: string; title?: string; intro?: string; submit?: string }
export function LeadForm({ kind = "acceso", landing, title, intro, submit }: LeadFormProps) {
  const demo = kind === "demo";
  return (<form action={leadAction} className="card" id="acceso">
    <h2>{title ?? (demo ? "Pide tu demostración" : "Pide tu acceso anticipado")}</h2>
    <p className="muted">{intro ?? (demo ? "Te mostramos la plataforma funcionando, con un negocio de ejemplo, y respondemos tus dudas. Sin costo ni compromiso." : "Déjanos tu correo y te avisamos cuando abramos más lugares. No cuesta nada.")}</p>
    <input type="hidden" name="kind" value={kind} />{landing && <input type="hidden" name="landing" value={landing} />}<Attribution track="visita" />
    <div className="hp" aria-hidden="true"><label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label htmlFor="lead-name">Nombre</label><input id="lead-name" name="name" autoComplete="name" required={demo} />
    <label htmlFor="lead-email">Correo</label><input id="lead-email" name="email" type="email" required autoComplete="email" />
    {demo && <>
      <label htmlFor="lead-company">Tu negocio o proyecto (opcional)</label><input id="lead-company" name="company" autoComplete="organization" />
      <label htmlFor="lead-phone">Teléfono o WhatsApp (opcional)</label><span className="help">Solo lo usaremos para coordinar tu demostración.</span><input id="lead-phone" name="phone" type="tel" autoComplete="tel" />
      <fieldset style={{ border: 0, padding: 0, margin: "10px 0" }}><legend><b>¿Qué te interesa?</b></legend>
        {INTERESTS.map(([k, t]) => <label key={k} style={{ fontWeight: 400, display: "flex", gap: 8 }}><input type="checkbox" name="interests" value={k} style={{ width: "auto" }} /> {t}</label>)}</fieldset>
      <label htmlFor="lead-time">¿Cuándo te viene mejor? (opcional)</label><span className="help">Por ejemplo: «martes por la tarde».</span><input id="lead-time" name="preferredTime" maxLength={120} />
    </>}
    <label htmlFor="lead-stage">¿En qué punto estás?</label><span className="help">Nos ayuda a prepararte mejor la bienvenida.</span><select id="lead-stage" name="stage"><option value="">Prefiero no decir</option><option value="idea">Quiero empezar mi agencia</option><option value="ya-vendo-servicios">Ya vendo servicios y quiero crecer</option><option value="tengo-clientes">Ya tengo clientes</option></select>
    <label htmlFor="lead-msg">¿Qué te gustaría lograr? (opcional)</label><textarea id="lead-msg" name="message" rows={3} maxLength={1000} />
    <label style={{ fontWeight: 400, display: "flex", gap: 8 }}><input type="checkbox" name="consent" required style={{ width: "auto", marginTop: 4 }} /> <span>Acepto la <a href="/privacidad">política de privacidad</a> y que me escriban sobre {demo ? "mi demostración" : "mi acceso anticipado"}.</span></label>
    <p><button className="big" data-testid="lead-submit">{submit ?? (demo ? "Pedir demostración" : "Pedir acceso anticipado")}</button></p></form>);
}
