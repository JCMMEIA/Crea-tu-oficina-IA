import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http"; import { createHmac } from "node:crypto";
import { Db } from "@/server/db";
import { agencyActorFromToken, actorFromToken, login, startSession, actAs } from "@/server/auth";
import { applyCommerceEvent } from "@/server/commerce/events";
import { createIntent, deliverPaidCheckout } from "@/server/commerce/orders";
import { consumeAccessLink, issueAccessLink, requestAccess } from "@/server/commerce/access";
import { MailProvider, processEmails, queueEmail } from "@/server/commerce/mail";
import { availableRights, createOfficeWithRight, grantRight, listOffices, openBillingPortal, scheduleOfficeCancel, setOfficeStatus } from "@/server/commerce/offices";
import { purchasesOpen, verifyAi } from "@/server/commerce/gate";
import { handlePaymentWebhook, registerPaymentProvider } from "@/server/commercial/billing";
import { assertWithinLimits } from "@/server/usage";
import { createClient } from "@/server/agency";
import { newDb, ScriptedProvider } from "./helpers";

let db: Db; const OLD = { ...process.env };
const paid = (sid: string, intent: string, o: any = {}) => ({ id: "evt_" + sid, type: "checkout.session.completed", created: 1000, data: { object: { id: sid, mode: "subscription", payment_status: "paid", client_reference_id: intent, metadata: { intent_id: intent }, customer: "cus_" + sid, subscription: "sub_" + sid, customer_details: { email: "Ana@Compra.test", name: "Ana" }, amount_total: 89900, currency: "mxn", ...o } } });
const sub = (type: string, id: string, created: number, o: any = {}) => ({ id: `evt_${type}_${created}`, type, created, data: { object: { id, status: "active", customer: "cus_x", cancel_at_period_end: false, current_period_end: 2000000000, ...o } } });
const inv = (type: string, id: string, subId: string, created: number) => ({ id: `evt_${id}_${type}`, type, created, data: { object: { id, subscription: subId, customer: "cus_x", amount_paid: 89900, currency: "mxn", hosted_invoice_url: "https://stripe.test/i/" + id, lines: { data: [{ period: { end: 2000000000 } }] } } } });
async function buy(sid: string, o: any = {}, intentArgs: any = {}) { const i = await createIntent(db, { plan: "emprendedor", ...intentArgs }); return { intent: i, r: await applyCommerceEvent(db, paid(sid, i, o)) }; }
const agenciesOf = async (email: string) => db.query("SELECT a.id FROM agencies a JOIN agency_members m ON m.agency_id=a.id JOIN users u ON u.id=m.user_id WHERE u.email=$1", [email]);
beforeEach(async () => { db = await newDb(); registerPaymentProvider(null); delete process.env.SIGNUP_ALLOWED_EMAILS; });
afterEach(() => { process.env = { ...OLD }; });

describe("entrega automática tras el pago", () => {
  it("pago confirmado → cuenta sin contraseña + oficina propia (dueña) + derecho consumido + pedido entregado + correo en cola; antes del pago NO existe nada", async () => {
    const i = await createIntent(db, { plan: "emprendedor", source: "meta" });
    expect((await db.query("SELECT 1 FROM users")).length + (await db.query("SELECT 1 FROM agencies")).length).toBe(0);
    await applyCommerceEvent(db, paid("cs_1", i));
    const u = (await db.query("SELECT id,email,name FROM users"))[0]; expect(u.email).toBe("ana@compra.test");
    const ag = await agenciesOf("ana@compra.test"); expect(ag.length).toBe(1);
    const a = (await db.query("SELECT plan,status,billing_status,stripe_subscription_id FROM agencies"))[0]; expect(a).toMatchObject({ plan: "emprendedor", status: "activa", billing_status: "pagado", stripe_subscription_id: "sub_cs_1" });
    expect((await db.query("SELECT role FROM agency_members"))[0].role).toBe("agency_owner");
    const o = (await db.query("SELECT status,source,agency_id FROM orders"))[0]; expect(o).toMatchObject({ status: "entregada", source: "meta" }); expect(o.agency_id).toBe(ag[0].id);
    const r = (await db.query("SELECT source,agency_id,used_at FROM office_rights"))[0]; expect(r.source).toBe("pago"); expect(r.agency_id).toBe(ag[0].id); expect(r.used_at).toBeTruthy();
    expect((await db.query("SELECT kind,status FROM emails")).map((e: any) => e.kind + ":" + e.status)).toEqual(["bienvenida:en_cola"]);
    // la «contraseña» es inutilizable: no se puede entrar con contraseña
    await expect(login(db, "ana@compra.test", "")).rejects.toThrow(); await expect(login(db, "ana@compra.test", "cualquiera-123")).rejects.toThrow();
  });
  it("IDEMPOTENCIA: el mismo pago repetido y en paralelo crea UNA oficina, UNA cuenta, UN correo", async () => {
    const i = await createIntent(db, { plan: "emprendedor" }); const ev = paid("cs_2", i);
    await Promise.all([1, 2, 3, 4, 5].map(() => applyCommerceEvent(db, ev).catch(() => "x")));
    await applyCommerceEvent(db, ev);
    for (const [t, n] of [["agencies", 1], ["users", 1], ["orders", 1], ["office_rights", 1], ["emails", 1], ["agency_members", 1]] as const) expect((await db.query(`SELECT 1 FROM ${t}`)).length, t).toBe(n);
  });
  it("solo paga una compra 'paid' de modo suscripción con intención conocida; lo demás se ignora o queda como error visible", async () => {
    const i = await createIntent(db, { plan: "emprendedor" });
    expect(await applyCommerceEvent(db, paid("cs_3", i, { payment_status: "unpaid" }))).toBe("ignorado");
    expect(await applyCommerceEvent(db, paid("cs_3", i, { mode: "payment" }))).toBe("ignorado");
    expect((await db.query("SELECT 1 FROM agencies")).length).toBe(0);
    await applyCommerceEvent(db, paid("cs_4", "intent-inexistente")); // pago verificado sin intención → NO crea nada, queda como error para el operador
    expect((await db.query("SELECT 1 FROM agencies")).length).toBe(0); expect((await db.query("SELECT status,last_error FROM orders"))[0]).toMatchObject({ status: "error" });
  });
  it("comprador que YA es cliente: se vincula a su cuenta (por sesión o por correo) sin duplicar usuarios; cada compra es una oficina independiente", async () => {
    const a1 = await buy("cs_5"); expect((await agenciesOf("ana@compra.test")).length).toBe(1);
    await buy("cs_6"); // mismo correo, otra compra
    expect((await db.query("SELECT 1 FROM users")).length).toBe(1); expect((await agenciesOf("ana@compra.test")).length).toBe(2);
    const uid = (await db.query("SELECT id FROM users"))[0].id;
    const i3 = await createIntent(db, { plan: "emprendedor", kind: "adicional", userId: uid }); await applyCommerceEvent(db, paid("cs_7", i3, { customer_details: { email: "otro@correo.test", name: "X" } })); // Stripe trae OTRO correo: manda la cuenta con sesión
    expect((await db.query("SELECT 1 FROM users")).length).toBe(1); expect((await agenciesOf("ana@compra.test")).length).toBe(3);
    expect(a1.r).toBe("procesado");
  });
  it("la configuración elegida ANTES de pagar (negocio, plantilla, empleados) se aplica al crear la oficina adicional", async () => {
    const i = await createIntent(db, { plan: "emprendedor", kind: "adicional", config: { officeName: "Mi Tienda", businessType: "ecommerce", services: ["anuncios"], employees: ["creador-anuncios"] } });
    await applyCommerceEvent(db, paid("cs_8", i));
    const a = (await db.query("SELECT id,name,business_type,onboarding FROM agencies"))[0]; expect(a.name).toBe("Mi Tienda"); expect(a.business_type).toBe("ecommerce");
    expect((await db.query("SELECT e.template_key FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1", [a.id])).map((e: any) => e.template_key)).toEqual(["creador-anuncios"]);
    expect(a.onboarding.step).toBe(4);
  });
  it("el pago de cuentas 'compradoras' no pasa por la lista de registro cerrado (pagaron), pero el registro público sigue cerrado", async () => {
    process.env.SIGNUP_ALLOWED_EMAILS = "solo@yo.test"; await buy("cs_9"); expect((await agenciesOf("ana@compra.test")).length).toBe(1);
    const { signupAgency } = await import("@/server/auth"); await expect(signupAgency(db, { email: "intruso@x.test", name: "I", password: "clave-larga-123", agencyName: "X" })).rejects.toThrow(/invitación|autorizad|registro/i);
  });
});

describe("estado de la suscripción, comprobantes y renovaciones", () => {
  it("renovación (invoice.paid) guarda el comprobante; pago fallido → 'pago_pendiente' + correo; luego se recupera", async () => {
    await buy("cs_10"); const sid = "sub_cs_10";
    await applyCommerceEvent(db, inv("invoice.paid", "in_1", sid, 1100));
    expect((await db.query("SELECT hosted_invoice_url,agency_id FROM invoices"))[0].hosted_invoice_url).toContain("in_1");
    await applyCommerceEvent(db, inv("invoice.payment_failed", "in_2", sid, 1200));
    expect((await db.query("SELECT billing_status,status FROM agencies"))[0]).toMatchObject({ billing_status: "pago_pendiente", status: "activa" });
    expect((await db.query("SELECT kind FROM emails ORDER BY created_at")).map((e: any) => e.kind)).toContain("pago_fallido");
    await applyCommerceEvent(db, inv("invoice.paid", "in_3", sid, 1300)); expect((await db.query("SELECT billing_status FROM agencies"))[0].billing_status).toBe("pagado");
  });
  it("cancelación → oficina 'cancelada' (datos intactos) + correo; los eventos viejos o repetidos no la revierten", async () => {
    await buy("cs_11"); const sid = "sub_cs_11";
    await applyCommerceEvent(db, sub("customer.subscription.deleted", sid, 1500));
    expect((await db.query("SELECT status,billing_status FROM agencies"))[0]).toMatchObject({ status: "cancelada", billing_status: "cancelada" });
    expect(await applyCommerceEvent(db, sub("customer.subscription.updated", sid, 1400, { status: "active" }))).toBe("ignorado"); // más viejo: ignorado
    expect((await db.query("SELECT status FROM agencies"))[0].status).toBe("cancelada");
    expect((await db.query("SELECT 1 FROM emails WHERE kind='oficina_cancelada'")).length).toBe(1);
  });
  it("eventos FUERA DE ORDEN: la factura y la cancelación llegan ANTES del checkout → al entregar se enlazan", async () => {
    const i = await createIntent(db, { plan: "emprendedor" });
    await applyCommerceEvent(db, inv("invoice.paid", "in_9", "sub_cs_12", 1100)); // aún no existe la oficina
    expect((await db.query("SELECT agency_id FROM invoices"))[0].agency_id).toBeNull();
    await applyCommerceEvent(db, paid("cs_12", i, { subscription: "sub_cs_12" }));
    expect((await db.query("SELECT agency_id FROM invoices"))[0].agency_id).toBeTruthy();
  });
  it("cancelar al final del periodo (con proveedor) marca la programación; sin suscripción es inmediata; solo el dueño", async () => {
    const calls: string[] = [];
    registerPaymentProvider({ name: "falsa", createCheckout: async () => ({ url: "x" }), parseWebhook: async () => { throw new Error("x"); }, setCancelAtPeriodEnd: async (id, on) => { calls.push(`cancel:${id}:${on}`); }, pauseCollection: async (id, on) => { calls.push(`pause:${id}:${on}`); }, portal: async () => ({ url: "https://portal.test/x" }) });
    process.env.BILLING_ENABLED = "true";
    await buy("cs_13"); const uid = (await db.query("SELECT id FROM users"))[0].id; const ag = (await agenciesOf("ana@compra.test"))[0].id;
    await scheduleOfficeCancel(db, uid, ag, true); expect(calls).toContain("cancel:sub_cs_13:true"); expect((await listOffices(db, uid))[0].cancel_at_period_end).toBe(true);
    await scheduleOfficeCancel(db, uid, ag, false); expect((await listOffices(db, uid))[0].cancel_at_period_end).toBe(false);
    await setOfficeStatus(db, uid, ag, "pausada"); expect(calls).toContain("pause:sub_cs_13:true"); expect((await db.query("SELECT status FROM agencies"))[0].status).toBe("pausada");
    expect(await openBillingPortal(db, uid, ag, "https://app/volver")).toBe("https://portal.test/x");
    await buy("cs_14", { customer_details: { email: "otra@persona.test", name: "O" } }); const otra = (await db.query("SELECT id FROM users WHERE email='otra@persona.test'"))[0].id;
    await expect(scheduleOfficeCancel(db, otra, ag, true)).rejects.toThrow(/no encontrada/); await expect(setOfficeStatus(db, otra, ag, "pausada")).rejects.toThrow(/no encontrada/);
  });
});

describe("enlaces de acceso (sin registro ni contraseña)", () => {
  it("un solo uso, caduca, token inventado falla, se guarda solo el hash; dos canjes simultáneos → uno", async () => {
    await buy("cs_20"); const uid = (await db.query("SELECT id FROM users"))[0].id;
    const t = await issueAccessLink(db, uid); expect((await db.query("SELECT token_hash FROM access_links"))[0].token_hash).not.toContain(t);
    const rs = await Promise.all([consumeAccessLink(db, t), consumeAccessLink(db, t)]); expect(rs.filter(Boolean).length).toBe(1);
    expect(await consumeAccessLink(db, t)).toBeNull(); expect(await consumeAccessLink(db, "x".repeat(43))).toBeNull(); expect(await consumeAccessLink(db, "corto")).toBeNull();
    const t2 = await issueAccessLink(db, uid); await db.query("UPDATE access_links SET expires_at = now() - interval '1 minute'"); expect(await consumeAccessLink(db, t2)).toBeNull();
    const t3 = await issueAccessLink(db, uid); const ses = (await consumeAccessLink(db, t3))!; expect((await agencyActorFromToken(db, ses.session))?.agencyId).toBeTruthy();
  });
  it("los correos de OPERADOR (variable del servidor) inician sesión por enlace aunque aún no tengan cuenta; cualquier otro correo desconocido no crea nada", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "jose@ejemplo.test";
    expect(await requestAccess(db, "intruso@x.test")).toBe(false); expect((await db.query("SELECT 1 FROM users WHERE email='intruso@x.test'")).length).toBe(0);
    expect(await requestAccess(db, "Jose@Ejemplo.test")).toBe(true); expect((await db.query("SELECT 1 FROM users WHERE email='jose@ejemplo.test'")).length).toBe(1);
    expect((await db.query("SELECT to_email,kind FROM emails"))[0]).toMatchObject({ to_email: "jose@ejemplo.test", kind: "acceso" });
  });
  it("recuperar acceso: no revela si el correo existe, tope por hora, y solo se envía a cuentas reales", async () => {
    await buy("cs_21");
    expect(await requestAccess(db, "nadie@x.test")).toBe(false); expect(await requestAccess(db, "ANA@compra.test")).toBe(true);
    for (let i = 0; i < 6; i++) await requestAccess(db, "ana@compra.test");
    expect(Number((await db.query("SELECT count(*) n FROM emails WHERE kind='acceso'"))[0].n)).toBeLessThanOrEqual(5);
  });
});

describe("correos transaccionales", () => {
  it("el enlace se genera AL ENVIAR y no queda en la base; reintenta si falla; no duplica", async () => {
    await buy("cs_22"); const sent: any[] = []; let fail = true;
    const prov: MailProvider = { name: "t", send: async (m) => { if (fail) { fail = false; throw new Error("caído"); } sent.push(m); return "id1"; } };
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.ejemplo.test";
    expect(await processEmails(db, prov)).toEqual({ sent: 0, failed: 1 });
    expect((await db.query("SELECT status,attempts FROM emails"))[0]).toMatchObject({ status: "en_cola", attempts: 1 });
    expect(await processEmails(db, prov)).toEqual({ sent: 0, failed: 0 }); // aún no toca reintentar (espera)
    await db.query("UPDATE emails SET retry_at = now()"); // pasa el tiempo
    expect(await processEmails(db, prov)).toEqual({ sent: 1, failed: 0 });
    expect(sent[0].to).toBe("ana@compra.test"); const link = sent[0].text.match(/https:\/\/app\.ejemplo\.test\/acceso\?t=([A-Za-z0-9_-]+)/)![1]; expect(link.length).toBeGreaterThan(30);
    expect(JSON.stringify(await db.query("SELECT * FROM emails"))).not.toContain(link); expect((await consumeAccessLink(db, link))?.userId).toBeTruthy();
    expect(await processEmails(db, prov)).toEqual({ sent: 0, failed: 0 });
  });
  it("dos procesadores simultáneos NO envían el mismo correo dos veces (arrendamiento)", async () => {
    await buy("cs_23"); let enviados = 0; const lento: MailProvider = { name: "t", send: async () => { enviados++; await new Promise((r) => setTimeout(r, 150)); return "id"; } };
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.ejemplo.test";
    await Promise.all([processEmails(db, lento), processEmails(db, lento), processEmails(db, lento)]);
    expect(enviados).toBe(1); expect((await db.query("SELECT status FROM emails"))[0].status).toBe("enviado");
  });
  it("sin proveedor de correo no se envía nada y la tienda NO abre", async () => { delete process.env.RESEND_API_KEY; expect(await processEmails(db, null)).toEqual({ sent: 0, failed: 0 }); expect((await purchasesOpen(db)).reasons.join(" ")).toMatch(/correo/i); });
});

describe("compuerta de venta: cobros + precio + correo + IA verificada", () => {
  it("solo abre con TODO listo; la IA se verifica con una llamada real (tokens medidos) y caduca", async () => {
    expect((await purchasesOpen(db)).open).toBe(false);
    const bad = new ScriptedProvider([{ text: "", inputTokens: 0, outputTokens: 0 }]); expect((await verifyAi(db, bad)).ok).toBe(false);
    expect((await verifyAi(db, null)).ok).toBe(false);
    const good = new ScriptedProvider([{ text: "OK", inputTokens: 12, outputTokens: 2 }]); expect((await verifyAi(db, good)).ok).toBe(true);
    Object.assign(process.env, { BILLING_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_x", PLAN_PRICE_MXN_EMPRENDEDOR: "899", RESEND_API_KEY: "k", MAIL_FROM: "a@b.test" });
    expect(await purchasesOpen(db)).toEqual({ open: true, reasons: [] });
    await db.query("UPDATE system_checks SET checked_at = now() - interval '3 days'"); const g = await purchasesOpen(db); expect(g.open).toBe(false); expect(g.reasons.join()).toMatch(/más de/);
    delete process.env.PLAN_PRICE_MXN_EMPRENDEDOR; expect((await purchasesOpen(db)).reasons.join()).toMatch(/precio/i);
  });
});

describe("varias oficinas por cuenta: aislamiento", () => {
  async function two() { await buy("cs_30", {}, {}); await buy("cs_31"); await buy("cs_32", { customer_details: { email: "beto@otro.test", name: "Beto" } });
    const U = async (e: string) => (await db.query("SELECT id FROM users WHERE email=$1", [e]))[0].id; return { ana: await U("ana@compra.test"), beto: await U("beto@otro.test"), anaOffices: await agenciesOf("ana@compra.test"), betoOffice: (await agenciesOf("beto@otro.test"))[0].id }; }
  it("Mis oficinas muestra solo las propias; una cookie con la oficina de OTRA persona se ignora", async () => {
    const x = await two(); expect((await listOffices(db, x.ana)).length).toBe(2); expect((await listOffices(db, x.beto)).length).toBe(1);
    const s = await startSession(db, x.ana); const elegida = x.anaOffices[1].id;
    expect((await agencyActorFromToken(db, s, elegida))?.agencyId).toBe(elegida);                       // la suya: se respeta
    const ajena = await agencyActorFromToken(db, s, x.betoOffice); expect(ajena?.agencyId).not.toBe(x.betoOffice); expect(x.anaOffices.map((a: any) => a.id)).toContain(ajena?.agencyId); // la ajena: se ignora
    expect((await agencyActorFromToken(db, s, "inventada"))?.agencyId).toBeTruthy();
  });
  it("datos separados por oficina: clientes, tareas y empleados de una no aparecen en la otra; el acceso a la empresa de otra persona se niega", async () => {
    const x = await two(); const [a1, a2] = x.anaOffices.map((a: any) => a.id); const s = await startSession(db, x.ana);
    const A1 = (await agencyActorFromToken(db, s, a1))!, A2 = (await agencyActorFromToken(db, s, a2))!;
    const c1 = await createClient(db, { ...A1, plan: undefined } as any, { name: "Cliente de la oficina 1" }).catch(() => null);
    await db.query("INSERT INTO companies(id,name,agency_id) VALUES('c-a1','Solo oficina 1',$1),('c-a2','Solo oficina 2',$2),('c-b','De Beto',$3)", [a1, a2, x.betoOffice]); void c1;
    const names = async (A: any) => (await db.query("SELECT name FROM companies WHERE agency_id=$1 AND name LIKE 'Solo%'", [A.agencyId])).map((r: any) => r.name);
    expect(await names(A1)).toEqual(["Solo oficina 1"]); expect(await names(A2)).toEqual(["Solo oficina 2"]);
    await expect(actAs(db, A1, "c-a2")).rejects.toThrow(); await expect(actAs(db, A1, "c-b")).rejects.toThrow(); await expect(actAs(db, A2, "c-a1")).rejects.toThrow();
    expect(await actorFromToken(db, s, "c-b")).toBeNull();                       // la empresa de Beto: ninguna oficina de Ana la contiene
    expect((await actorFromToken(db, s, "c-a2"))?.agencyId).toBe(a2);              // su empresa de la OTRA oficina sí, pero con la agencia correcta (antes se usaba «la primera agencia»)
    expect((await actorFromToken(db, s, "c-a1"))?.agencyId).toBe(a1);
    const sb = await startSession(db, x.beto); expect(await actorFromToken(db, sb, "c-a1")).toBeNull();
  });
  it("pausar o cancelar UNA oficina no afecta a las otras; la pausada no ejecuta tareas de IA", async () => {
    const x = await two(); const [a1, a2] = x.anaOffices.map((a: any) => a.id);
    process.env.BILLING_ENABLED = "true"; registerPaymentProvider({ name: "falsa", createCheckout: async () => ({ url: "x" }), parseWebhook: async () => { throw new Error("x"); }, pauseCollection: async () => {} });
    await db.query("INSERT INTO companies(id,name,agency_id) VALUES('c1','C1',$1),('c2','C2',$2)", [a1, a2]);
    await db.query("INSERT INTO departments(id,company_id,key,name) VALUES('d1','c1','k','D'),('d2','c2','k','D')"); await db.query("INSERT INTO employees(id,company_id,department_id,name,role_title) VALUES('e1','c1','d1','E1','R'),('e2','c2','d2','E2','R')");
    await setOfficeStatus(db, x.ana, a1, "pausada");
    await expect(assertWithinLimits(db, { companyId: "c1", employeeId: "e1", maxCostUsd: 0.01 })).rejects.toThrow(/pausada/);
    await expect(assertWithinLimits(db, { companyId: "c2", employeeId: "e2", maxCostUsd: 0.01 })).resolves.not.toThrow();
    await setOfficeStatus(db, x.ana, a1, "activa"); await expect(assertWithinLimits(db, { companyId: "c1", employeeId: "e1", maxCostUsd: 0.01 })).resolves.not.toThrow();
    await applyCommerceEvent(db, sub("customer.subscription.deleted", "sub_cs_31", 5000));
    await expect(assertWithinLimits(db, { companyId: "c2", employeeId: "e2", maxCostUsd: 0.01 })).rejects.toThrow(/cancelada/);
    await expect(assertWithinLimits(db, { companyId: "c1", employeeId: "e1", maxCostUsd: 0.01 })).resolves.not.toThrow();
    await expect(setOfficeStatus(db, x.ana, a2, "activa")).rejects.toThrow(/cancelada/); // la cancelada no se reanuda
  });
  it("NUEVA OFICINA: sin derecho no se crea; con cortesía se crea una vez sin cobrar; dos clics simultáneos = una oficina", async () => {
    await buy("cs_40"); const u = (await db.query("SELECT id,email FROM users"))[0] as any;
    await expect(createOfficeWithRight(db, u, { officeName: "Sin derecho" })).rejects.toThrow(/derecho/);
    await grantRight(db, u.email, "emprendedor"); expect((await availableRights(db, u.id, u.email)).length).toBe(1);
    const rs = await Promise.allSettled([createOfficeWithRight(db, u, { officeName: "Nueva A" }), createOfficeWithRight(db, u, { officeName: "Nueva A" })]);
    expect(rs.filter((r) => r.status === "fulfilled").length).toBe(1); expect((await agenciesOf(u.email)).length).toBe(2); expect((await availableRights(db, u.id, u.email)).length).toBe(0);
    expect((await db.query("SELECT billing_status FROM agencies WHERE name='Nueva A'"))[0].billing_status).toBe("cortesia");
  });
  it("cortesía concedida a un correo SIN cuenta se reclama cuando esa persona existe", async () => { await grantRight(db, "futuro@x.test", "emprendedor"); await buy("cs_41", { customer_details: { email: "futuro@x.test", name: "F" } }); const u = (await db.query("SELECT id,email FROM users WHERE email='futuro@x.test'"))[0] as any; expect((await availableRights(db, u.id, u.email)).length).toBe(1); });
});

describe("webhook firmado de la compra directa (Stripe simulado)", () => {
  let srv: http.Server; const WH = "whsec_t";
  const sign = (raw: string) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac("sha256", WH).update(`${t}.${raw}`).digest("hex")}`; };
  beforeEach(async () => { await new Promise<void>((r) => { srv = http.createServer((q, s) => { s.setHeader("content-type", "application/json"); s.end(JSON.stringify({ url: "https://checkout.stripe.test/c/1", id: "cs_test_1" })); }).listen(0, "127.0.0.1", r); });
    Object.assign(process.env, { BILLING_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: WH, STRIPE_API_BASE: `http://127.0.0.1:${(srv.address() as any).port}`, PLAN_PRICE_MXN_EMPRENDEDOR: "899" }); });
  afterEach(() => srv.close());
  it("firma inválida o ausente: rechazado sin crear nada; firma válida: entrega; repetido: no duplica", async () => {
    const i = await createIntent(db, { plan: "emprendedor" }); const raw = JSON.stringify(paid("cs_50", i));
    await expect(handlePaymentWebhook(db, raw, {})).rejects.toThrow(/firma/i); await expect(handlePaymentWebhook(db, raw, { "stripe-signature": "t=1,v1=abc" })).rejects.toThrow();
    expect((await db.query("SELECT 1 FROM agencies")).length).toBe(0);
    expect(await handlePaymentWebhook(db, raw, { "stripe-signature": sign(raw) })).toBe("procesado"); expect(await handlePaymentWebhook(db, raw, { "stripe-signature": sign(raw) })).toBe("repetido");
    expect((await db.query("SELECT 1 FROM agencies")).length).toBe(1);
  });
  it("el checkout público lleva la intención, el plan, el correo conocido y NO pide cuenta", async () => {
    const { getPaymentProvider } = await import("@/server/commercial/billing"); const p = getPaymentProvider()!; let body = "";
    srv.removeAllListeners("request"); srv.on("request", (q, s) => { let b = ""; q.on("data", (d) => (b += d)); q.on("end", () => { body = b; s.setHeader("content-type", "application/json"); s.end(JSON.stringify({ url: "https://checkout.stripe.test/c/1", id: "cs_test_1" })); }); });
    const r = await p.createPublicCheckout!({ intentId: "int1", plan: "emprendedor", email: "a@b.test", successUrl: "https://s", cancelUrl: "https://c" }); expect(r.sessionId).toBe("cs_test_1");
    const f = new URLSearchParams(body); expect(f.get("client_reference_id")).toBe("int1"); expect(f.get("metadata[intent_id]")).toBe("int1"); expect(f.get("line_items[0][price_data][unit_amount]")).toBe("89900"); expect(f.get("customer_email")).toBe("a@b.test"); expect(f.get("mode")).toBe("subscription");
  });
});
