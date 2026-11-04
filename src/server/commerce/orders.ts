import { Db, newId } from "../db";
import { AgencyActor, audit, createPasswordlessUser } from "../auth";
import { isPlanKey, PlanKey } from "../agency/plans";
import { attributeOrder } from "../affiliates";
import { chooseServices, hireInDemo, setStep } from "../onboarding";
import { getIndustry } from "../agency/industries";
import { queueEmail } from "./mail";

export interface OfficeConfig { officeName?: string; businessType?: string; services?: string[]; employees?: string[] }
const clean = (c: any): OfficeConfig => ({
  officeName: typeof c?.officeName === "string" ? c.officeName.trim().slice(0, 120) : undefined,
  businessType: typeof c?.businessType === "string" && getIndustry(c.businessType) ? c.businessType : undefined,
  services: Array.isArray(c?.services) ? c.services.map(String).slice(0, 12) : undefined,
  employees: Array.isArray(c?.employees) ? c.employees.map(String).slice(0, 12) : undefined,
});

/** Intención de compra: se crea antes de pagar; no crea cuenta, agencia ni acceso. */
export async function createIntent(db: Db, i: { plan: PlanKey; kind?: "primera" | "adicional"; userId?: string | null; email?: string | null; config?: OfficeConfig; source?: string; utm?: Record<string, string>; affiliateCode?: string | null }): Promise<string> {
  if (!isPlanKey(i.plan) || i.plan === "prueba") throw new Error("Plan no válido.");
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM checkout_intents WHERE created_at > now() - interval '1 hour'"))[0].n);
  if (n >= 300) throw new Error("Hay muchas compras en este momento. Inténtalo en unos minutos.");
  const id = newId();
  await db.query("INSERT INTO checkout_intents(id,email,user_id,kind,plan,config,source,utm,affiliate_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, i.email?.trim().toLowerCase() ?? null, i.userId ?? null, i.kind ?? "primera", i.plan, JSON.stringify(clean(i.config)), (i.source || "directo").slice(0, 60), JSON.stringify(i.utm ?? {}), (i.affiliateCode ?? "").trim().toUpperCase().slice(0, 16) || null]);
  return id;
}
export async function attachSession(db: Db, intentId: string, sessionId: string, url?: string) { await db.query("UPDATE checkout_intents SET checkout_session_id=$2, checkout_url=$3 WHERE id=$1", [intentId, sessionId, url ?? null]); }
/** Anti doble cobro: si la persona ya abrió un pago IGUAL hace menos de 20 minutos y no se ha pagado, se reutiliza ese mismo pago en vez de abrir otro. */
export async function reusableCheckoutUrl(db: Db, userId: string, config: OfficeConfig): Promise<string | null> {
  const r = await db.query(`SELECT i.checkout_url FROM checkout_intents i WHERE i.user_id=$1 AND i.kind='adicional' AND i.config=$2::jsonb AND i.checkout_url IS NOT NULL AND i.created_at > now() - interval '20 minutes'
    AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.checkout_session_id=i.checkout_session_id) ORDER BY i.created_at DESC LIMIT 1`, [userId, JSON.stringify(clean(config))]);
  return r[0]?.checkout_url ?? null;
}

/**
 * ÚNICA vía para crear oficinas de compradores: consume un derecho de creación (de un pago o de una cortesía). Atómico: dos intentos simultáneos → una sola oficina.
 * `t` debe ser una transacción si se quiere atomicidad con otras escrituras.
 */
export async function createOfficeFromRight(t: Db, rightId: string, o: { userId: string; name?: string; businessType?: string; subscriptionId?: string | null; customerId?: string | null; billingStatus?: string }): Promise<string> {
  const r = (await t.query("UPDATE office_rights SET used_at=now() WHERE id=$1 AND used_at IS NULL AND agency_id IS NULL RETURNING plan", [rightId]))[0];
  if (!r) throw new Error("Ese derecho de creación ya se usó o no existe.");
  const id = newId();
  await t.query("INSERT INTO agencies(id,name,plan,business_type,billing_status,stripe_subscription_id,external_customer_id) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, (o.name || "Mi oficina IA").slice(0, 120), r.plan, o.businessType ?? "", o.billingStatus ?? "pagado", o.subscriptionId ?? null, o.customerId ?? null]);
  await t.query("INSERT INTO agency_members(agency_id,user_id,role) VALUES($1,$2,'agency_owner')", [id, o.userId]);
  await t.query("UPDATE office_rights SET agency_id=$2 WHERE id=$1", [rightId, id]);
  await audit(t, { userId: o.userId }, "office.created", id, { rightId });
  return id;
}

/** Aplica lo que el comprador eligió antes de pagar (negocio, plantilla, empleados). Mejor esfuerzo: si falla, el asistente de configuración continúa igual. */
export async function provisionOffice(db: Db, agencyId: string, user: { id: string; email: string }, cfg: OfficeConfig) {
  const a: AgencyActor = { userId: user.id, email: user.email, agencyId, agencyRole: "agency_owner" };
  try {
    if (cfg.businessType) await db.query("UPDATE agencies SET business_type=$2 WHERE id=$1", [agencyId, cfg.businessType]);
    if (cfg.services?.length) { await chooseServices(db, a, cfg.services); if (cfg.employees?.length) await hireInDemo(db, a, cfg.employees); }
    await setStep(db, a, cfg.services?.length ? 4 : 1);
  } catch (e: any) { await audit(db, { userId: user.id }, "office.provision_failed", agencyId, { error: String(e.message).slice(0, 200) }); }
}

export interface PaidCheckout { sessionId: string; intentId: string; email?: string | null; name?: string | null; customerId?: string | null; subscriptionId?: string | null; amountTotal?: number | null; currency?: string | null }
/**
 * Entrega tras un pago CONFIRMADO por webhook firmado. Idempotente: el mismo pago (aunque Stripe reenvíe o lleguen eventos en paralelo) crea UNA sola oficina y UN solo correo.
 * Si ya existe la cuenta (por intención de un usuario con sesión o por correo) se vincula; nunca se duplican cuentas.
 */
export async function deliverPaidCheckout(db: Db, d: PaidCheckout): Promise<{ agencyId: string | null; created: boolean }> {
  const intent = (await db.query("SELECT * FROM checkout_intents WHERE id=$1", [d.intentId]))[0];
  const email = (d.email || intent?.email || "").trim().toLowerCase();
  if (!intent || !email) { // pago verificado pero sin intención/correo: se registra para el operador, sin crear nada
    await db.query("INSERT INTO orders(id,checkout_session_id,intent_id,email,plan,status,stripe_customer_id,stripe_subscription_id,amount_total,currency,last_error) VALUES($1,$2,$3,$4,'desconocido','error',$5,$6,$7,$8,$9) ON CONFLICT (checkout_session_id) DO NOTHING",
      [newId(), d.sessionId, d.intentId, email || "(sin correo)", d.customerId ?? null, d.subscriptionId ?? null, d.amountTotal ?? null, d.currency ?? null, !intent ? "Intención de compra desconocida" : "Sin correo del comprador"]);
    return { agencyId: null, created: false };
  }
  const out = await db.tx(async (t) => {
    await t.query(`INSERT INTO orders(id,checkout_session_id,intent_id,email,plan,kind,stripe_customer_id,stripe_subscription_id,amount_total,currency,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (checkout_session_id) DO NOTHING`,
      [newId(), d.sessionId, d.intentId, email, intent.plan, intent.kind, d.customerId ?? null, d.subscriptionId ?? null, d.amountTotal ?? null, d.currency ?? null, intent.source]);
    const order = (await t.query("SELECT * FROM orders WHERE checkout_session_id=$1 FOR UPDATE", [d.sessionId]))[0];
    if (!order.affiliate_id && !order.affiliate_flag && intent.affiliate_code) await attributeOrder(t, order.id, { code: intent.affiliate_code, kind: intent.kind, email, userId: intent.user_id }); // afiliados: solo atribuye o marca; no puede impedir la entrega
    if (order.status === "entregada") return { agencyId: order.agency_id as string, created: false, user: null as any };
    let userId: string | null = null;
    if (intent.user_id && (await t.query("SELECT 1 FROM users WHERE id=$1", [intent.user_id])).length) userId = intent.user_id;
    userId ??= await createPasswordlessUser(t, email, d.name || "");
    await t.query("INSERT INTO office_rights(id,user_id,email,plan,source,order_id) VALUES($1,$2,$3,$4,'pago',$5) ON CONFLICT (order_id) DO NOTHING", [newId(), userId, email, intent.plan, order.id]);
    const right = (await t.query("SELECT id, agency_id FROM office_rights WHERE order_id=$1", [order.id]))[0];
    const cfg = clean(intent.config);
    const prior = Number((await t.query<{ n: string }>("SELECT count(*) n FROM agency_members WHERE user_id=$1", [userId]))[0].n); // ¿es su primera oficina?
    const agencyId = right.agency_id ?? await createOfficeFromRight(t, right.id, { userId, name: cfg.officeName, businessType: cfg.businessType, subscriptionId: d.subscriptionId, customerId: d.customerId });
    if (d.subscriptionId) {
      await t.query("INSERT INTO subscriptions(id,agency_id,customer_id,status) VALUES($1,$2,$3,'active') ON CONFLICT (id) DO UPDATE SET agency_id=$2, customer_id=COALESCE($3, subscriptions.customer_id)", [d.subscriptionId, agencyId, d.customerId ?? null]);
      await t.query("UPDATE invoices SET agency_id=$1 WHERE subscription_id=$2 AND agency_id IS NULL", [agencyId, d.subscriptionId]); // facturas que llegaron ANTES que el pago
    }
    await t.query("UPDATE orders SET status='entregada', agency_id=$2, user_id=$3, delivered_at=now(), last_error=NULL WHERE id=$1", [order.id, agencyId, userId]);
    await t.query("UPDATE checkout_intents SET user_id=COALESCE(user_id,$2) WHERE id=$1", [intent.id, userId]);
    await queueEmail(t, { to: email, kind: "compra_confirmada", payload: { orderId: order.id, agencyId }, dedupeKey: `compra:${order.id}` });
    await queueEmail(t, { to: email, kind: prior === 0 ? "bienvenida" : "oficina_entregada", payload: { userId, agencyId }, dedupeKey: `entrega:${order.id}` });
    return { agencyId, created: true, user: { id: userId, email }, cfg };
  });
  if (out.created) {
    await provisionOffice(db, out.agencyId, out.user, out.cfg ?? {});
    const { applySubscriptionState } = await import("./events");
    if (d.subscriptionId) await applySubscriptionState(db, d.subscriptionId); // si Stripe ya había avisado de un estado distinto, se respeta
  }
  return { agencyId: out.agencyId, created: out.created };
}
