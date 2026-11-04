import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http"; import { createHmac } from "node:crypto";
import { Db } from "@/server/db";
import { applyCommerceEvent } from "@/server/commerce/events";
import { createIntent } from "@/server/commerce/orders";
import { issueAccessLink, consumeAccessLink } from "@/server/commerce/access";
import { MailProvider, applyDeliveryEvent, mailConfig, mailProvider, processEmails, queueEmail, retryAllFailed, retryEmail, verifyDeliveryWebhook, EmailKind } from "@/server/commerce/mail";
import { classifyMailError, diagnoseEmail, maskEmail } from "@/server/commerce/email_health";
import { esc, layout } from "@/server/commerce/email_templates";
import { newDb } from "./helpers";

let db: Db; const OLD = { ...process.env };
const paid = (sid: string, intent: string, o: any = {}) => ({ id: "evt_" + sid, type: "checkout.session.completed", created: 1000, data: { object: { id: sid, mode: "subscription", payment_status: "paid", client_reference_id: intent, metadata: { intent_id: intent }, customer: "cus_" + sid, subscription: "sub_" + sid, customer_details: { email: "ana@compra.test", name: "Ana" }, amount_total: 89900, currency: "mxn", ...o } } });
async function buy(sid: string, email = "ana@compra.test") { const i = await createIntent(db, { plan: "emprendedor" }); await applyCommerceEvent(db, paid(sid, i, { customer_details: { email, name: "Ana" } })); }
const cap = () => { const sent: any[] = []; const p: MailProvider = { name: "t", send: async (m) => { sent.push(m); return "id" + sent.length; } }; return { sent, p }; };
beforeEach(async () => { db = await newDb(); process.env.NEXT_PUBLIC_SITE_URL = "https://app.ejemplo.test"; delete process.env.SITE_URL; delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; delete process.env.RESEND_WEBHOOK_SECRET; });
afterEach(() => { process.env = { ...OLD }; });

describe("plantillas", () => {
  it("escapan el contenido variable y traen logo, botón, versión de texto y adaptación a celular", () => {
    const h = layout({ site: "https://app.ejemplo.test", preheader: "pre", title: "Hola <b>x</b>", blocks: [{ p: esc("<script>alert(1)</script>") }], cta: { label: "Entrar", url: "https://app.ejemplo.test/acceso?t=abc" } });
    expect(h).not.toContain("<script>"); expect(h).toContain("&lt;script&gt;"); expect(h).toContain("https://app.ejemplo.test/icons/icon-192.png"); expect(h).toContain("max-width:100%"); expect(h).toContain("@media (max-width:620px)"); expect(h).toContain('href="https://app.ejemplo.test/acceso?t=abc"'); expect(h).toContain("lang=\"es\"");
  });
  it("los 7 tipos de correo se arman completos (HTML + texto); solo los de acceso llevan enlace con token", async () => {
    await buy("cs_t1"); const u = (await db.query("SELECT id FROM users"))[0].id; const ag = (await db.query("SELECT id FROM agencies"))[0].id; const ord = (await db.query("SELECT id FROM orders"))[0].id;
    const kinds: [EmailKind, any][] = [["acceso", { userId: u }], ["bienvenida", { userId: u, agencyId: ag }], ["oficina_entregada", { userId: u, agencyId: ag }], ["compra_confirmada", { orderId: ord, agencyId: ag }], ["pago_fallido", { agencyId: ag }], ["oficina_cancelada", { agencyId: ag }], ["seguridad", { cuando: new Date().toISOString() }]];
    await db.query("DELETE FROM emails"); for (const [k, p] of kinds) await queueEmail(db, { to: "x@y.test", kind: k, payload: p }); const { sent, p } = cap(); expect(await processEmails(db, p)).toMatchObject({ sent: 7, failed: 0 });
    for (const m of sent) { expect(m.html.length).toBeGreaterThan(800); expect(m.text.length).toBeGreaterThan(40); expect(m.subject.length).toBeGreaterThan(10); expect(m.html).toContain("Crea tu Oficina IA"); }
    const conLink = sent.filter((m) => /\/acceso\?t=/.test(m.text)).map((m) => m.subject); expect(conLink.length).toBe(3);
    expect(sent.find((m) => m.subject.includes("Confirmación"))!.text).toContain("899.00"); expect(sent.find((m) => m.subject.includes("Aviso de seguridad"))!.text).not.toMatch(/acceso\?t=/);
  });
  it("sin dirección pública NO se envían enlaces relativos: falla con un motivo claro", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL; await buy("cs_t2"); const { sent, p } = cap(); await processEmails(db, p); expect(sent.length).toBe(0);
    const e = (await db.query("SELECT last_error FROM emails"))[0].last_error; expect(e).toMatch(/dirección pública/); expect(classifyMailError(e)!.solucion).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("proveedor (Resend simulado en un servidor local — NO es Resend real)", () => {
  let srv: http.Server; let mode = "ok"; let lastBody: any = null; let lastAuth = "";
  beforeEach(async () => { mode = "ok"; await new Promise<void>((r) => { srv = http.createServer((q, s) => { let b = ""; q.on("data", (d) => (b += d)); q.on("end", () => { lastAuth = String(q.headers.authorization); lastBody = JSON.parse(b || "{}"); s.setHeader("content-type", "application/json");
    if (mode === "dominio") { s.statusCode = 403; return s.end(JSON.stringify({ statusCode: 403, name: "validation_error", message: "The mmeia.tech domain is not verified. Please, add and verify your domain." })); }
    if (mode === "clave") { s.statusCode = 401; return s.end(JSON.stringify({ statusCode: 401, name: "missing_api_key", message: "Missing API key." })); }
    s.end(JSON.stringify({ id: "re_msg_123" })); }); }).listen(0, "127.0.0.1", r); });
    Object.assign(process.env, { RESEND_API_KEY: "re_claveSecretaDePrueba123", MAIL_FROM: "Crea tu Oficina IA <acceso@mmeia.tech>", MAIL_API_BASE: `http://127.0.0.1:${(srv.address() as any).port}` }); });
  afterEach(() => srv.close());
  it("envía HTML y texto con el remitente configurado y la clave solo en el encabezado", async () => {
    await buy("cs_p1"); const r = await processEmails(db); expect(r).toMatchObject({ sent: 2, failed: 0 });
    expect(lastAuth).toBe("Bearer re_claveSecretaDePrueba123"); expect(lastBody.from).toBe("Crea tu Oficina IA <acceso@mmeia.tech>"); expect(lastBody.to).toEqual(["ana@compra.test"]); expect(lastBody.html).toContain("<html"); expect(lastBody.text.length).toBeGreaterThan(30);
    const rows = await db.query("SELECT status,provider_id,provider_status,delivery_status FROM emails"); expect(rows.every((x: any) => x.status === "enviado" && x.provider_id === "re_msg_123" && x.provider_status === 200 && x.delivery_status === "aceptado")).toBe(true);
    expect(JSON.stringify(await db.query("SELECT * FROM emails"))).not.toContain("claveSecreta");
  });
  it("dominio sin verificar (403): se guarda el MENSAJE del proveedor, no un código mudo; el diagnóstico dice qué hacer; los reintentos manuales están limitados", async () => {
    mode = "dominio"; await buy("cs_p2"); await processEmails(db);
    const e = (await db.query("SELECT last_error,provider_status FROM emails ORDER BY created_at LIMIT 1"))[0]; expect(e.provider_status).toBe(403); expect(e.last_error).toMatch(/domain is not verified/); expect(classifyMailError(e.last_error)!.causa).toMatch(/dominio.*no está verificado/i);
    for (let i = 0; i < 5; i++) { await db.query("UPDATE emails SET retry_at=now() WHERE status='en_cola'"); await processEmails(db); } expect((await db.query("SELECT 1 FROM emails WHERE status='error'")).length).toBe(2);
    const d = await diagnoseEmail(db); expect(d.issues.some((i) => /fallaron tras todos los reintentos/.test(i.titulo) && /verifica el dominio/i.test(i.solucion))).toBe(true);
    mode = "ok"; const id = (await db.query("SELECT id FROM emails WHERE status='error' LIMIT 1"))[0].id; expect(await retryEmail(db, id)).toBe(true); await processEmails(db); expect((await db.query("SELECT status FROM emails WHERE id=$1", [id]))[0].status).toBe("enviado");
    for (let i = 0; i < 3; i++) { mode = "dominio"; await db.query("UPDATE emails SET status='error', attempts=5 WHERE id=$1", [id]); await retryEmail(db, id); }
    await db.query("UPDATE emails SET status='error', attempts=5 WHERE id=$1", [id]); expect(await retryEmail(db, id)).toBe(false); // ya no hay más de 3 manuales
  });
  it("clave inválida (401) y servidor inalcanzable se clasifican con su causa", async () => {
    mode = "clave"; await buy("cs_p3"); await processEmails(db); expect(classifyMailError((await db.query("SELECT last_error FROM emails ORDER BY created_at LIMIT 1"))[0].last_error)!.causa).toMatch(/clave de Resend/i);
    srv.close(); process.env.MAIL_API_BASE = "http://127.0.0.1:1"; await db.query("UPDATE emails SET retry_at=now()"); await processEmails(db); const e = (await db.query("SELECT last_error FROM emails WHERE last_error LIKE '%contactar%' LIMIT 1"))[0]; expect(e).toBeTruthy(); expect(classifyMailError(e.last_error)!.causa).toMatch(/no logra conectarse/);
  });
  it("configuración: detecta formatos y nunca expone la clave", () => { const c = mailConfig(); expect(c).toMatchObject({ keySet: true, keyShapeOk: true, fromOk: true, fromDomain: "mmeia.tech" }); expect(JSON.stringify(c)).not.toContain("claveSecreta"); expect(mailProvider()).not.toBeNull(); });
});

describe("sin proveedor configurado (el síntoma «no recibo ningún correo»)", () => {
  it("la solicitud de acceso queda en cola, se MARCA el motivo y el diagnóstico es crítico y accionable", async () => {
    await queueEmail(db, { to: "jose@x.test", kind: "acceso", payload: { userId: "u" } }); const r = await processEmails(db, null); expect(r).toMatchObject({ sent: 0, failed: 0, skipped: 1 });
    expect((await db.query("SELECT status,last_error FROM emails"))[0]).toMatchObject({ status: "en_cola", last_error: expect.stringMatching(/Sin proveedor de correo/) });
    await db.query("UPDATE emails SET created_at = now() - interval '20 minutes'"); const d = await diagnoseEmail(db);
    expect(d.configured).toBe(false); expect(d.issues.filter((i) => i.nivel === "critico").map((i) => i.titulo).join("|")).toMatch(/Falta RESEND_API_KEY.*Falta MAIL_FROM.*sin salir/s); expect(d.issues.find((i) => /sin salir/.test(i.titulo))!.solucion).toMatch(/configurar_ventas/);
  });
});

describe("estado de entrega real (webhook firmado, formato Svix)", () => {
  const secret = "whsec_" + Buffer.from("secreto-de-prueba-0123456789").toString("base64");
  const sign = (raw: string, id = "msg_1", ts = Math.floor(Date.now() / 1000), key = secret) => ({ "svix-id": id, "svix-timestamp": String(ts), "svix-signature": "v1," + createHmac("sha256", Buffer.from(key.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${raw}`).digest("base64") });
  it("firma válida pasa; cuerpo alterado, secreto distinto, firma ausente o mensaje viejo fallan", () => {
    const raw = '{"type":"email.delivered"}'; expect(verifyDeliveryWebhook(raw, sign(raw), secret)).toBe(true);
    expect(verifyDeliveryWebhook(raw + " ", sign(raw), secret)).toBe(false); expect(verifyDeliveryWebhook(raw, sign(raw, "m", undefined, "whsec_" + Buffer.from("otro").toString("base64")), secret)).toBe(false);
    expect(verifyDeliveryWebhook(raw, {}, secret)).toBe(false); expect(verifyDeliveryWebhook(raw, sign(raw, "m", Math.floor(Date.now() / 1000) - 4000), secret)).toBe(false); expect(verifyDeliveryWebhook(raw, sign(raw), undefined)).toBe(false);
  });
  it("entregado/rebotó se guarda por correo; un estado atrasado no pisa uno final; ids desconocidos se ignoran", async () => {
    await buy("cs_w1"); const { p } = cap(); await processEmails(db, p); const pid = (await db.query("SELECT provider_id FROM emails ORDER BY created_at LIMIT 1"))[0].provider_id;
    expect(await applyDeliveryEvent(db, { type: "email.delivered", data: { email_id: pid } })).toBe("actualizado"); expect((await db.query("SELECT delivery_status FROM emails WHERE provider_id=$1", [pid]))[0].delivery_status).toBe("delivered");
    expect(await applyDeliveryEvent(db, { type: "email.sent", data: { email_id: pid } })).toBe("ignorado"); // llegó tarde
    expect(await applyDeliveryEvent(db, { type: "email.bounced", data: { email_id: pid, bounce: { message: "Buzón inexistente" } } })).toBe("actualizado"); expect((await db.query("SELECT delivery_status,delivery_detail FROM emails WHERE provider_id=$1", [pid]))[0]).toMatchObject({ delivery_status: "bounced", delivery_detail: "Buzón inexistente" });
    expect(await applyDeliveryEvent(db, { type: "email.delivered", data: { email_id: "no-existe" } })).toBe("ignorado"); expect(await applyDeliveryEvent(db, { type: "email.opened", data: { email_id: pid } })).toBe("ignorado");
    process.env.RESEND_API_KEY = "re_x1234567890"; process.env.MAIL_FROM = "a <a@b.co>"; const d = await diagnoseEmail(db); expect(d.issues.some((i) => /rebotaron/.test(i.titulo))).toBe(true);
  });
});

describe("avisos de seguridad y confirmaciones", () => {
  it("iniciar sesión con enlace genera UN aviso de seguridad (no en la primera entrada tras comprar; no se repite en 30 min)", async () => {
    await buy("cs_s1"); const uid = (await db.query("SELECT id FROM users"))[0].id; const n = async () => Number((await db.query("SELECT count(*) n FROM emails WHERE kind='seguridad'"))[0].n);
    await consumeAccessLink(db, await issueAccessLink(db, uid, "bienvenida")); expect(await n()).toBe(0);
    await consumeAccessLink(db, await issueAccessLink(db, uid, "acceso")); expect(await n()).toBe(1); await consumeAccessLink(db, await issueAccessLink(db, uid, "acceso")); expect(await n()).toBe(1);
  });
  it("primera compra = confirmación + bienvenida; segunda oficina = confirmación + oficina entregada; eventos repetidos no duplican ningún correo", async () => {
    const i1 = await createIntent(db, { plan: "emprendedor" }); const ev1 = paid("cs_c1", i1); await Promise.all([applyCommerceEvent(db, ev1), applyCommerceEvent(db, ev1), applyCommerceEvent(db, ev1)]);
    const uid = (await db.query("SELECT id FROM users"))[0].id; const i2 = await createIntent(db, { plan: "emprendedor", kind: "adicional", userId: uid }); const ev2 = paid("cs_c2", i2); await applyCommerceEvent(db, ev2); await applyCommerceEvent(db, ev2);
    expect((await db.query("SELECT kind FROM emails ORDER BY kind")).map((r: any) => r.kind)).toEqual(["bienvenida", "compra_confirmada", "compra_confirmada", "oficina_entregada"]);
    expect((await db.query("SELECT 1 FROM users")).length).toBe(1); expect((await db.query("SELECT 1 FROM agencies")).length).toBe(2);
  });
  it("reintentar todos los fallidos respeta el tope y maskEmail oculta el buzón", async () => { expect(await retryAllFailed(db)).toBe(0); expect(maskEmail("jose.perez@gmail.com")).toBe("jo***@gmail.com"); expect(maskEmail("ab@x.co")).toBe("ab***@x.co"); });
});
