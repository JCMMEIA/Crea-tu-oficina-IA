import { Db, newId } from "../db";
import { issueAccessLink } from "./access";

/**
 * Correos transaccionales. Proveedor: Resend (API HTTPS). NO VERIFICADO contra Resend real (sin cuenta en esta sesión): escrito según su documentación pública.
 * Sin RESEND_API_KEY + MAIL_FROM no hay proveedor: los correos quedan en cola y la tienda NO abre (el comprador no podría recibir su acceso).
 */
export interface MailProvider { name: string; send(m: { to: string; subject: string; text: string }): Promise<string> }
export function mailProvider(): MailProvider | null {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return null;
  const base = process.env.MAIL_API_BASE || "https://api.resend.com";
  return { name: "resend", async send(m) {
    const r = await fetch(`${base}/emails`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error(`El proveedor de correo rechazó el envío (${r.status})`);
    return String(j.id);
  } };
}
export const emailReady = () => mailProvider() !== null;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export type EmailKind = "acceso" | "bienvenida" | "pago_fallido" | "oficina_cancelada";
/** Pone un correo en cola. `dedupeKey` evita duplicados (mismo pedido/evento = un solo correo). */
export async function queueEmail(db: Db, e: { to: string; kind: EmailKind; payload?: Record<string, unknown>; dedupeKey?: string }): Promise<boolean> {
  const r = await db.query("INSERT INTO emails(id,to_email,kind,payload,dedupe_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id", [newId(), e.to.trim().toLowerCase(), e.kind, JSON.stringify(e.payload ?? {}), e.dedupeKey ?? null]);
  return r.length > 0;
}

async function render(db: Db, row: { to_email: string; kind: EmailKind; payload: any }): Promise<{ subject: string; text: string }> {
  const p = row.payload ?? {}; const s = site();
  const officeName = p.agencyId ? ((await db.query("SELECT name FROM agencies WHERE id=$1", [p.agencyId]))[0]?.name ?? "tu oficina") : "tu oficina";
  const foot = `\n\n¿Necesitas ayuda? Escríbenos desde ${s}/ayuda/tutoriales#soporte\nSi no pediste esto, ignora este correo.`;
  if (row.kind === "acceso" || row.kind === "bienvenida") {
    const token = await issueAccessLink(db, p.userId, row.kind === "bienvenida" ? "bienvenida" : "acceso", 30);
    const link = `${s}/acceso?t=${token}`;
    return row.kind === "bienvenida"
      ? { subject: `Tu oficina IA «${officeName}» está lista`, text: `¡Gracias por tu compra!\n\nTu oficina IA «${officeName}» ya está creada. Entra con este enlace seguro (vale 30 minutos y se usa una sola vez):\n\n${link}\n\nAl entrar te guiamos paso a paso: nombre, tipo de negocio, plantilla y empleados. Si el enlace caduca, pide otro en ${s}/recuperar con este mismo correo.${foot}` }
      : { subject: "Tu enlace de acceso a Crea tu Oficina IA", text: `Pediste entrar a tu cuenta. Usa este enlace seguro (vale 30 minutos y se usa una sola vez):\n\n${link}${foot}` };
  }
  if (row.kind === "pago_fallido") return { subject: `No pudimos cobrar la suscripción de «${officeName}»`, text: `No pudimos procesar el último pago de «${officeName}». Actualiza tu forma de pago desde «Mi plan» en tu panel para evitar que se detenga el servicio:\n\n${s}/agencia/plan${foot}` };
  return { subject: `La suscripción de «${officeName}» terminó`, text: `La suscripción de «${officeName}» ya no está activa. Tus datos se conservan; puedes crear una oficina nueva cuando quieras desde ${s}/oficinas.${foot}` };
}

/** Envía los correos en cola (reintenta hasta 5 veces). Idempotente por fila. El contenido (con su enlace) no se guarda: solo se arma al enviar. */
export async function processEmails(db: Db, provider: MailProvider | null = mailProvider(), limit = 20): Promise<{ sent: number; failed: number }> {
  if (!provider) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0; const seen: string[] = []; // cada correo se intenta UNA vez por pasada y queda «arrendado» 5 min mientras se envía (si dos procesos corren a la vez, no lo envían dos veces); los fallidos esperan (retry_at) antes de reintentar
  for (let i = 0; i < limit; i++) {
    const row = (await db.query(`UPDATE emails SET attempts=attempts+1, retry_at=now() + interval '5 minutes' WHERE id = (SELECT id FROM emails WHERE status='en_cola' AND attempts < 5 AND retry_at <= now() AND id <> ALL($1::text[]) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,to_email,kind,payload,attempts`, [seen]))[0];
    if (!row) break; seen.push(row.id);
    try {
      const m = await render(db, row as any); const pid = await provider.send({ to: row.to_email, ...m });
      await db.query("UPDATE emails SET status='enviado', sent_at=now(), provider_id=$2, last_error=NULL WHERE id=$1", [row.id, pid]); sent++;
    } catch (e: any) { await db.query("UPDATE emails SET status=CASE WHEN attempts>=5 THEN 'error' ELSE 'en_cola' END, last_error=$2, retry_at=now() + (attempts * interval '2 minutes') WHERE id=$1", [row.id, String(e.message).slice(0, 300)]); failed++; }
  }
  return { sent, failed };
}
