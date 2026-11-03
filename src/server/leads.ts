import { z } from "zod";
import { Db, newId } from "./db";

export const INTERESTS = [["agencia-propia", "Crear mi propia agencia con marca blanca"], ["anuncios", "Anuncios y marketing"], ["mensajes", "Atención por WhatsApp / Telegram"], ["inventarios", "Control de inventarios"], ["propuestas", "Propuestas y ventas"], ["otro", "Otra cosa"]] as const;
const INTEREST_KEYS = INTERESTS.map(([k]) => k) as [string, ...string[]];
export const LEAD_STATUSES = [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["demo_agendada", "Demo agendada"], ["demo_realizada", "Demo realizada"], ["negociando", "Negociando"], ["ganado", "Ganado"], ["perdido", "Perdido"]] as const;
const STATUS_KEYS = LEAD_STATUSES.map(([k]) => k) as [string, ...string[]];

const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200), name: z.string().trim().max(120).default(""),
  kind: z.enum(["acceso", "demo"]).default("acceso"),
  company: z.string().trim().max(120).default(""), phone: z.string().trim().max(40).default(""),
  interests: z.array(z.enum(INTEREST_KEYS)).max(6).default([]), preferredTime: z.string().trim().max(120).default(""),
  stage: z.enum(["", "idea", "ya-vendo-servicios", "tengo-clientes"]).default(""), message: z.string().trim().max(1000).default(""),
  consent: z.literal(true, { error: "Debes aceptar la política de privacidad." }),
  utm: z.record(z.string(), z.string().max(200)).default({}),
  source: z.string().trim().max(100).default(""), landing: z.string().trim().max(200).default(""),
});
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
export const pickUtm = (src: Record<string, string | undefined>) => Object.fromEntries(UTM_KEYS.filter((k) => src[k]).map((k) => [k, String(src[k]).slice(0, 200)]));

/** Fuente de tráfico: utm_source > dominio de referencia > directo. Solo texto corto; nunca guarda IP. */
export function deriveSource(utm: Record<string, string | undefined>, referrer = ""): string {
  if (utm.utm_source) return String(utm.utm_source).toLowerCase().slice(0, 60);
  if (utm.fbclid) return "meta";
  try { const h = new URL(referrer).hostname.replace(/^www\./, ""); if (h) return h.slice(0, 60); } catch {}
  return "directo";
}

/**
 * Acceso anticipado o solicitud de demostración. Honeypot y tope por hora contra abuso. El mismo correo se actualiza (no se duplica):
 * conserva su estado de venta y sus notas, y una solicitud de demo nunca se «degrada» a acceso anticipado.
 */
export async function addLead(db: Db, input: unknown, honeypot = ""): Promise<"ok" | "ignored"> {
  if (honeypot) return "ignored";
  const v = leadSchema.parse(input);
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM leads WHERE updated_at > now() - interval '1 hour'"))[0].n);
  if (n >= 200) throw new Error("Hay demasiadas solicitudes ahora mismo. Inténtalo más tarde.");
  const source = v.source || deriveSource(v.utm);
  const demo = v.kind === "demo";
  await db.query(`INSERT INTO leads(id,email,name,stage,message,consent,utm,kind,company,phone,interests,preferred_time,source,landing,demo_requested_at,next_followup_at)
    VALUES($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (email) DO UPDATE SET
      name=COALESCE(NULLIF($3,''),leads.name), stage=COALESCE(NULLIF($4,''),leads.stage), message=COALESCE(NULLIF($5,''),leads.message),
      company=COALESCE(NULLIF($8,''),leads.company), phone=COALESCE(NULLIF($9,''),leads.phone),
      interests=CASE WHEN $10::jsonb='[]'::jsonb THEN leads.interests ELSE $10::jsonb END,
      preferred_time=COALESCE(NULLIF($11,''),leads.preferred_time),
      kind=CASE WHEN leads.kind='demo' OR $7='demo' THEN 'demo' ELSE 'acceso' END,
      demo_requested_at=COALESCE(leads.demo_requested_at,$14), updated_at=now()`,
    [newId(), v.email, v.name, v.stage, v.message, JSON.stringify(v.utm), v.kind, v.company, v.phone, JSON.stringify(v.interests), v.preferredTime, source, v.landing,
      demo ? new Date().toISOString() : null, demo ? new Date(Date.now() + 86_400_000).toISOString() : null]);
  return "ok";
}
export { STATUS_KEYS };
