import { Db, newId } from "../db";
import { AgencyActor, assertAgencyCan, audit } from "../auth";
import { isPlanKey, planOf, PlanKey } from "../agency/plans";
import { assertOperator, Operator } from "./admin";

/**
 * ARQUITECTURA DE LICENCIAS (cobro DESACTIVADO).
 *  - El plan efectivo de una agencia es agencies.plan; los límites salen de plans.ts.
 *  - licenses guarda el historial. origin='manual' = concedida por un operador; origin='pasarela' SOLO podrá crearla el webhook de una pasarela
 *    verificada, que todavía no existe. Por eso hoy no puede haber «compras» reales y las métricas de compra salen en cero/«no activo».
 *  - PaymentProvider es el contrato que se implementará cuando José autorice una pasarela. Mientras no haya implementación registrada,
 *    startCheckout NUNCA devuelve un enlace de pago.
 */
export interface PaymentProvider {
  name: string;
  createCheckout(i: { agencyId: string; plan: PlanKey; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  /** Valida firma del webhook y devuelve el evento normalizado; debe lanzar si la firma es inválida. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<{ type: "paid" | "cancelled"; agencyId: string; plan: PlanKey; externalId: string }>;
}
let provider: PaymentProvider | null = null; // sin implementación: cobros apagados
export const registerPaymentProvider = (p: PaymentProvider | null) => { provider = p; };
export const billingEnabled = () => process.env.BILLING_ENABLED === "true" && provider !== null;
export const billingStatus = () => ({ enabled: billingEnabled(), flag: process.env.BILLING_ENABLED === "true", provider: provider?.name ?? null });

export type CheckoutResult = { mode: "solicitud"; requestId: string } | { mode: "pago"; url: string };
/** «Contratar»: con cobros apagados registra una SOLICITUD para que el equipo te contacte. No cobra, no activa nada. */
export async function startCheckout(db: Db, a: AgencyActor, plan: string, urls = { success: "", cancel: "" }): Promise<CheckoutResult> {
  assertAgencyCan(a, "agency:brand");
  if (!isPlanKey(plan) || plan === "prueba") throw new Error("Elige un plan de pago válido.");
  if (billingEnabled() && provider) {
    const c = await provider.createCheckout({ agencyId: a.agencyId, plan, successUrl: urls.success, cancelUrl: urls.cancel });
    await audit(db, { userId: a.userId }, "billing.checkout_started", a.agencyId, { plan });
    return { mode: "pago", url: c.url };
  }
  const open = (await db.query("SELECT id FROM plan_requests WHERE agency_id=$1 AND plan=$2 AND status='solicitada'", [a.agencyId, plan]))[0];
  if (open) return { mode: "solicitud", requestId: open.id };
  const id = newId();
  await db.query("INSERT INTO plan_requests(id,agency_id,user_id,plan) VALUES($1,$2,$3,$4)", [id, a.agencyId, a.userId, plan]);
  await audit(db, { userId: a.userId }, "billing.plan_requested", a.agencyId, { plan });
  return { mode: "solicitud", requestId: id };
}

/** Procesa un webhook de pasarela. Hoy lanza siempre: no hay pasarela autorizada. */
export async function handlePaymentWebhook(db: Db, rawBody: string, headers: Record<string, string>) {
  if (!provider || !billingEnabled()) throw new Error("Cobros desactivados: no se acepta ningún evento de pago.");
  const ev = await provider.parseWebhook(rawBody, headers);
  if (ev.type === "paid") await applyLicense(db, ev.agencyId, ev.plan, "pasarela", `pago ${ev.externalId}`, null);
  else await endLicense(db, ev.agencyId, "cancelada", `cancelación ${ev.externalId}`, null);
}

async function applyLicense(db: Db, agencyId: string, plan: PlanKey, origin: "manual" | "pasarela", note: string, by: string | null) {
  await db.tx(async (t) => {
    await t.query("UPDATE licenses SET status='vencida', ends_at=now() WHERE agency_id=$1 AND status='activa'", [agencyId]);
    await t.query("INSERT INTO licenses(id,agency_id,plan,status,origin,note,created_by) VALUES($1,$2,$3,'activa',$4,$5,$6)", [newId(), agencyId, plan, origin, note, by]);
    await t.query("UPDATE agencies SET plan=$2, billing_status=$3 WHERE id=$1", [agencyId, plan, origin === "pasarela" ? "pagado" : "licencia_manual"]);
    await t.query("UPDATE plan_requests SET status='atendida' WHERE agency_id=$1 AND status='solicitada'", [agencyId]);
  });
}
async function endLicense(db: Db, agencyId: string, status: "cancelada" | "vencida", note: string, by: string | null) {
  await db.tx(async (t) => {
    await t.query("UPDATE licenses SET status=$2, ends_at=now(), note=CASE WHEN note='' THEN $3 ELSE note||' · '||$3 END WHERE agency_id=$1 AND status='activa'", [agencyId, status, note]);
    await t.query("UPDATE agencies SET plan='prueba', billing_status='sin_facturacion' WHERE id=$1", [agencyId]);
  });
  void by;
}
/** Concesión MANUAL por un operador (p. ej. cortesía o cobro hecho fuera de la plataforma). No mueve dinero. */
export async function grantLicense(db: Db, op: Operator | null, agencyId: string, plan: string, note = "") {
  assertOperator(op);
  if (!isPlanKey(plan)) throw new Error("Plan desconocido.");
  if (!(await db.query("SELECT 1 FROM agencies WHERE id=$1", [agencyId])).length) throw new Error("Agencia desconocida.");
  await applyLicense(db, agencyId, plan, "manual", note.slice(0, 200) || "concedida por operador", op.userId);
  await audit(db, { userId: op.userId }, "license.granted", agencyId, { plan });
}
export async function cancelLicense(db: Db, op: Operator | null, agencyId: string, note = "") {
  assertOperator(op);
  await endLicense(db, agencyId, "cancelada", note.slice(0, 200) || "cancelada por operador", op.userId);
  await audit(db, { userId: op.userId }, "license.cancelled", agencyId);
}
export async function dismissPlanRequest(db: Db, op: Operator | null, id: string) { assertOperator(op); await db.query("UPDATE plan_requests SET status='descartada' WHERE id=$1", [id]); }

/** Lo que la agencia tiene HOY (límites reales + uso). */
export async function entitlements(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  const ag = (await db.query("SELECT plan,billing_status FROM agencies WHERE id=$1", [a.agencyId]))[0];
  const p = planOf(ag.plan);
  const clients = Number((await db.query<{ n: string }>("SELECT count(*) n FROM companies WHERE agency_id=$1 AND NOT is_demo", [a.agencyId]))[0].n);
  const employees = Number((await db.query<{ n: string }>("SELECT count(*) n FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 AND NOT c.is_demo", [a.agencyId]))[0].n);
  const lic = (await db.query("SELECT plan,status,origin,starts_at,ends_at FROM licenses WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 1", [a.agencyId]))[0] ?? null;
  const pending = (await db.query("SELECT plan,created_at FROM plan_requests WHERE agency_id=$1 AND status='solicitada' ORDER BY created_at DESC LIMIT 1", [a.agencyId]))[0] ?? null;
  return { plan: ag.plan as string, label: p.label, maxClients: p.maxClients, maxEmployees: p.maxEmployees, clients, employees, billingStatus: ag.billing_status as string, license: lic, pendingRequest: pending };
}
