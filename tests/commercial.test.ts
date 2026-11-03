import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Db } from "@/server/db";
import { login, signupAgency, agencyActorFromToken, AgencyActor } from "@/server/auth";
import { addLead, deriveSource, pickUtm } from "@/server/leads";
import { isPlatformAdmin, Operator } from "@/server/commercial/admin";
import { addNote, crmSummary, listLeads, setFollowup, setLeadStatus, getLead } from "@/server/commercial/crm";
import { trackPublic } from "@/server/commercial/events";
import { funnel } from "@/server/commercial/metrics";
import { cancelLicense, billingEnabled, entitlements, grantLicense, handlePaymentWebhook, registerPaymentProvider, startCheckout } from "@/server/commercial/billing";
import { createSupportRequest, listSupport } from "@/server/commercial/support";
import { activationChecklist, prepareDemo } from "@/server/commercial/activation";
import { createClient } from "@/server/agency";
import { planPrice } from "@/server/agency/plans";
import { newDb } from "./helpers";

let db: Db; const OLD = { ...process.env };
const op: Operator = { userId: "op1", email: "jose@ejemplo.test" };
async function mkAgency(email: string, name = "Agencia X", source = ""): Promise<AgencyActor> {
  await signupAgency(db, { email, name: "Dueña", password: "clave-larga-123", agencyName: name, source });
  return (await agencyActorFromToken(db, await login(db, email, "clave-larga-123")))!;
}
beforeEach(async () => { db = await newDb(); process.env.PLATFORM_ADMIN_EMAILS = "jose@ejemplo.test, otro@ejemplo.test"; delete process.env.BILLING_ENABLED; registerPaymentProvider(null); });
afterEach(() => { process.env = { ...OLD }; });

describe("captación de prospectos", () => {
  it("demo: guarda intereses, negocio, fuente y programa recordatorio a 24 h; sin consentimiento se rechaza", async () => {
    await addLead(db, { email: "Ana@X.com", name: "Ana", kind: "demo", company: "Tienda Ana", phone: "555", interests: ["inventarios", "anuncios"], preferredTime: "martes tarde", consent: true, utm: pickUtm({ utm_source: "meta", utm_campaign: "c1" }) });
    const l = (await db.query("SELECT * FROM leads"))[0];
    expect(l.kind).toBe("demo"); expect(l.status).toBe("nuevo"); expect(l.source).toBe("meta"); expect(l.interests).toEqual(["inventarios", "anuncios"]); expect(l.demo_requested_at).toBeTruthy(); expect(l.next_followup_at).toBeTruthy();
    await expect(addLead(db, { email: "b@x.com", kind: "demo", consent: false })).rejects.toThrow();
    await expect(addLead(db, { email: "b@x.com", kind: "demo", interests: ["hackeo"], consent: true })).rejects.toThrow();
  });
  it("mismo correo: conserva estado y notas; una demo no se degrada a acceso; no pisa datos con vacíos", async () => {
    await addLead(db, { email: "a@x.com", name: "Ana", company: "Tienda", consent: true });
    const id = (await db.query("SELECT id FROM leads"))[0].id; await setLeadStatus(db, op, id, "contactado"); await addNote(db, op, id, "Hablé con ella");
    await addLead(db, { email: "a@x.com", kind: "demo", consent: true });
    await addLead(db, { email: "a@x.com", kind: "acceso", consent: true });
    const r = await db.query("SELECT * FROM leads"); expect(r.length).toBe(1);
    expect(r[0].status).toBe("contactado"); expect(r[0].kind).toBe("demo"); expect(r[0].company).toBe("Tienda"); expect(r[0].name).toBe("Ana");
    expect((await getLead(db, op, id)).notes.length).toBe(1);
  });
  it("fuente de tráfico: utm > fbclid > referencia > directo", () => {
    expect(deriveSource({ utm_source: "Meta" })).toBe("meta"); expect(deriveSource({ fbclid: "x" })).toBe("meta");
    expect(deriveSource({}, "https://www.google.com/search?q=x")).toBe("google.com"); expect(deriveSource({}, "")).toBe("directo"); expect(deriveSource({}, "basura")).toBe("directo");
  });
});

describe("panel comercial (solo operadores)", () => {
  it("quien no es operador no puede leer ni modificar nada", async () => {
    await addLead(db, { email: "a@x.com", consent: true }); const id = (await db.query("SELECT id FROM leads"))[0].id;
    const nobody: Operator = { userId: "u", email: "intruso@x.com" };
    for (const f of [() => listLeads(db, nobody), () => listLeads(db, null), () => setLeadStatus(db, nobody, id, "ganado"), () => addNote(db, nobody, id, "x"), () => funnel(db, nobody), () => crmSummary(db, nobody), () => listSupport(db, nobody), () => grantLicense(db, nobody, "a", "agencia")])
      await expect(f()).rejects.toThrow(/permiso/);
    expect(isPlatformAdmin("JOSE@ejemplo.test")).toBe(true); expect(isPlatformAdmin("x@y.com")).toBe(false);
    delete process.env.PLATFORM_ADMIN_EMAILS; expect(isPlatformAdmin("jose@ejemplo.test")).toBe(false); // sin variable, nadie
  });
  it("estados, filtros, recordatorios vencidos y resumen", async () => {
    await addLead(db, { email: "a@x.com", kind: "demo", consent: true }); await addLead(db, { email: "b@x.com", consent: true });
    const [a, b] = [(await db.query("SELECT id FROM leads WHERE email='a@x.com'"))[0].id, (await db.query("SELECT id FROM leads WHERE email='b@x.com'"))[0].id];
    expect((await listLeads(db, op, { kind: "demo" })).map((l: any) => l.email)).toEqual(["a@x.com"]);
    expect((await crmSummary(db, op)).demosPorAtender).toBe(1);
    await setFollowup(db, op, b, new Date(Date.now() - 3600_000).toISOString(), "llamar");
    expect((await listLeads(db, op, { due: true })).map((l: any) => l.email)).toEqual(["b@x.com"]);
    expect((await crmSummary(db, op)).recordatoriosVencidos).toBe(1);
    await setLeadStatus(db, op, b, "perdido"); expect((await listLeads(db, op, { due: true })).length).toBe(0); // cerrado: ya no recuerda
    await setLeadStatus(db, op, a, "demo_agendada"); expect((await crmSummary(db, op)).byStatus.demo_agendada).toBe(1);
    await expect(setLeadStatus(db, op, a, "inventado")).rejects.toThrow(); await expect(setLeadStatus(db, op, "nada", "ganado")).rejects.toThrow();
    expect((await listLeads(db, op, { q: "B@X" })).length).toBe(1);
  });
});

describe("medición honesta", () => {
  it("solo acepta eventos públicos permitidos; compras no se pueden inyectar", async () => {
    expect(await trackPublic(db, { name: "visita", path: "/", utm: { utm_source: "meta" } })).toBe(true);
    expect(await trackPublic(db, { name: "cta_click", path: "/demo", cta: "hero" })).toBe(true);
    expect(await trackPublic(db, { name: "compra", path: "/" })).toBe(false); expect(await trackPublic(db, { name: "visita", path: "http://evil" })).toBe(false); expect(await trackPublic(db, { name: "visita", path: "/<script>" })).toBe(false);
    const f = await funnel(db, op); expect(f.visitas).toBe(1); expect(f.clicsCta).toBe(1); expect(f.visitsBySource[0].source).toBe("meta");
    const cols = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='events'")).map((r: any) => r.column_name);
    expect(cols).not.toContain("ip"); expect(cols).not.toContain("user_agent");
  });
  it("sin datos: ceros y «no activo», nunca cifras inventadas", async () => {
    const f = await funnel(db, op);
    expect(f).toMatchObject({ visitas: 0, leads: 0, demos: 0, registros: 0, activaciones: 0, planesSolicitados: 0 });
    expect(f.compras).toEqual({ activo: false, cantidad: 0 }); expect(f.cancelaciones.cantidad).toBe(0); expect(f.retencion7d).toBeNull(); expect(f.costoIA.usd).toBe(0);
  });
  it("cuenta registros por fuente y activación real (empleado + tarea completada), no solo el registro", async () => {
    const a = await mkAgency("a@x.com", "A", "meta"); await mkAgency("b@x.com", "B", "directo");
    let f = await funnel(db, op); expect(f.registros).toBe(2); expect(f.activaciones).toBe(0); expect(f.regBySource.find((r: any) => r.source === "meta")!.registros).toBe(1);
    await prepareDemo(db, a, ["anuncios"]);
    const c = (await db.query("SELECT c.id cid,e.id eid FROM companies c JOIN employees e ON e.company_id=c.id WHERE c.agency_id=$1 LIMIT 1", [a.agencyId]))[0];
    f = await funnel(db, op); expect(f.activaciones).toBe(0); // empleado sin tarea completada
    await db.query("INSERT INTO tasks(id,company_id,employee_id,title,instruction,status,fingerprint) VALUES('t1',$1,$2,'x','x','completed','fp')", [c.cid, c.eid]);
    f = await funnel(db, op); expect(f.activaciones).toBe(1);
  });
  it("costo de IA sale de usage_events reales", async () => {
    const a = await mkAgency("a@x.com"); await prepareDemo(db, a, ["anuncios"]);
    const cid = (await db.query("SELECT id FROM companies WHERE agency_id=$1", [a.agencyId]))[0].id;
    await db.query("INSERT INTO usage_events(company_id,input_tokens,output_tokens,cost_usd) VALUES($1,10,10,0.5)", [cid]);
    expect((await funnel(db, op)).costoIA.usd).toBeCloseTo(0.5);
  });
});

describe("compra y licencias (cobro DESACTIVADO)", () => {
  it("contratar registra una solicitud: no cambia el plan, no cobra y es idempotente", async () => {
    const a = await mkAgency("a@x.com"); expect(billingEnabled()).toBe(false);
    const r = await startCheckout(db, a, "agencia"); expect(r.mode).toBe("solicitud");
    const r2 = await startCheckout(db, a, "agencia"); expect(r2).toEqual(r);
    const e = await entitlements(db, a); expect(e.plan).toBe("prueba"); expect(e.pendingRequest?.plan).toBe("agencia"); expect(e.license).toBeNull();
    await expect(startCheckout(db, a, "prueba")).rejects.toThrow(); await expect(startCheckout(db, a, "oro")).rejects.toThrow();
    expect((await funnel(db, op)).planesSolicitados).toBe(1); expect((await funnel(db, op)).compras.cantidad).toBe(0);
  });
  it("BILLING_ENABLED=true sin pasarela implementada sigue apagado, y el webhook se rechaza", async () => {
    process.env.BILLING_ENABLED = "true"; expect(billingEnabled()).toBe(false);
    const a = await mkAgency("a@x.com"); expect((await startCheckout(db, a, "agencia")).mode).toBe("solicitud");
    await expect(handlePaymentWebhook(db, "{}", {})).rejects.toThrow(/desactivados/);
  });
  it("licencia manual por operador: cambia límites reales, queda en historial y NO cuenta como compra; cancelar vuelve a prueba", async () => {
    const a = await mkAgency("a@x.com"); await startCheckout(db, a, "emprendedor");
    await grantLicense(db, op, a.agencyId, "emprendedor", "cortesía");
    let e = await entitlements(db, a); expect(e.plan).toBe("emprendedor"); expect(e.maxClients).toBe(5); expect(e.license?.origin).toBe("manual"); expect(e.pendingRequest).toBeNull();
    let f = await funnel(db, op); expect(f.compras.cantidad).toBe(0);
    await cancelLicense(db, op, a.agencyId); e = await entitlements(db, a); expect(e.plan).toBe("prueba"); expect(e.license?.status).toBe("cancelada");
    f = await funnel(db, op); expect(f.cancelaciones.cantidad).toBe(1);
    await expect(grantLicense(db, op, a.agencyId, "oro")).rejects.toThrow();
  });
  it("el límite del plan se aplica de verdad al conceder/cancelar", async () => {
    const a = await mkAgency("a@x.com"); await createClient(db, a, { name: "C1" }); await createClient(db, a, { name: "C2" });
    await expect(createClient(db, a, { name: "C3" })).rejects.toThrow(/permite hasta 2/);
    await grantLicense(db, op, a.agencyId, "emprendedor"); await createClient(db, a, { name: "C3" });
  });
  it("una pasarela registrada SÍ crea licencia 'pasarela' (contrato listo), y solo con la bandera activa", async () => {
    const a = await mkAgency("a@x.com");
    registerPaymentProvider({ name: "falsa-de-prueba", createCheckout: async () => ({ url: "https://pago.test/x" }), parseWebhook: async () => ({ type: "paid", agencyId: a.agencyId, plan: "agencia", externalId: "pay_1" }) });
    expect(billingEnabled()).toBe(false); await expect(handlePaymentWebhook(db, "{}", {})).rejects.toThrow();
    process.env.BILLING_ENABLED = "true"; expect(billingEnabled()).toBe(true);
    expect(await startCheckout(db, a, "agencia")).toEqual({ mode: "pago", url: "https://pago.test/x" });
    await handlePaymentWebhook(db, "{}", {}); expect((await entitlements(db, a)).license?.origin).toBe("pasarela"); expect((await funnel(db, op)).compras.cantidad).toBe(1);
  });
  it("precios: sin configurar = null (nunca inventados)", () => { expect(planPrice("agencia")).toBeNull(); process.env.PLAN_PRICE_USD_AGENCIA = "49"; expect(planPrice("agencia")).toBe(49); process.env.PLAN_PRICE_USD_AGENCIA = "abc"; expect(planPrice("agencia")).toBeNull(); });
});

describe("activación y soporte", () => {
  it("la lista se calcula de la base y «preparar demostración» es idempotente", async () => {
    const a = await mkAgency("a@x.com"); let c = await activationChecklist(db, a);
    expect(c.items.find((i) => i.id === "demo")!.done).toBe(false); expect(c.done).toBeLessThan(c.total);
    const r = await prepareDemo(db, a, ["anuncios", "inventarios"]); expect(r.hired).toBeGreaterThan(0);
    c = await activationChecklist(db, a);
    for (const id of ["servicios", "empleados", "demo"]) expect(c.items.find((i) => i.id === id)!.done).toBe(true);
    expect(c.items.find((i) => i.id === "cliente")!.done).toBe(false);
    expect((await prepareDemo(db, a, ["anuncios"])).hired).toBe(0);
    await expect(prepareDemo(db, a, [])).rejects.toThrow();
    await startCheckout(db, a, "agencia"); expect((await activationChecklist(db, a)).items.find((i) => i.id === "plan")!.done).toBe(true);
  });
  it("soporte: valida, honeypot, y solo el operador lo lee", async () => {
    await createSupportRequest(db, { email: "a@x.com", subject: "No entiendo", body: "Necesito ayuda con el paso 2" });
    expect(await createSupportRequest(db, { email: "bot@x.com", subject: "spam", body: "spam spam spam" }, {}, "x")).toBe("ignored");
    await expect(createSupportRequest(db, { email: "mal", subject: "x", body: "corto" })).rejects.toThrow();
    expect((await listSupport(db, op)).length).toBe(1);
  });
});
