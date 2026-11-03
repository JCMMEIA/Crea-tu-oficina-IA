import { createHmac } from "node:crypto";
import { ChannelAdapter, InboundMessage, SendOptions, SendResult } from "../types";
import { safeEq } from "./telegram";

/**
 * WhatsApp Business Platform (Cloud API). NO verificado contra Meta ni su documentación en esta sesión.
 * Requisitos externos (a verificar en la documentación vigente): cuenta de Meta Business, app con producto WhatsApp, número de teléfono
 * registrado en la Cloud API, token permanente (usuario del sistema), webhook suscrito a «messages», verificación de empresa para escalar.
 * Reglas de mensajería: respuesta libre dentro de las 24 h posteriores al último mensaje del usuario; fuera de esa ventana, solo plantillas aprobadas.
 */
export function verifyWhatsAppSignature(rawBody: string, header: string | null, appSecret = process.env.WHATSAPP_APP_SECRET): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEq(header.slice(7), expected);
}
/** Verificación del webhook (GET): devuelve el `challenge` solo si el token coincide. */
export function whatsappChallenge(params: URLSearchParams, verifyToken = process.env.WHATSAPP_VERIFY_TOKEN): string | null {
  const tok = params.get("hub.verify_token");
  return params.get("hub.mode") === "subscribe" && verifyToken && tok && safeEq(tok, verifyToken) ? params.get("hub.challenge") : null;
}

export function parseWhatsAppPayload(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const e of body?.entry ?? []) for (const c of e?.changes ?? []) {
    const v = c?.value; if (!v?.messages) continue; // «statuses» (entregas) se ignoran aquí
    for (const m of v.messages) {
      if (!m?.id || !m?.from) continue;
      const base = { channel: "whatsapp" as const, externalMsgId: String(m.id), externalId: String(m.from), display: "", at: new Date(Number(m.timestamp) * 1000 || Date.now()) };
      if (m.type === "text" && typeof m.text?.body === "string") out.push({ ...base, kind: "text", text: m.text.body });
      else if (m.type === "audio") out.push({ ...base, kind: m.audio?.voice ? "voice" : "audio", text: "", attachment: { mime: m.audio?.mime_type } });
      else if (m.type === "image") out.push({ ...base, kind: "image", text: String(m.image?.caption ?? ""), attachment: { mime: m.image?.mime_type } });
      else if (m.type === "document") out.push({ ...base, kind: "document", text: String(m.document?.caption ?? ""), attachment: { mime: m.document?.mime_type, name: m.document?.filename } });
      else out.push({ ...base, kind: "other", text: "" });
    }
  }
  return out;
}

export class WhatsAppAdapter implements ChannelAdapter {
  channel = "whatsapp" as const;
  configured() { return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN); }
  async send(to: string, text: string, opts?: SendOptions): Promise<SendResult> {
    const ver = process.env.WHATSAPP_API_VERSION || "v21.0";
    const body = opts?.template
      ? { messaging_product: "whatsapp", to, type: "template", template: { name: opts.template.name, language: { code: opts.template.lang }, components: [{ type: "body", parameters: opts.template.params.map((p) => ({ type: "text", text: p })) }] } }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } };
    try {
      const r = await fetch(`${process.env.WHATSAPP_API_BASE || "https://graph.facebook.com"}/${ver}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, externalMsgId: String(j.messages?.[0]?.id ?? "") };
      return { ok: false, error: `WhatsApp ${r.status}: ${String(j.error?.message ?? "").slice(0, 120)}`, retryable: r.status === 429 || r.status >= 500 };
    } catch (e: any) { return { ok: false, error: `Red: ${e.message}`, retryable: true }; }
  }
}
