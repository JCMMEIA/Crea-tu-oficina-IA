import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http"; import { createHmac } from "node:crypto";
import { Db } from "@/server/db";
import { login, signupAgency, agencyActorFromToken, AgencyActor } from "@/server/auth";
import { billingEnabled, billingStatus, entitlements, handlePaymentWebhook, registerPaymentProvider, startCheckout } from "@/server/commercial/billing";
import { stripeKeyOk, verifyStripeSignature } from "@/server/commercial/stripe";
import { newDb } from "./helpers";

const OLD = { ...process.env }; let db: Db; let srv: http.Server; let lastBody = ""; let lastAuth = "";
const WH = "whsec_prueba_123";
const sign = (raw: string, t = Math.floor(Date.now() / 1000), secret = WH) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;
async function agency(): Promise<AgencyActor> { await signupAgency(db, { email: "a@x.com", name: "A", password: "clave-larga-123", agencyName: "Ag" }); return (await agencyActorFromToken(db, await login(db, "a@x.com", "clave-larga-123")))!; }
const ev = (id: string, type: string, a: AgencyActor, extra: any = {}) => JSON.stringify({ id, type, data: { object: { client_reference_id: a.agencyId, metadata: { agency_id: a.agencyId, plan: "agencia" }, payment_status: "paid", ...extra } } });
beforeEach(async () => {
  db = await newDb(); registerPaymentProvider(null);
  await new Promise<void>((r) => { srv = http.createServer((q, s) => { let b = ""; q.on("data", (d) => (b += d)); q.on("end", () => { lastBody = b; lastAuth = String(q.headers.authorization); s.setHeader("content-type", "application/json"); s.end(JSON.stringify({ url: "https://checkout.stripe.test/c/abc" })); }); }).listen(0, "127.0.0.1", r); });
  Object.assign(process.env, { BILLING_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_WEBHOOK_SECRET: WH, STRIPE_API_BASE: `http://127.0.0.1:${(srv.address() as any).port}`, PLAN_PRICE_MXN_AGENCIA: "899" });
});
afterEach(() => { srv.close(); process.env = { ...OLD }; });

describe("Stripe en MODO PRUEBAS (contra un servidor Stripe simulado; NO contra Stripe real)", () => {
  it("claves: acepta sk_test; rechaza sk_live salvo STRIPE_ALLOW_LIVE=yes; rechaza basura", () => {
    expect(stripeKeyOk("sk_test_abc")).toBe(true); expect(stripeKeyOk("sk_live_abc")).toBe(false); expect(stripeKeyOk("pk_test_abc")).toBe(false); expect(stripeKeyOk("")).toBe(false);
    process.env.STRIPE_ALLOW_LIVE = "yes"; expect(stripeKeyOk("sk_live_abc")).toBe(true);
  });
  it("con una clave REAL (live) y sin permiso explícito, los cobros siguen apagados", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123"; expect(billingEnabled()).toBe(false);
  });
  it("sin la bandera BILLING_ENABLED nada se enciende aunque haya claves", () => { process.env.BILLING_ENABLED = "false"; expect(billingEnabled()).toBe(false); });
  it("firma: válida pasa; cuerpo alterado, secreto distinto, firma vieja o sin firma fallan", () => {
    const raw = '{"a":1}'; expect(verifyStripeSignature(raw, sign(raw), WH)).toBe(true);
    expect(verifyStripeSignature(raw + " ", sign(raw), WH)).toBe(false); expect(verifyStripeSignature(raw, sign(raw, undefined, "otro"), WH)).toBe(false);
    expect(verifyStripeSignature(raw, sign(raw, Math.floor(Date.now() / 1000) - 4000), WH)).toBe(false); expect(verifyStripeSignature(raw, "", WH)).toBe(false);
  });
  it("checkout: manda importe en centavos MXN, mensual, con agencia y plan; devuelve el enlace", async () => {
    const a = await agency(); expect(billingStatus().provider).toMatch(/pruebas/);
    expect(await startCheckout(db, a, "agencia", { success: "https://s", cancel: "https://c" })).toEqual({ mode: "pago", url: "https://checkout.stripe.test/c/abc" });
    const f = new URLSearchParams(lastBody); expect(lastAuth).toBe("Bearer sk_test_abc123");
    expect(f.get("line_items[0][price_data][unit_amount]")).toBe("89900"); expect(f.get("line_items[0][price_data][currency]")).toBe("mxn"); expect(f.get("mode")).toBe("subscription");
    expect(f.get("metadata[agency_id]")).toBe(a.agencyId); expect(f.get("metadata[plan]")).toBe("agencia");
    expect((await entitlements(db, a)).plan).toBe("prueba"); // abrir el pago NO activa nada
  });
  it("sin precio en pesos no abre pago", async () => { delete process.env.PLAN_PRICE_MXN_AGENCIA; process.env.PLAN_PRICE_USD_AGENCIA = "49"; await expect(startCheckout(db, await agency(), "agencia")).rejects.toThrow(/pesos/); });
  it("webhook: pago firmado activa la licencia 'pasarela'; repetirlo no duplica; sin firma se rechaza", async () => {
    const a = await agency(); const raw = ev("evt_1", "checkout.session.completed", a);
    await expect(handlePaymentWebhook(db, raw, {})).rejects.toThrow(/firma/i); await expect(handlePaymentWebhook(db, raw, { "stripe-signature": sign(raw, undefined, "malo") })).rejects.toThrow();
    expect((await entitlements(db, a)).plan).toBe("prueba");
    expect(await handlePaymentWebhook(db, raw, { "stripe-signature": sign(raw) })).toBe("procesado");
    expect(await handlePaymentWebhook(db, raw, { "stripe-signature": sign(raw) })).toBe("repetido");
    const e = await entitlements(db, a); expect(e.plan).toBe("agencia"); expect(e.license?.origin).toBe("pasarela");
    expect(Number((await db.query("SELECT count(*) n FROM licenses WHERE agency_id=$1", [a.agencyId]))[0].n)).toBe(1);
  });
  it("pago no completado y eventos ajenos no activan nada; la cancelación vuelve a prueba", async () => {
    const a = await agency();
    const unpaid = ev("evt_2", "checkout.session.completed", a, { payment_status: "unpaid" }); expect(await handlePaymentWebhook(db, unpaid, { "stripe-signature": sign(unpaid) })).toBe("ignorado");
    const other = ev("evt_3", "invoice.created", a); expect(await handlePaymentWebhook(db, other, { "stripe-signature": sign(other) })).toBe("ignorado");
    expect((await entitlements(db, a)).plan).toBe("prueba");
    const paid = ev("evt_4", "checkout.session.completed", a); await handlePaymentWebhook(db, paid, { "stripe-signature": sign(paid) });
    const cancel = ev("evt_5", "customer.subscription.deleted", a); await handlePaymentWebhook(db, cancel, { "stripe-signature": sign(cancel) });
    const e = await entitlements(db, a); expect(e.plan).toBe("prueba"); expect(e.license?.status).toBe("cancelada");
  });
  it("con cobros apagados el webhook se rechaza", async () => { process.env.BILLING_ENABLED = "false"; await expect(handlePaymentWebhook(db, "{}", {})).rejects.toThrow(/desactivados/); });
});
