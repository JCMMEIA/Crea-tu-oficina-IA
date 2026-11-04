import { getDb } from "@/server/db";
import { applyDeliveryEvent, verifyDeliveryWebhook } from "@/server/commerce/mail";

/** Estado de entrega REAL del correo (Resend → webhook firmado). Sin RESEND_WEBHOOK_SECRET responde 404 y no hace nada. */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET; if (!secret) return new Response("No encontrado", { status: 404 });
  const raw = await req.text(); const h: Record<string, string> = {}; req.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  if (!verifyDeliveryWebhook(raw, h, secret)) return new Response("Firma inválida", { status: 400 });
  try { const r = await applyDeliveryEvent(await getDb(), JSON.parse(raw)); return Response.json({ ok: true, r }); } catch { return new Response("Error", { status: 500 }); }
}
