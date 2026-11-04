import { getDb } from "@/server/db";
import { getPaymentProvider } from "@/server/commercial/billing";
import { attachSession, createIntent } from "@/server/commerce/orders";
import { offerPlan, purchasesOpen } from "@/server/commerce/gate";
import { deriveSource, pickUtm } from "@/server/leads";

/** «Crear mi oficina IA»: crea la intención de compra (sin cuenta) y redirige DIRECTO al pago de Stripe. Si la tienda no está lista, vuelve a la landing con aviso honesto. */
export async function GET(req: Request) {
  const u = new URL(req.url); const site = (process.env.NEXT_PUBLIC_SITE_URL || u.origin).replace(/\/$/, "");
  const back = (c: string) => Response.redirect(`${site}/?compra=${c}#oferta`, 303);
  try {
    const db = await getDb(); if (!(await purchasesOpen(db)).open) return back("cerrada");
    const p = getPaymentProvider(); if (!p?.createPublicCheckout) return back("cerrada");
    const utm = pickUtm(Object.fromEntries(u.searchParams)); const source = (u.searchParams.get("fuente") || "").toLowerCase().slice(0, 60) || deriveSource(utm);
    const intentId = await createIntent(db, { plan: offerPlan(), kind: "primera", source, utm });
    const c = await p.createPublicCheckout({ intentId, plan: offerPlan(), successUrl: `${site}/comprar/gracias`, cancelUrl: `${site}/?compra=cancelada#oferta` });
    await attachSession(db, intentId, c.sessionId);
    return Response.redirect(c.url, 303);
  } catch { return back("error"); }
}
