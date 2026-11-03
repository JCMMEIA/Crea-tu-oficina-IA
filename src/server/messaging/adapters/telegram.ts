import { timingSafeEqual } from "node:crypto";
import { ChannelAdapter, InboundMessage, SendResult } from "../types";

/**
 * Telegram Bot API. NO verificado contra el servicio real ni su documentación en esta sesión (sin token y sin acceso a core.telegram.org).
 * Webhook: se registra con `setWebhook` y un `secret_token`; Telegram lo reenvía en la cabecera X-Telegram-Bot-Api-Secret-Token.
 */
export const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function verifyTelegramWebhook(headers: { get(k: string): string | null }, secret = process.env.TELEGRAM_WEBHOOK_SECRET): boolean {
  const got = headers.get("x-telegram-bot-api-secret-token");
  return !!secret && !!got && safeEq(got, secret);
}

/** Solo chats PRIVADOS con el bot: grupos y canales se ignoran. La identidad es el id numérico de Telegram, jamás el @usuario. */
export function parseTelegramUpdate(body: any): InboundMessage | null {
  const m = body?.message; if (!m || body.update_id == null) return null;
  if (m.chat?.type !== "private" || m.from?.is_bot || m.from?.id == null) return null;
  const base = { channel: "telegram" as const, externalMsgId: String(body.update_id), externalId: String(m.from.id), display: String(m.from.first_name ?? "").slice(0, 40), at: new Date((m.date ?? 0) * 1000 || Date.now()) };
  if (typeof m.text === "string") return { ...base, kind: "text", text: m.text };
  if (m.voice) return { ...base, kind: "voice", text: "", attachment: { mime: m.voice.mime_type, size: m.voice.file_size } };
  if (m.audio) return { ...base, kind: "audio", text: "", attachment: { mime: m.audio.mime_type, size: m.audio.file_size } };
  if (m.photo) return { ...base, kind: "image", text: String(m.caption ?? ""), attachment: { size: m.photo.at(-1)?.file_size } };
  if (m.document) return { ...base, kind: "document", text: String(m.caption ?? ""), attachment: { mime: m.document.mime_type, size: m.document.file_size, name: m.document.file_name } };
  return { ...base, kind: "other", text: "" };
}

export class TelegramAdapter implements ChannelAdapter {
  channel = "telegram" as const;
  configured() { return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_WEBHOOK_SECRET; }
  async send(to: string, text: string): Promise<SendResult> {
    try {
      const r = await fetch(`${process.env.TELEGRAM_API_BASE || "https://api.telegram.org"}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: to, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000) });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return { ok: true, externalMsgId: String(j.result?.message_id ?? "") };
      return { ok: false, error: `Telegram ${r.status}: ${String(j.description ?? "").slice(0, 120)}`, retryable: r.status === 429 || r.status >= 500 };
    } catch (e: any) { return { ok: false, error: `Red: ${e.message}`, retryable: true }; }
  }
}
