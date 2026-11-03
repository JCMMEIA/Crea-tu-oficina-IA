export type Channel = "telegram" | "whatsapp";
export type InboundKind = "text" | "voice" | "audio" | "image" | "document" | "other";

/** Mensaje entrante ya autenticado por el adaptador (firma/secreto verificados) y normalizado. */
export interface InboundMessage {
  channel: Channel; externalMsgId: string; externalId: string; display: string; kind: InboundKind; text: string; at: Date;
  attachment?: { mime?: string; size?: number; name?: string };
}
export interface SendResult { ok: boolean; externalMsgId?: string; error?: string; retryable?: boolean }
export interface SendOptions { template?: { name: string; lang: string; params: string[] } }

/** Adaptador por canal. La app habla con esta interfaz; Telegram y WhatsApp son implementaciones. */
export interface ChannelAdapter {
  channel: Channel;
  configured(): boolean;
  send(to: string, text: string, opts?: SendOptions): Promise<SendResult>;
}
export type Adapters = Partial<Record<Channel, ChannelAdapter>>;
export const MAX_TEXT = 3500; // por debajo del límite de 4096 de ambos canales
