import { Db } from "../db";
import { ConnectorAdapter } from "../connectors";
import { handleInbound } from "./coordinator";
import { parseTelegramUpdate, verifyTelegramWebhook } from "./adapters/telegram";
import { parseWhatsAppPayload, verifyWhatsAppSignature, whatsappChallenge } from "./adapters/whatsapp";

export interface WebhookResult { status: number; body?: string }

/** Telegram: autentica con el secret_token del webhook. Siempre responde 200 tras aceptar (Telegram reintenta si no). */
export async function processTelegramWebhook(db: Db, headers: { get(k: string): string | null }, body: unknown, connector: ConnectorAdapter): Promise<WebhookResult> {
  if (!verifyTelegramWebhook(headers)) return { status: 401, body: "no autorizado" };
  const msg = parseTelegramUpdate(body);
  if (msg) await handleInbound(db, msg, { connector });
  return { status: 200, body: "ok" };
}

/** WhatsApp: autentica con la firma HMAC-SHA256 del cuerpo CRUDO (X-Hub-Signature-256). */
export async function processWhatsAppWebhook(db: Db, rawBody: string, signature: string | null, connector: ConnectorAdapter): Promise<WebhookResult> {
  if (!verifyWhatsAppSignature(rawBody, signature)) return { status: 401, body: "firma inválida" };
  let json: unknown; try { json = JSON.parse(rawBody); } catch { return { status: 400, body: "json inválido" }; }
  for (const m of parseWhatsAppPayload(json)) await handleInbound(db, m, { connector });
  return { status: 200, body: "ok" };
}
export const whatsappVerify = (params: URLSearchParams): WebhookResult => { const c = whatsappChallenge(params); return c ? { status: 200, body: c } : { status: 403, body: "verificación rechazada" }; };
