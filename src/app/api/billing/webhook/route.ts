import { getDb } from "@/server/db";
import { handlePaymentWebhook } from "@/server/commercial/billing";

/** Webhook de la pasarela. Con cobros apagados responde 404 y no toca nada. La firma se valida dentro del proveedor. */
export async function POST(req: Request) {
  const raw = await req.text();
  const headers: Record<string, string> = {}; req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  try { const r = await handlePaymentWebhook(await getDb(), raw, headers); return Response.json({ ok: true, r }); }
  catch (e: any) { const off = /desactivados/.test(e?.message); return new Response(off ? "No encontrado" : "Rechazado", { status: off ? 404 : 400 }); }
}
