import { createHmac, timingSafeEqual } from "node:crypto";
import { Db, newId } from "../db";
import { issueAccessLink } from "./access";
import { esc, layout, plain, Mail } from "./email_templates";
import { planOf } from "../agency/plans";

/**
 * Correos transaccionales con Resend (API HTTPS). Estados que NO se confunden:
 *   en_cola → el sistema aún no lo entregó al proveedor · enviado → el proveedor ACEPTÓ el mensaje (NO significa que llegó al buzón)
 *   delivery_status (por webhook firmado del proveedor) → delivered / bounced / complained… = lo que pasó DESPUÉS.
 * Sin RESEND_API_KEY + MAIL_FROM no hay proveedor: los correos quedan en cola, se marca el motivo y la tienda NO abre.
 */
export class MailError extends Error { constructor(public status: number, public code: string, message: string) { super(message); this.name = "MailError"; } }
export interface MailMessage { to: string; subject: string; text: string; html: string }
export interface MailProvider { name: string; send(m: MailMessage): Promise<string> }
export const mailFromDomain = (from = process.env.MAIL_FROM ?? "") => (from.match(/@([A-Za-z0-9.-]+)>?\s*$/)?.[1] ?? "").toLowerCase();
export function mailConfig() {
  const from = process.env.MAIL_FROM ?? "";
  return { keySet: !!process.env.RESEND_API_KEY, keyShapeOk: /^re_[A-Za-z0-9_]{10,}$/.test(process.env.RESEND_API_KEY ?? ""), from, fromOk: /^(.+<)?[^<>\s@]+@[A-Za-z0-9.-]+\.[a-z]{2,}>?$/i.test(from), fromDomain: mailFromDomain(from), webhookSecretSet: !!process.env.RESEND_WEBHOOK_SECRET, base: process.env.MAIL_API_BASE || "https://api.resend.com" };
}
export function mailProvider(): MailProvider | null {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return null;
  const base = process.env.MAIL_API_BASE || "https://api.resend.com"; const replyTo = process.env.MAIL_REPLY_TO;
  return { name: "resend", async send(m) {
    let r: Response;
    try { r = await fetch(`${base}/emails`, { method: "POST", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html, ...(replyTo ? { reply_to: replyTo } : {}) }) }); }
    catch (e: any) { throw new MailError(0, "red", `No se pudo contactar al proveedor de correo (${String(e?.cause?.code ?? e?.name ?? "red")}).`); }
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new MailError(r.status, String(j.name ?? "rechazado"), String(j.message ?? `El proveedor rechazó el envío (${r.status}).`).slice(0, 240)); // el mensaje del proveedor no contiene secretos
    return String(j.id);
  } };
}
export const emailReady = () => mailProvider() !== null;
const site = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export type EmailKind = "acceso" | "bienvenida" | "oficina_entregada" | "compra_confirmada" | "pago_fallido" | "oficina_cancelada" | "seguridad";
export const KIND_LABEL: Record<EmailKind, string> = { acceso: "Enlace de acceso", bienvenida: "Bienvenida y acceso", oficina_entregada: "Oficina entregada", compra_confirmada: "Confirmación de compra", pago_fallido: "Pago fallido", oficina_cancelada: "Cancelación", seguridad: "Seguridad" };
/** Pone un correo en cola. `dedupeKey` evita duplicados (mismo pedido/evento = un solo correo). */
export async function queueEmail(db: Db, e: { to: string; kind: EmailKind; payload?: Record<string, unknown>; dedupeKey?: string }): Promise<boolean> {
  const r = await db.query("INSERT INTO emails(id,to_email,kind,payload,dedupe_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id", [newId(), e.to.trim().toLowerCase(), e.kind, JSON.stringify(e.payload ?? {}), e.dedupeKey ?? null]);
  return r.length > 0;
}

const FOOT_IGNORE = "Si no fuiste tú, ignora este correo: sin pulsar el enlace no pasa nada.";
async function render(db: Db, row: { to_email: string; kind: EmailKind; payload: any }): Promise<Mail> {
  const p = row.payload ?? {}; const s = site();
  const needLink = ["acceso", "bienvenida", "oficina_entregada"].includes(row.kind);
  if (!s) throw new MailError(0, "sin_sitio", "Falta la dirección pública del sitio (NEXT_PUBLIC_SITE_URL o SITE_URL): no se envían correos con enlaces relativos.");
  const office = p.agencyId ? (await db.query("SELECT name,plan FROM agencies WHERE id=$1", [p.agencyId]))[0] : null; const officeName = office?.name ?? "tu oficina";
  const help = `¿Necesitas ayuda? <a href="${esc(s)}/ayuda/tutoriales#soporte" style="color:#6d3df0">Escríbenos desde el centro de ayuda</a>.`;
  const link = needLink ? `${s}/acceso?t=${await issueAccessLink(db, p.userId, row.kind === "acceso" ? "acceso" : "bienvenida", 30)}` : "";
  switch (row.kind) {
    case "acceso": { const cta = { label: "Iniciar sesión", url: link }; return { subject: "Tu enlace para iniciar sesión en Crea tu Oficina IA", html: layout({ site: s, preheader: "Enlace de un solo uso, vale 30 minutos.", title: "Inicia sesión en tu cuenta", blocks: [{ p: "Pediste entrar a tu cuenta. Pulsa el botón para iniciar sesión." }, { list: ["Vale <strong>30 minutos</strong>.", "Se puede usar <strong>una sola vez</strong>.", "Solo funciona para este correo."] }, { note: "Si el enlace caduca, pide otro en la pantalla de inicio de sesión." }], cta, footerNote: `${FOOT_IGNORE}<br>${help}` }), text: plain({ title: "Inicia sesión en tu cuenta", lines: ["Pediste entrar a tu cuenta. El enlace vale 30 minutos y se usa una sola vez.", FOOT_IGNORE], cta, footer: `Ayuda: ${s}/ayuda/tutoriales#soporte` }) }; }
    case "bienvenida": { const cta = { label: "Entrar a mi oficina", url: link }; return { subject: `Tu oficina IA «${officeName}» está lista`, html: layout({ site: s, preheader: `Tu oficina «${officeName}» ya está creada. Entra con tu enlace seguro.`, title: "¡Bienvenido! Tu oficina está lista", blocks: [{ p: `Tu oficina IA <strong>${esc(officeName)}</strong> ya está creada. Entra con tu enlace seguro para configurarla paso a paso.` }, { list: ["Elegir el tipo de negocio y la plantilla.", "Contratar a tus empleados IA y ver sus perfiles.", "Pedir tu primera tarea y aprobar lo importante."] }, { note: "El enlace vale 30 minutos y se usa una sola vez. Si caduca, pide otro en «Iniciar sesión» con este mismo correo." }], cta, footerNote: `${FOOT_IGNORE}<br>${help}` }), text: plain({ title: "¡Bienvenido! Tu oficina está lista", lines: [`Tu oficina IA «${officeName}» ya está creada.`, "El enlace vale 30 minutos y se usa una sola vez; si caduca, pide otro en «Iniciar sesión» con este mismo correo."], cta, footer: FOOT_IGNORE }) }; }
    case "oficina_entregada": { const cta = { label: "Entrar a la nueva oficina", url: link }; return { subject: `Tu nueva oficina «${officeName}» está lista`, html: layout({ site: s, preheader: `«${officeName}» ya aparece en Mis oficinas.`, title: "Tu nueva oficina está lista", blocks: [{ p: `La oficina <strong>${esc(officeName)}</strong> se creó en tu cuenta. También la verás en «Mis oficinas».` }, { note: "El enlace vale 30 minutos y se usa una sola vez." }], cta, footerNote: `${FOOT_IGNORE}<br>${help}` }), text: plain({ title: "Tu nueva oficina está lista", lines: [`La oficina «${officeName}» se creó en tu cuenta. También la verás en «Mis oficinas».`, "El enlace vale 30 minutos y se usa una sola vez."], cta, footer: FOOT_IGNORE }) }; }
    case "compra_confirmada": {
      const o = p.orderId ? (await db.query("SELECT plan,amount_total,currency FROM orders WHERE id=$1", [p.orderId]))[0] : null; const monto = o?.amount_total != null ? `${String(o.currency ?? "").toUpperCase()} ${(Number(o.amount_total) / 100).toFixed(2)}` : null; const plan = o ? planOf(o.plan).label : "";
      const lines = [`Confirmamos tu pago${monto ? ` de ${monto}` : ""}.`, ...(plan ? [`Plan: ${plan}.`] : []), `Oficina: ${officeName}.`, "En otro correo te llega tu enlace de acceso."];
      return { subject: "Confirmación de tu compra en Crea tu Oficina IA", html: layout({ site: s, preheader: "Tu pago está confirmado.", title: "Pago confirmado", blocks: [{ p: `Gracias. Confirmamos tu pago${monto ? ` de <strong>${esc(monto)}</strong>` : ""}.` }, { list: [...(plan ? [`Plan: <strong>${esc(plan)}</strong>`] : []), `Oficina: <strong>${esc(officeName)}</strong>`, "Suscripción mensual: puedes pausarla o cancelarla al final del periodo desde «Mis oficinas»."] }, { note: "Tu enlace de acceso llega en un correo aparte. Tu comprobante de Stripe está disponible en «Pagos y comprobantes»." }], footerNote: help }), text: plain({ title: "Pago confirmado", lines, footer: `Ayuda: ${s}/ayuda/tutoriales#soporte` }) }; }
    case "pago_fallido": { const cta = { label: "Actualizar forma de pago", url: `${s}/oficinas` }; return { subject: `No pudimos cobrar la suscripción de «${officeName}»`, html: layout({ site: s, preheader: "Actualiza tu forma de pago para que no se detenga el servicio.", title: "No pudimos cobrar tu mensualidad", blocks: [{ p: `No pudimos procesar el último pago de <strong>${esc(officeName)}</strong>.` }, { p: "Entra a «Mis oficinas» y usa «Pagos y comprobantes» para actualizar tu forma de pago y evitar que se detenga el servicio." }], cta, footerNote: help }), text: plain({ title: "No pudimos cobrar tu mensualidad", lines: [`No pudimos procesar el último pago de «${officeName}».`, "Actualiza tu forma de pago desde «Mis oficinas» → «Pagos y comprobantes»."], cta, footer: `Ayuda: ${s}/ayuda/tutoriales#soporte` }) }; }
    case "oficina_cancelada": { const cta = { label: "Ver mis oficinas", url: `${s}/oficinas` }; return { subject: `La suscripción de «${officeName}» terminó`, html: layout({ site: s, preheader: "Tus datos se conservan.", title: "Tu suscripción terminó", blocks: [{ p: `La suscripción de <strong>${esc(officeName)}</strong> ya no está activa. Sus empleados dejaron de trabajar.` }, { note: "Tus datos se conservan. Puedes crear una oficina nueva cuando quieras." }], cta, footerNote: help }), text: plain({ title: "Tu suscripción terminó", lines: [`La suscripción de «${officeName}» ya no está activa. Tus datos se conservan.`], cta, footer: `Ayuda: ${s}/ayuda/tutoriales#soporte` }) }; }
    case "seguridad": { const cuando = p.cuando ? new Date(p.cuando).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }) + " (hora de Ciudad de México)" : "hace unos momentos"; return { subject: "Aviso de seguridad: se inició sesión en tu cuenta", html: layout({ site: s, preheader: "Se inició sesión con un enlace de acceso.", title: "Se inició sesión en tu cuenta", blocks: [{ p: `Se inició sesión en tu cuenta de Crea tu Oficina IA con un enlace de acceso: <strong>${esc(cuando)}</strong>.` }, { p: "Si fuiste tú, no tienes que hacer nada." }, { note: "Si no fuiste tú: avísanos de inmediato desde el centro de ayuda. Los enlaces de acceso son de un solo uso y solo llegan a tu correo." }], footerNote: help }), text: plain({ title: "Se inició sesión en tu cuenta", lines: [`Se inició sesión con un enlace de acceso: ${cuando}.`, "Si fuiste tú, no tienes que hacer nada.", "Si no fuiste tú, avísanos desde el centro de ayuda."], footer: `Ayuda: ${s}/ayuda/tutoriales#soporte` }) }; }
  }
}

export interface ProcessResult { sent: number; failed: number; skipped: number }
/** Entrega los correos en cola al proveedor (reintenta hasta 5 veces con espera). Idempotente por fila; el enlace se arma al enviar y no se guarda. */
export async function processEmails(db: Db, provider: MailProvider | null = mailProvider(), limit = 20): Promise<ProcessResult> {
  if (!provider) { // SIN proveedor: no se pierde nada, pero ahora SE DICE el motivo en cada correo pendiente (antes fallaba en silencio)
    const r = await db.query("UPDATE emails SET last_error='Sin proveedor de correo configurado (faltan RESEND_API_KEY y/o MAIL_FROM en el servidor).' WHERE status='en_cola' AND last_error IS DISTINCT FROM 'Sin proveedor de correo configurado (faltan RESEND_API_KEY y/o MAIL_FROM en el servidor).' RETURNING id");
    return { sent: 0, failed: 0, skipped: Number((await db.query<{ n: string }>("SELECT count(*) n FROM emails WHERE status='en_cola'"))[0].n) + 0 * r.length };
  }
  let sent = 0, failed = 0; const seen: string[] = []; // cada correo se intenta UNA vez por pasada y queda «arrendado» 5 min mientras se envía (si dos procesos corren a la vez, no lo envían dos veces)
  for (let i = 0; i < limit; i++) {
    const row = (await db.query(`UPDATE emails SET attempts=attempts+1, retry_at=now() + interval '5 minutes' WHERE id = (SELECT id FROM emails WHERE status='en_cola' AND attempts < 5 AND retry_at <= now() AND id <> ALL($1::text[]) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,to_email,kind,payload,attempts`, [seen]))[0];
    if (!row) break; seen.push(row.id);
    try {
      const m = await render(db, row as any); const pid = await provider.send({ to: row.to_email, ...m });
      await db.query("UPDATE emails SET status='enviado', sent_at=now(), provider_id=$2, last_error=NULL, provider_status=200, delivery_status=COALESCE(delivery_status,'aceptado') WHERE id=$1", [row.id, pid]); sent++;
    } catch (e: any) {
      const st = e instanceof MailError ? e.status : null; const msg = e instanceof MailError ? `${e.status ? e.status + " " : ""}${e.code}: ${e.message}` : String(e?.message ?? e);
      await db.query("UPDATE emails SET status=CASE WHEN attempts>=5 THEN 'error' ELSE 'en_cola' END, last_error=$2, provider_status=$3, retry_at=now() + (attempts * interval '2 minutes') WHERE id=$1", [row.id, msg.slice(0, 300), st]); failed++;
    }
  }
  return { sent, failed, skipped: 0 };
}
/** Reintento MANUAL de un correo fallido (máx. 3 por correo). */
export async function retryEmail(db: Db, id: string): Promise<boolean> {
  const r = await db.query("UPDATE emails SET status='en_cola', attempts=0, retry_at=now(), manual_retries=manual_retries+1 WHERE id=$1 AND status='error' AND manual_retries < 3 RETURNING id", [id]); return r.length > 0;
}
export async function retryAllFailed(db: Db): Promise<number> {
  return (await db.query("UPDATE emails SET status='en_cola', attempts=0, retry_at=now(), manual_retries=manual_retries+1 WHERE status='error' AND manual_retries < 3 RETURNING id")).length;
}

// ---------- Estado de entrega real: webhook firmado del proveedor (formato Svix, el que usa Resend) ----------
/** Verifica la firma. Secreto `whsec_<base64>`; firma = base64(HMAC-SHA256(`${id}.${timestamp}.${cuerpo}`)); tolerancia de 5 minutos. */
export function verifyDeliveryWebhook(raw: string, h: Record<string, string>, secret: string | undefined, now = Date.now()): boolean {
  if (!secret) return false; const id = h["svix-id"], ts = h["svix-timestamp"], sigs = h["svix-signature"]; if (!id || !ts || !sigs || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64"); const exp = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  return sigs.split(" ").map((s) => s.split(",")[1]).filter(Boolean).some((s) => s.length === exp.length && timingSafeEqual(Buffer.from(s), Buffer.from(exp)));
}
const STATUS_RANK: Record<string, number> = { aceptado: 0, sent: 1, delivery_delayed: 2, delivered: 3, bounced: 4, complained: 5, failed: 4 };
/** Guarda el estado de entrega. Un estado «peor/más final» no se pisa con uno anterior que llegue tarde (los webhooks no llegan en orden). */
export async function applyDeliveryEvent(db: Db, ev: any): Promise<"actualizado" | "ignorado"> {
  const type = String(ev?.type ?? ""); const m = type.match(/^email\.(sent|delivered|delivery_delayed|bounced|complained|failed)$/); const pid = String(ev?.data?.email_id ?? ""); if (!m || !pid) return "ignorado";
  const st = m[1]; const detail = String(ev?.data?.bounce?.message ?? ev?.data?.failed?.reason ?? ev?.data?.reason ?? "").slice(0, 200) || null;
  const cur = (await db.query("SELECT delivery_status FROM emails WHERE provider_id=$1", [pid]))[0]; if (!cur) return "ignorado";
  if ((STATUS_RANK[cur.delivery_status ?? "aceptado"] ?? 0) > (STATUS_RANK[st] ?? 0)) return "ignorado";
  await db.query("UPDATE emails SET delivery_status=$2, delivery_at=now(), delivery_detail=$3 WHERE provider_id=$1", [pid, st, detail]); return "actualizado";
}
