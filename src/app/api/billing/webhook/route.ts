import { getDb } from "@/server/db";
import { after } from "next/server";
import { handlePaymentWebhook } from "@/server/commercial/billing";
import { processEmails } from "@/server/commerce/mail";

/** Webhook de la pasarela. Con cobros apagados responde 404 y no toca nada. La firma se valida dentro del proveedor. */
export async function POST(req: Request) {
  const raw = await req.text();
  const headers: Record<string, string> = {}; req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  try { const db = await getDb(); const r = await handlePaymentWebhook(db, raw, headers); after(() => processEmails(db).catch(() => {})); return Response.json({ ok: true, r }); }
  catch (e: any) { const off = /desactivados/.test(e?.message); return new Response(off ? "No encontrado" : "Rechazado", { status: off ? 404 : 400 }); }
}
