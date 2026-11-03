import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./billing";
import { isPlanKey, planPriceInfo, PLANS, PlanKey } from "../agency/plans";

/**
 * Stripe (Checkout + webhook) escrito contra la documentación pública de Stripe. NO VERIFICADO contra la API real: no hay claves de prueba en esta sesión.
 * Seguridad: solo acepta claves de PRUEBA (sk_test_…) salvo que se ponga STRIPE_ALLOW_LIVE=yes de forma explícita; así no se puede cobrar por accidente.
 */
export const stripeBase = () => process.env.STRIPE_API_BASE || "https://api.stripe.com";
export function stripeKeyOk(key: string | undefined): key is string {
  if (!key || !/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) return false;
  return key.startsWith("sk_test_") || process.env.STRIPE_ALLOW_LIVE === "yes";
}
/** Firma de Stripe: `t=<unix>,v1=<hmac_sha256(secret, t + "." + cuerpo)>`. Rechaza firmas malas y mensajes de más de 5 minutos (repetición). */
export function verifyStripeSignature(raw: string, header: string, secret: string, now = Date.now()): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t); const v1 = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  if (!Number.isFinite(t) || !v1.length || Math.abs(now / 1000 - t) > 300) return false;
  const exp = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return v1.some((sig) => sig.length === exp.length && timingSafeEqual(Buffer.from(sig), Buffer.from(exp)));
}
export function stripeProviderFromEnv(): PaymentProvider | null {
  const key = process.env.STRIPE_SECRET_KEY, whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKeyOk(key) || !whsec) return null;
  return {
    name: key.startsWith("sk_test_") ? "stripe (modo pruebas)" : "stripe (REAL)",
    async createCheckout({ agencyId, plan, successUrl, cancelUrl }) {
      const price = planPriceInfo(plan);
      if (!price || price.currency !== "MXN") throw new Error("Falta el precio del plan en pesos (PLAN_PRICE_MXN_…).");
      const f = new URLSearchParams({
        mode: "subscription", success_url: successUrl, cancel_url: cancelUrl, client_reference_id: agencyId,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "mxn", "line_items[0][price_data][unit_amount]": String(Math.round(price.amount * 100)),
        "line_items[0][price_data][recurring][interval]": "month", "line_items[0][price_data][product_data][name]": `Crea tu Oficina IA — plan ${PLANS[plan].label}`,
        "metadata[agency_id]": agencyId, "metadata[plan]": plan, "subscription_data[metadata][agency_id]": agencyId, "subscription_data[metadata][plan]": plan,
      });
      const r = await fetch(`${stripeBase()}/v1/checkout/sessions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.url !== "string") throw new Error("No se pudo abrir el pago. Inténtalo más tarde.");
      return { url: j.url };
    },
    async parseWebhook(raw, headers) {
      const sig = headers["stripe-signature"] ?? "";
      if (!verifyStripeSignature(raw, sig, whsec)) throw new Error("Firma de pago inválida.");
      const ev = JSON.parse(raw); const o = ev?.data?.object ?? {}; const m = o.metadata ?? {};
      const plan = String(m.plan ?? ""); const agencyId = String(m.agency_id ?? o.client_reference_id ?? "");
      if (!agencyId) throw new Error("Evento sin agencia.");
      if (ev.type === "checkout.session.completed" && o.payment_status === "paid" && isPlanKey(plan)) return { type: "paid" as const, agencyId, plan: plan as PlanKey, externalId: String(ev.id) };
      if (ev.type === "customer.subscription.deleted") return { type: "cancelled" as const, agencyId, plan: (isPlanKey(plan) ? plan : "prueba") as PlanKey, externalId: String(ev.id) };
      throw new Error("IGNORE"); // otros eventos: se acusan recibo sin hacer nada
    },
  };
}
