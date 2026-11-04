import { Db } from "../db";
import { audit } from "../auth";
import { getPaymentProvider } from "../commercial/billing";
import { createOfficeFromRight, OfficeConfig, provisionOffice } from "./orders";

export interface OfficeRow { id: string; name: string; business_type: string; status: string; plan: string; billing_status: string; role: string; employees: number; clients: number; cancel_at_period_end: boolean | null; current_period_end: string | null; created_at: string }
/** MIS OFICINAS: solo las oficinas de las que la persona es miembro. */
export async function listOffices(db: Db, userId: string): Promise<OfficeRow[]> {
  return db.query(`SELECT a.id,a.name,a.business_type,a.status,a.plan,a.billing_status,am.role,a.created_at,
      (SELECT count(*) FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=a.id)::int employees,
      (SELECT count(*) FROM companies c WHERE c.agency_id=a.id AND NOT c.is_demo)::int clients, s.cancel_at_period_end, s.current_period_end
    FROM agency_members am JOIN agencies a ON a.id=am.agency_id LEFT JOIN subscriptions s ON s.id=a.stripe_subscription_id AND s.agency_id=a.id
    WHERE am.user_id=$1 ORDER BY a.created_at, a.id`, [userId]) as Promise<OfficeRow[]>;
}
export async function isMember(db: Db, userId: string, agencyId: string): Promise<boolean> {
  return (await db.query("SELECT 1 FROM agency_members WHERE user_id=$1 AND agency_id=$2", [userId, agencyId])).length > 0;
}
async function ownerOf(db: Db, userId: string, agencyId: string) {
  const r = (await db.query("SELECT a.status, a.billing_status, a.stripe_subscription_id FROM agency_members am JOIN agencies a ON a.id=am.agency_id WHERE am.user_id=$1 AND am.agency_id=$2 AND am.role='agency_owner'", [userId, agencyId]))[0];
  if (!r) throw new Error("Oficina no encontrada."); // no revela si existe
  return r as { status: string; billing_status: string; stripe_subscription_id: string | null };
}

/** Pausar / reanudar UNA oficina (solo su dueño). No toca las demás. Si tiene suscripción, también pausa el cobro en la pasarela; si eso falla, no cambia nada. */
export async function setOfficeStatus(db: Db, userId: string, agencyId: string, to: "pausada" | "activa") {
  const o = await ownerOf(db, userId, agencyId);
  if (o.status === "cancelada") throw new Error("Esta oficina está cancelada: ya no se puede reanudar.");
  if (o.status === to) return;
  if (o.stripe_subscription_id) {
    const p = getPaymentProvider(); if (!p?.pauseCollection) throw new Error("No se puede cambiar el cobro ahora. Inténtalo más tarde.");
    await p.pauseCollection(o.stripe_subscription_id, to === "pausada");
  }
  await db.query("UPDATE agencies SET status=$2 WHERE id=$1 AND status<>'cancelada'", [agencyId, to]);
  await audit(db, { userId }, to === "pausada" ? "office.paused" : "office.resumed", agencyId);
}
/** Cancelar al final del periodo (o reactivar la cancelación programada). Sin suscripción (cortesía) la cancelación es inmediata. Los datos NUNCA se borran. */
export async function scheduleOfficeCancel(db: Db, userId: string, agencyId: string, cancel: boolean) {
  const o = await ownerOf(db, userId, agencyId);
  if (o.status === "cancelada") throw new Error("Esta oficina ya está cancelada.");
  if (o.stripe_subscription_id) {
    const p = getPaymentProvider(); if (!p?.setCancelAtPeriodEnd) throw new Error("No se puede cambiar la suscripción ahora. Inténtalo más tarde.");
    await p.setCancelAtPeriodEnd(o.stripe_subscription_id, cancel);
    await db.query("UPDATE subscriptions SET cancel_at_period_end=$2 WHERE id=$1", [o.stripe_subscription_id, cancel]);
  } else if (cancel) await db.query("UPDATE agencies SET status='cancelada', billing_status='cancelada' WHERE id=$1", [agencyId]);
  await audit(db, { userId }, cancel ? "office.cancel_scheduled" : "office.cancel_undone", agencyId);
}
export async function openBillingPortal(db: Db, userId: string, agencyId: string, returnUrl: string): Promise<string> {
  await ownerOf(db, userId, agencyId);
  const s = (await db.query("SELECT customer_id FROM subscriptions WHERE agency_id=$1 AND customer_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1", [agencyId]))[0];
  const p = getPaymentProvider(); if (!s || !p?.portal) throw new Error("Esta oficina no tiene un pago que administrar.");
  return (await p.portal(s.customer_id, returnUrl)).url;
}
/** Derechos de creación sin usar de esta persona (por su cuenta o su correo): pagos ya hechos o cortesías. */
export async function availableRights(db: Db, userId: string, email: string) {
  return db.query("SELECT id, plan, source FROM office_rights WHERE agency_id IS NULL AND used_at IS NULL AND (user_id=$1 OR email=$2) ORDER BY created_at", [userId, email.toLowerCase()]);
}
/** NUEVA OFICINA con un derecho ya disponible (sin cobrar de nuevo). Atómico: dos clics = una oficina. */
export async function createOfficeWithRight(db: Db, user: { id: string; email: string }, cfg: OfficeConfig): Promise<string> {
  const agencyId = await db.tx(async (t) => {
    const r = (await t.query("SELECT id FROM office_rights WHERE agency_id IS NULL AND used_at IS NULL AND (user_id=$1 OR email=$2) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED", [user.id, user.email.toLowerCase()]))[0];
    if (!r) throw new Error("No tienes un derecho de creación disponible. Compra una oficina nueva para continuar.");
    return createOfficeFromRight(t, r.id, { userId: user.id, name: cfg.officeName, businessType: cfg.businessType, billingStatus: "cortesia" });
  });
  await provisionOffice(db, agencyId, user, cfg);
  return agencyId;
}
/** Concede un derecho de cortesía (operador). */
export async function grantRight(db: Db, email: string, plan: string): Promise<string> {
  const e = email.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Correo no válido.");
  const u = (await db.query("SELECT id FROM users WHERE email=$1", [e]))[0];
  const id = (await import("../db")).newId();
  await db.query("INSERT INTO office_rights(id,user_id,email,plan,source) VALUES($1,$2,$3,$4,'cortesia')", [id, u?.id ?? null, e, plan]);
  return id;
}
