import { Db } from "../db";
import { deliverPaidCheckout } from "./orders";
import { queueEmail } from "./mail";

const ts = (s: unknown) => (s ? new Date(Number(s) * 1000).toISOString() : null);

/** Lleva el estado de la suscripción de Stripe a la oficina. «pausada» (decisión del dueño) es independiente y se respeta. */
export async function applySubscriptionState(db: Db, subId: string) {
  const s = (await db.query("SELECT * FROM subscriptions WHERE id=$1", [subId]))[0]; if (!s?.agency_id) return;
  const ag = (await db.query("SELECT status FROM agencies WHERE id=$1", [s.agency_id]))[0]; if (!ag) return;
  if (["canceled", "unpaid", "incomplete_expired"].includes(s.status)) {
    const was = ag.status;
    await db.query("UPDATE agencies SET status='cancelada', billing_status='cancelada' WHERE id=$1", [s.agency_id]);
    if (was !== "cancelada") { const o = (await db.query("SELECT u.email FROM agency_members m JOIN users u ON u.id=m.user_id WHERE m.agency_id=$1 AND m.role='agency_owner' LIMIT 1", [s.agency_id]))[0]; if (o) await queueEmail(db, { to: o.email, kind: "oficina_cancelada", payload: { agencyId: s.agency_id }, dedupeKey: `cancelada:${subId}` }); }
  } else if (s.status === "past_due") await db.query("UPDATE agencies SET billing_status='pago_pendiente' WHERE id=$1 AND status<>'cancelada'", [s.agency_id]);
  else if (["active", "trialing"].includes(s.status)) await db.query("UPDATE agencies SET billing_status='pagado' WHERE id=$1 AND status<>'cancelada'", [s.agency_id]);
}
/** Guarda el estado solo si el evento es MÁS NUEVO que el último aplicado (Stripe no garantiza el orden). */
async function upsertSub(db: Db, id: string, v: { status?: string; cancelAtEnd?: boolean; periodEnd?: string | null; customer?: string | null }, created: number): Promise<boolean> {
  await db.query("INSERT INTO subscriptions(id,customer_id,status,last_event_created) VALUES($1,$2,'active',0) ON CONFLICT (id) DO NOTHING", [id, v.customer ?? null]);
  const r = await db.query(`UPDATE subscriptions SET status=COALESCE($2,status), cancel_at_period_end=COALESCE($3,cancel_at_period_end), current_period_end=COALESCE($4,current_period_end),
    customer_id=COALESCE($5,customer_id), last_event_created=$6, updated_at=now() WHERE id=$1 AND last_event_created <= $6 RETURNING id`, [id, v.status ?? null, v.cancelAtEnd ?? null, v.periodEnd ?? null, v.customer ?? null, created]);
  return r.length > 0;
}

/** Eventos firmados de Stripe de la COMPRA DIRECTA. Devuelve «procesado» o «ignorado». */
export async function applyCommerceEvent(db: Db, ev: any): Promise<"procesado" | "ignorado"> {
  const o = ev?.data?.object ?? {}; const created = Number(ev?.created) || 0;
  switch (ev?.type) {
    case "checkout.session.completed": {
      const intentId = String(o.metadata?.intent_id ?? o.client_reference_id ?? "");
      if (!intentId || o.payment_status !== "paid" || o.mode !== "subscription") return "ignorado";
      await deliverPaidCheckout(db, { sessionId: String(o.id), intentId, email: o.customer_details?.email ?? o.customer_email, name: o.customer_details?.name, customerId: o.customer, subscriptionId: o.subscription, amountTotal: o.amount_total, currency: o.currency });
      return "procesado"; }
    case "invoice.paid": case "invoice.payment_failed": {
      const subId = String(o.subscription ?? ""); if (!subId) return "ignorado";
      const paid = ev.type === "invoice.paid";
      await db.query(`INSERT INTO invoices(id,subscription_id,agency_id,amount_paid,currency,status,hosted_invoice_url,period_end) VALUES($1,$2,(SELECT agency_id FROM subscriptions WHERE id=$2),$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET status=$5, amount_paid=$3, hosted_invoice_url=COALESCE($6,invoices.hosted_invoice_url)`, [String(o.id), subId, Number(o.amount_paid) || 0, o.currency ?? null, paid ? "paid" : "failed", o.hosted_invoice_url ?? null, ts(o.lines?.data?.[0]?.period?.end)]);
      if (await upsertSub(db, subId, { status: paid ? "active" : "past_due", customer: o.customer }, created)) {
        await applySubscriptionState(db, subId);
        if (!paid) { const a = (await db.query("SELECT m.agency_id, u.email FROM subscriptions s JOIN agency_members m ON m.agency_id=s.agency_id AND m.role='agency_owner' JOIN users u ON u.id=m.user_id WHERE s.id=$1 LIMIT 1", [subId]))[0]; if (a) await queueEmail(db, { to: a.email, kind: "pago_fallido", payload: { agencyId: a.agency_id }, dedupeKey: `pagofallido:${o.id}` }); }
      }
      return "procesado"; }
    case "customer.subscription.updated": case "customer.subscription.deleted": {
      const id = String(o.id ?? ""); if (!id) return "ignorado";
      const status = ev.type === "customer.subscription.deleted" ? "canceled" : String(o.status ?? "active");
      const pe = ts(o.current_period_end ?? o.items?.data?.[0]?.current_period_end);
      if (await upsertSub(db, id, { status, cancelAtEnd: !!o.cancel_at_period_end, periodEnd: pe, customer: o.customer }, created)) { await applySubscriptionState(db, id); return "procesado"; }
      return "ignorado"; }
    default: return "ignorado";
  }
}
