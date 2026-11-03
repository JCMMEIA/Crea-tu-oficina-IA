import { createHash } from "node:crypto";
import { Db, newId } from "../db";
import { Adapters, MAX_TEXT, Channel } from "./types";
import { enqueue } from "./queue";
import { Identity, Prefs } from "./link";
import { getSettings } from "./settings";

export type NotifyKind = "reply" | "task_done" | "error" | "approval" | "alert" | "digest";
export const MAX_OUT_PER_HOUR = 30;
const PREF_KEY: Record<NotifyKind, keyof Prefs | null> = { reply: null, task_done: "task_done", error: "errors", approval: "approvals", alert: "alerts", digest: null };
export const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

export function chunk(text: string, max = MAX_TEXT, maxParts = 3): string[] {
  const t = clean(text); if (t.length <= max) return [t];
  const parts: string[] = []; let rest = t;
  while (rest.length > max && parts.length < maxParts - 1) { let cut = rest.lastIndexOf("\n", max); if (cut < max * 0.5) cut = max; parts.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart(); }
  parts.push(rest.length > max ? rest.slice(0, max - 40) + "\n…(continúa en la aplicación)" : rest);
  return parts;
}

/** Encola mensajes saliendo por la bandeja: idempotente por `dedupeKey`, con trabajo de envío (reintentos). Devuelve cuántos son nuevos. */
export async function queueOutbound(db: Db, to: { identity?: Identity; channel: Channel; external?: string }, kind: NotifyKind, text: string, dedupeKey: string, inReplyTo?: string): Promise<number> {
  const parts = chunk(text); let created = 0;
  for (let i = 0; i < parts.length; i++) {
    const id = newId();
    const r = await db.query("INSERT INTO outbox(id,identity_id,to_external,channel,kind,text,dedupe_key,in_reply_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id",
      [id, to.identity?.id ?? null, to.identity ? null : to.external ?? null, to.channel, kind, parts[i], `${dedupeKey}#${i}`, inReplyTo ?? null]);
    if (r.length) { created++; await enqueue(db, "send_outbox", { outboxId: id }, { dedupeKey: `send:${id}`, maxAttempts: 4 }); }
  }
  return created;
}

/** ¿Quiere este usuario recibir este tipo de aviso? (Las respuestas directas a sus mensajes siempre se envían.) */
export const wants = (prefs: Prefs, kind: NotifyKind) => { const k = PREF_KEY[kind]; return k === null ? kind !== "digest" || prefs.digest === "daily" : !!prefs[k]; };

export async function notifyIdentity(db: Db, identity: Identity, kind: NotifyKind, text: string, dedupeKey: string): Promise<"queued" | "muted" | "duplicate"> {
  if (identity.status !== "active") return "muted";
  if (!wants(identity.prefs, kind)) return "muted";
  const created = await queueOutbound(db, { identity, channel: identity.channel }, kind, text, dedupeKey);
  return created ? "queued" : "duplicate";
}

export interface DeliverDeps { adapters: Adapters; now?: Date }
/** Entrega una fila de la bandeja respetando consentimiento, límites de frecuencia y la ventana de 24 h de WhatsApp. Lanza error si debe reintentarse. */
export async function deliverOutbox(db: Db, outboxId: string, deps: DeliverDeps): Promise<"sent" | "skipped" | "failed"> {
  const now = deps.now ?? new Date();
  const o = (await db.query("SELECT * FROM outbox WHERE id=$1", [outboxId]))[0];
  if (!o || o.status !== "pending") return "skipped";
  const skip = async (why: string) => { await db.query("UPDATE outbox SET status='skipped', last_error=$2 WHERE id=$1", [outboxId, why]); return "skipped" as const; };
  let to = o.to_external as string | null; let identity: Identity | undefined;
  if (o.identity_id) {
    identity = (await db.query<Identity>("SELECT * FROM channel_identities WHERE id=$1", [o.identity_id]))[0];
    if (!identity || identity.status !== "active") return skip("canal revocado");
    if (!identity.consent_at) return skip("sin consentimiento");
    to = identity.external_id;
    if (o.kind !== "reply" && !wants(identity.prefs, o.kind)) return skip("silenciado por preferencias");
    const sent = Number((await db.query<{ n: string }>("SELECT count(*) n FROM outbox WHERE identity_id=$1 AND status='sent' AND sent_at > $2", [identity.id, new Date(now.getTime() - 3600_000)]))[0].n);
    if (sent >= MAX_OUT_PER_HOUR) return skip("límite de mensajes por hora");
    if (o.kind !== "reply") {
      const ag = (await db.query("SELECT c.agency_id FROM companies c WHERE c.id=$1", [identity.active_company_id]))[0] ?? (await db.query("SELECT agency_id FROM agency_members WHERE user_id=$1 LIMIT 1", [identity.user_id]))[0];
      if (ag) {
        const st = await getSettings(db, ag.agency_id);
        const today = Number((await db.query<{ n: string }>("SELECT count(*) n FROM outbox WHERE identity_id=$1 AND kind<>'reply' AND status='sent' AND sent_at > $2", [identity.id, new Date(now.getTime() - 86400_000)]))[0].n);
        if (today >= st.maxNotificationsPerDay) return skip("límite diario de avisos de la agencia");
        if (o.kind === "digest" && !st.allowDigest) return skip("resumen deshabilitado por la agencia");
      }
    }
  }
  const adapter = deps.adapters[o.channel as Channel];
  if (!adapter?.configured()) { await db.query("UPDATE outbox SET status='failed', last_error='canal no configurado' WHERE id=$1", [outboxId]); return "failed"; }
  let template: { name: string; lang: string; params: string[] } | undefined;
  if (o.channel === "whatsapp" && o.kind !== "reply") {
    const open = identity?.last_inbound_at && now.getTime() - new Date(identity.last_inbound_at).getTime() < 24 * 3600_000;
    if (!open) {
      const name = process.env.WHATSAPP_TEMPLATE_NOTIFY;
      if (!name) return skip("fuera de la ventana de 24 h y sin plantilla aprobada configurada (WHATSAPP_TEMPLATE_NOTIFY)");
      template = { name, lang: process.env.WHATSAPP_TEMPLATE_LANG || "es", params: [clean(o.text).replace(/\s+/g, " ").slice(0, 900)] };
    }
  }
  await db.query("UPDATE outbox SET attempts=attempts+1 WHERE id=$1", [outboxId]);
  const r = await adapter.send(to!, o.text, template ? { template } : undefined);
  if (r.ok) {
    await db.query("UPDATE outbox SET status='sent', sent_at=now(), external_msg_id=$2, last_error=NULL WHERE id=$1", [outboxId, r.externalMsgId ?? null]);
    await db.query("INSERT INTO channel_messages(channel,direction,external_msg_id,identity_id,user_id,external_id,kind,text,status) VALUES($1,'out',$2,$3,$4,$5,$6,$7,'sent') ON CONFLICT DO NOTHING",
      [o.channel, r.externalMsgId || `ob:${outboxId}`, identity?.id ?? null, identity?.user_id ?? null, to, o.kind, o.text.slice(0, 500)]);
    return "sent";
  }
  if (r.retryable) { await db.query("UPDATE outbox SET last_error=$2 WHERE id=$1", [outboxId, r.error ?? null]); throw new Error(r.error ?? "Error de envío"); }
  await db.query("UPDATE outbox SET status='failed', last_error=$2 WHERE id=$1", [outboxId, r.error ?? null]);
  return "failed";
}

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const hashShort = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);
