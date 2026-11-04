import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { createIntent, deliverPaidCheckout } from "@/server/commerce/orders";
import { requestAccess } from "@/server/commerce/access";
import { AFFILIATE_TERMS, accrueCommissions, affiliateByCode, affiliateDashboard, applyAffiliate, approveAffiliate, approveDueCommissions, buildPayouts, canonicalEmail, commissionsCsv, inviteAffiliate, markPayoutPaid, reverseCommission, setAffiliateStatus } from "@/server/affiliates";
import { newDb } from "./helpers";

process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test"; const OP = { userId: "op", email: "op@ejemplo.test" };
let db: Db; let n = 0;
beforeEach(async () => { db = await newDb(); n = 0; });
const buy = async (email: string, code: string | null, sub = `sub_${++n}`) => { const intent = await createIntent(db, { plan: "emprendedor", affiliateCode: code }); const sess = `cs_${n}_${Math.random()}`; await deliverPaidCheckout(db, { sessionId: sess, intentId: intent, email, name: "Cliente", subscriptionId: sub, customerId: "cus_" + sub, amountTotal: 49900, currency: "mxn" }); return { sess, sub, order: (await db.query("SELECT * FROM orders WHERE checkout_session_id=$1", [sess]))[0] }; };
const invoice = (sub: string, id: string, cents = 49900, when = "now()") => db.query(`INSERT INTO invoices(id,subscription_id,amount_paid,currency,status,created_at) VALUES($1,$2,$3,'mxn','paid',${when})`, [id, sub, cents]);
const affiliate = async (email = "ana@ejemplo.test") => { const id = await inviteAffiliate(db, OP, email, "Ana"); return { id, code: (await db.query("SELECT code FROM affiliates WHERE id=$1", [id]))[0].code as string }; };

describe("registro por invitación o solicitud aprobada", () => {
  it("una solicitud queda pendiente, sin código ni acceso; solo un operador aprueba; el afiliado aprobado puede pedir enlace de acceso", async () => {
    await expect(applyAffiliate(db, { email: "luis@ejemplo.test", name: "Luis", acceptTerms: false })).rejects.toThrow(); await expect(applyAffiliate(db, { email: "bot@x.test", name: "Bot", acceptTerms: true, website: "http://spam" })).rejects.toThrow();
    expect(await applyAffiliate(db, { email: "luis@ejemplo.test", name: "Luis", acceptTerms: true })).toEqual({ status: "solicitada" }); const a = (await db.query("SELECT * FROM affiliates WHERE email='luis@ejemplo.test'"))[0]; expect(a.code).toBeNull();
    expect(await requestAccess(db, "luis@ejemplo.test")).toBe(false); // sin aprobar no hay acceso
    await expect(approveAffiliate(db, null, a.id)).rejects.toThrow(); await approveAffiliate(db, OP, a.id); const ap = (await db.query("SELECT code,status FROM affiliates WHERE id=$1", [a.id]))[0]; expect(ap.status).toBe("aprobada"); expect(ap.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await requestAccess(db, "luis@ejemplo.test")).toBe(true); expect((await db.query("SELECT count(*)::int n FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.email='luis@ejemplo.test'"))[0].n).toBe(0); // acceso sin ninguna oficina de clientes
  });
  it("los códigos son únicos y se pueden suspender", async () => {
    const a = await affiliate("a@ejemplo.test"), b = await affiliate("b@ejemplo.test"); expect(a.code).not.toBe(b.code); await setAffiliateStatus(db, OP, a.id, "suspendida", "prueba");
    const r = await buy("cliente@ejemplo.test", a.code); expect(r.order.affiliate_id).toBeNull(); expect(r.order.affiliate_flag).toBe("afiliado_no_aprobado");
  });
});
describe("atribución y prevención de fraude", () => {
  it("atribuye la primera compra del enlace; sin código no atribuye", async () => {
    const a = await affiliate(); const r = await buy("cliente@ejemplo.test", a.code.toLowerCase()); expect(r.order.affiliate_id).toBe(a.id); expect((await buy("otro@ejemplo.test", null)).order.affiliate_id).toBeNull();
    expect((await buy("tercero@ejemplo.test", "NOEXISTE1")).order.affiliate_flag).toBe("codigo_desconocido");
  });
  it("autorreferidos (incluso con alias +, puntos de Gmail o mayúsculas) y clientes existentes NO generan comisión", async () => {
    const a = await affiliate("ana.perez@gmail.com"); expect(canonicalEmail("Ana.Perez+x@Googlemail.com")).toBe("anaperez@gmail.com");
    for (const e of ["ana.perez@gmail.com", "ANAPEREZ+tienda@gmail.com"]) expect((await buy(e, a.code)).order.affiliate_flag).toBe("autorreferido");
    await buy("repetido@ejemplo.test", null); const again = await buy("repetido@ejemplo.test", a.code); expect(again.order.affiliate_flag).toBe("cliente_existente"); expect(again.order.affiliate_id).toBeNull();
  });
  it("la entrega de la oficina no depende del afiliado (la compra funciona aunque la atribución se rechace)", async () => {
    const a = await affiliate("ana@ejemplo.test"); const r = await buy("ana@ejemplo.test", a.code); expect(r.order.status).toBe("entregada"); expect(r.order.agency_id).toBeTruthy();
  });
});
describe("comisiones: 20 % neto recurrente, tope de 12 cobros, retención, reversos y liquidaciones", () => {
  it("calcula 20 % sobre cada cobro pagado, es idempotente y se detiene a los 12 cobros", async () => {
    const a = await affiliate(); const r = await buy("cliente@ejemplo.test", a.code); for (let i = 1; i <= 14; i++) await invoice(r.sub, `in_${i}`, 49900, `now() + interval '${i} minutes'`);
    expect(await accrueCommissions(db)).toBe(12); expect(await accrueCommissions(db)).toBe(0); const cs = await db.query("SELECT month_index,net_cents,amount_cents FROM affiliate_commissions ORDER BY month_index"); expect(cs).toHaveLength(12);
    expect(Number(cs[0].net_cents)).toBe(49900); expect(Number(cs[0].amount_cents)).toBe(Math.floor(49900 * 0.2)); expect(cs.map((c: any) => c.month_index)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
  it("no comisiona facturas fallidas ni pedidos sin atribución", async () => {
    const a = await affiliate(); const r = await buy("c1@ejemplo.test", a.code); await db.query("INSERT INTO invoices(id,subscription_id,amount_paid,currency,status) VALUES('in_f',$1,49900,'mxn','payment_failed')", [r.sub]); const q = await buy("c2@ejemplo.test", null); await invoice(q.sub, "in_s");
    expect(await accrueCommissions(db)).toBe(0);
  });
  it("retención: solo se aprueba lo que cumplió los días de espera", async () => {
    const a = await affiliate(); const r = await buy("c1@ejemplo.test", a.code); await invoice(r.sub, "in_1"); await accrueCommissions(db); expect(await approveDueCommissions(db)).toBe(0);
    expect(await approveDueCommissions(db, new Date(Date.now() + (AFFILIATE_TERMS.holdDays + 1) * 86400_000))).toBe(1);
  });
  it("reembolso/contracargo: revierte la pendiente; si ya se pagó crea un ajuste negativo que se descuenta; reembolso parcial proporcional", async () => {
    const a = await affiliate(); const r = await buy("c1@ejemplo.test", a.code); await invoice(r.sub, "in_1"); await invoice(r.sub, "in_2", 100000, "now() + interval '1 minute'"); await accrueCommissions(db);
    await reverseCommission(db, OP, "in_1", "contracargo"); expect((await db.query("SELECT status FROM affiliate_commissions WHERE invoice_id='in_1'"))[0].status).toBe("revertida");
    await reverseCommission(db, OP, "in_2", "reembolso parcial", 50000); expect(Number((await db.query("SELECT amount_cents FROM affiliate_commissions WHERE invoice_id='in_2'"))[0].amount_cents)).toBe(10000); // 20 000 − 10 000
    await expect(reverseCommission(db, OP, "in_x", "x")).rejects.toThrow();
  });
  it("liquidación mensual: una por afiliado y mes, mínimo de pago, ajustes negativos, pago auditable y CSV", async () => {
    const a = await affiliate(); const r = await buy("c1@ejemplo.test", a.code); for (let i = 1; i <= 6; i++) await invoice(r.sub, `in_${i}`, 49900, `now() + interval '${i} minutes'`); await accrueCommissions(db);
    await db.query("UPDATE affiliate_commissions SET created_at = now() - interval '40 days'"); await approveDueCommissions(db); // 6 × 9 980 = 59 880 ≥ mínimo 50 000
    expect(await buildPayouts(db, OP, "2026-11-01")).toBe(1); expect(await buildPayouts(db, OP, "2026-11-01")).toBe(0); const p = (await db.query("SELECT * FROM affiliate_payouts"))[0]; expect(Number(p.total_cents)).toBe(6 * 9980);
    await expect(markPayoutPaid(db, OP, p.id, " ")).rejects.toThrow(); await markPayoutPaid(db, OP, p.id, "SPEI-123"); await expect(markPayoutPaid(db, OP, p.id, "otra")).rejects.toThrow(); expect((await db.query("SELECT DISTINCT status FROM affiliate_commissions"))[0].status).toBe("pagada");
    await reverseCommission(db, OP, "in_1", "contracargo posterior al pago"); expect(Number((await db.query("SELECT amount_cents FROM affiliate_commissions WHERE kind='ajuste'"))[0].amount_cents)).toBe(-9980);
    const csv = await commissionsCsv(db, OP); expect(csv.split("\n")[0]).toContain("comision_centavos"); expect(csv).not.toMatch(/@/); // el CSV no lleva correos
    expect((await db.query("SELECT count(*)::int n FROM audit_log WHERE action LIKE 'affiliate.%'"))[0].n).toBeGreaterThan(3);
  });
  it("por debajo del mínimo de pago la comisión se acumula al mes siguiente", async () => {
    const a = await affiliate(); const r = await buy("c1@ejemplo.test", a.code); await invoice(r.sub, "in_1"); await accrueCommissions(db); await db.query("UPDATE affiliate_commissions SET created_at = now() - interval '40 days'"); await approveDueCommissions(db); expect(await buildPayouts(db, OP, "2026-11-01")).toBe(0);
  });
});
describe("privacidad: el afiliado no ve datos de los clientes", () => {
  it("el panel solo trae etiquetas «Cliente N», plan y totales: ni correos, ni oficinas, ni conversaciones", async () => {
    const a = await affiliate(); const r = await buy("secreto.cliente@ejemplo.test", a.code); await invoice(r.sub, "in_1"); await accrueCommissions(db); const d = await affiliateDashboard(db, a.id); const txt = JSON.stringify(d);
    expect(txt).not.toMatch(/secreto|@ejemplo\.test|agency|company|office/i); expect(d.referidos[0].etiqueta).toBe("Cliente 1"); expect(d.referidos[0].cobros).toBe(1); expect(d.pendiente).toBe(Math.floor(49900 * 0.2));
    expect(Object.keys(d.referidos[0]).sort()).toEqual(["cobros", "desde", "etiqueta", "plan"]);
  });
  it("el código de otro afiliado no mezcla cifras", async () => {
    const a = await affiliate("a@ejemplo.test"), b = await affiliate("b@ejemplo.test"); const r = await buy("c1@ejemplo.test", a.code); await invoice(r.sub, "in_1"); await accrueCommissions(db);
    expect((await affiliateDashboard(db, b.id)).referidos).toEqual([]); expect((await affiliateDashboard(db, b.id)).pendiente).toBe(0); expect((await affiliateByCode(db, a.code))!.id).toBe(a.id);
  });
});
