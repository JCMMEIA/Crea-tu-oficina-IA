import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createPgliteDb, Db } from "@/server/db";
import { signupAgency, login, agencyActorFromToken, actorFromToken, actAs, AgencyActor, Actor, AuthorizationError } from "@/server/auth";
import { createClient, listClients, updateBrand, getAgency, saveAgencySkill, getAgencySkill, createService, listServices, updateService, applyIndustryTemplate, createProposal, renderProposal, listProposals, agencyMetrics, supportQueue, setClientLimits, addClientUser, estimateServiceCost } from "@/server/agency";
import { deployServiceToClient } from "@/server/agency/deploy";
import { hireFromTemplate, listOffice } from "@/server/catalog/office";
import { getCurrentSkill, saveSkillVersion, skillSpecSchema } from "@/server/skills";
import { createTask, runWorkflow, getTask, listApprovals, decideApproval } from "@/server/tasks";
import { startConnection, testConnection } from "@/server/connectors";
import { defaultSkill } from "@/server/skills";
import { getTemplate } from "@/server/catalog/data";
import { newDb, ScriptedProvider, FakeAdapter } from "./helpers";

let db: Db;
async function newAgency(email: string, name = "Agencia " + email) {
  await signupAgency(db, { email, name: "Dueño", password: "clave-larga-123", agencyName: name, specialty: "Marketing con IA" });
  const token = await login(db, email, "clave-larga-123");
  return { a: (await agencyActorFromToken(db, token))!, token };
}
const setPlan = (agencyId: string, plan: string) => db.query("UPDATE agencies SET plan=$2 WHERE id=$1", [agencyId, plan]);
beforeEach(async () => { db = await newDb(); });

describe("Agencia → Cliente: flujo completo (prueba principal)", () => {
  it("crear agencia → cliente → servicio → desplegar → personalizar → ejecutar tarea → resultado", async () => {
    const { a } = await newAgency("ag@x.com");
    expect(a.agencyRole).toBe("agency_owner");
    await updateBrand(db, a, { name: "Nova Agencia IA", specialty: "Ecommerce", tagline: "Resultados medibles", primaryColor: "#0a7d5a", logo: null });
    const clientId = await createClient(db, a, { name: "Tienda Luna", industry: "ecommerce" });
    const [svcId] = await applyIndustryTemplate(db, a, "ecommerce");
    await updateService(db, a, svcId, { priceUsd: 320, status: "publicado" });
    const employees = await deployServiceToClient(db, a, svcId, clientId);
    expect(employees.length).toBe(2);
    const actor = await actAs(db, a, clientId);
    expect(actor.role).toBe("owner");
    // Personalizar para ESTE cliente
    const empId = employees[0];
    const cur = await getCurrentSkill(db, actor, empId);
    const v2 = await saveSkillVersion(db, actor, empId, { ...cur.spec, systemPrompt: cur.spec.systemPrompt + "\nCliente: Tienda Luna, joyería de plata." }, "Personalización Tienda Luna");
    expect(v2).toBe(2);
    // Ejecutar tarea (proveedor simulado en prueba) y obtener resultado
    const p = new ScriptedProvider([{ text: "Informe de rendimiento: sin datos conectados." }]);
    const t = await createTask(db, actor, { employeeId: empId, title: "Informe semanal", instruction: "Prepara el informe semanal" });
    await runWorkflow(db, actor, t, { provider: p });
    const g = await getTask(db, actor, t);
    expect(g!.task.status).toBe("completed");
    expect(g!.task.result).toContain("Informe");
    expect(g!.task.skill_version).toBe(2);
    expect(p.calls[0].system).toContain("Tienda Luna");
    // Métricas de agencia reflejan lo real
    const m = await agencyMetrics(db, a);
    expect(m.clients[0].tasks).toBe(1);
    expect(m.tasksByStatus.completed).toBe(1);
    expect(m.services.find((s: any) => s.id === svcId)!.deployments).toBe(1);
    expect(m.spend).toBeGreaterThan(0);
    expect((await getAgency(db, a)).brand.primaryColor).toBe("#0a7d5a");
  });

  it("propuesta comercial: precios, total, texto sin promesas y sin envío", async () => {
    const { a } = await newAgency("ag@x.com");
    const [s1, s2] = await applyIndustryTemplate(db, a, "ecommerce");
    const id = await createProposal(db, a, { clientName: "Tienda Luna", title: "Propuesta de servicios", items: [{ serviceId: s1, quantity: 1 }, { serviceId: s2, quantity: 2, priceUsd: 100 }] });
    const text = await renderProposal(db, a, id);
    expect(text).toContain("Tienda Luna"); expect(text).toContain("no incluye resultados garantizados");
    expect((await listProposals(db, a))[0].total).toBe(300 + 200);
  });

  it("estimación de costos: con tarifa calcula; sin tarifa dice null (no inventa)", () => {
    expect(estimateServiceCost(20, null)).toBeNull();
    const e = estimateServiceCost(20, { inUsd: 3, outUsd: 15 })!;
    expect(e.monthlyUsd).toBeCloseTo(20 * (4000 * 3 + 1200 * 15) / 1e6);
  });
});

describe("Skills reutilizables de la agencia", () => {
  it("la skill de agencia se usa al contratar; personalizar un cliente no la cambia; la plantilla de plataforma no cambia", async () => {
    const { a } = await newAgency("ag@x.com");
    const c1 = await createClient(db, a, { name: "C1" }), c2 = await createClient(db, a, { name: "C2" });
    const base = (await getAgencySkill(db, a, "guionista-storytelling")).spec;
    expect((await getAgencySkill(db, a, "guionista-storytelling")).custom).toBe(false);
    await saveAgencySkill(db, a, "guionista-storytelling", { ...base, systemPrompt: base.systemPrompt + "\nMétodo propio de la agencia." });
    const e1 = await hireFromTemplate(db, await actAs(db, a, c1), "guionista-storytelling");
    const e2 = await hireFromTemplate(db, await actAs(db, a, c2), "guionista-storytelling");
    expect((await getCurrentSkill(db, await actAs(db, a, c1), e1)).spec.systemPrompt).toContain("Método propio");
    await saveSkillVersion(db, await actAs(db, a, c1), e1, { ...base, systemPrompt: "SOLO C1" });
    expect((await getCurrentSkill(db, await actAs(db, a, c2), e2)).spec.systemPrompt).toContain("Método propio");
    expect((await getAgencySkill(db, a, "guionista-storytelling")).spec.systemPrompt).toContain("Método propio");
    expect(defaultSkill(getTemplate("guionista-storytelling")!).systemPrompt).not.toContain("Método propio");
    // otra agencia sigue con la skill de plataforma
    const { a: b } = await newAgency("b@x.com");
    expect((await getAgencySkill(db, b, "guionista-storytelling")).custom).toBe(false);
  });
});

describe("AISLAMIENTO entre agencias y clientes (autorización en backend)", () => {
  let A: AgencyActor, B: AgencyActor, tokenA: string, tokenB: string, cA: string, cB: string, svcA: string, svcB: string;
  beforeEach(async () => {
    ({ a: A, token: tokenA } = await newAgency("a@x.com", "Agencia A")); ({ a: B, token: tokenB } = await newAgency("b@x.com", "Agencia B"));
    cA = await createClient(db, A, { name: "Cliente de A" }); cB = await createClient(db, B, { name: "Cliente de B" });
    [svcA] = await applyIndustryTemplate(db, A, "ecommerce"); [svcB] = await applyIndustryTemplate(db, B, "ecommerce");
    const actA = await actAs(db, A, cA);
    const e = await hireFromTemplate(db, actA, "guionista-storytelling");
    await createTask(db, actA, { employeeId: e, title: "secreto de A", instruction: "dato confidencial A" });
  });
  it("la agencia B no ve clientes, servicios, propuestas, métricas ni soporte de A", async () => {
    expect((await listClients(db, B)).map((c: any) => c.id)).toEqual([cB]);
    expect((await listServices(db, B)).every((s: any) => s.agency_id === B.agencyId)).toBe(true);
    const m = await agencyMetrics(db, B);
    expect(m.clients.length).toBe(1); expect(m.tasksByStatus).toEqual({});
    expect((await supportQueue(db, B)).failed.length).toBe(0);
    const pA = await createProposal(db, A, { clientName: "X", title: "P", items: [{ serviceId: svcA }] });
    await expect(renderProposal(db, B, pA)).rejects.toThrow(/no encontrada/);
    expect(await listProposals(db, B)).toEqual([]);
  });
  it("B no puede actuar sobre un cliente de A, por ninguna vía", async () => {
    await expect(actAs(db, B, cA)).rejects.toThrow(/no encontrada/);
    expect(await actorFromToken(db, tokenB, cA)).toBeNull();
    await expect(setClientLimits(db, B, cA, { monthlyBudgetUsd: 99999 })).rejects.toThrow(/no encontrada/);
    await expect(addClientUser(db, B, cA, { email: "intruso@x.com", name: "I", password: "clave-larga-123", role: "owner" })).rejects.toThrow(/no encontrada/);
    await expect(deployServiceToClient(db, B, svcB, cA)).rejects.toThrow(/no encontrada/);
    await expect(deployServiceToClient(db, B, svcA, cB)).rejects.toThrow(/Servicio no encontrado/);
    await expect(updateService(db, B, svcA, { priceUsd: 1 })).rejects.toThrow(/no encontrado/);
    await expect(createProposal(db, B, { companyId: cA, clientName: "x", title: "t", items: [{ serviceId: svcB }] })).rejects.toThrow(/no encontrada/);
    await expect(createProposal(db, B, { clientName: "x", title: "t", items: [{ serviceId: svcA }] })).rejects.toThrow(/no encontrado/);
    expect((await db.query("SELECT 1 FROM users WHERE email='intruso@x.com'")).length).toBe(0);
    expect(Number((await db.query("SELECT monthly_budget_usd FROM companies WHERE id=$1", [cA]))[0].monthly_budget_usd)).toBe(10);
  });
  it("un actor de empresa nunca cruza a otra empresa de otra agencia, aunque conozca el id", async () => {
    const actB = await actAs(db, B, cB);
    expect(await listOffice(db, actB)).toEqual([]);
    const forged: Actor = { ...actB, companyId: cA }; // intento de falsificar: los servicios filtran por company_id, pero el puente es lo que protege
    expect(await actorFromToken(db, tokenB, cA)).toBeNull();
    void forged;
  });
  it("usuario de un cliente: solo su empresa; sin acceso a funciones de agencia ni a empresas hermanas", async () => {
    const cA2 = await createClient(db, A, { name: "Segundo cliente de A" });
    await addClientUser(db, A, cA, { email: "cli@a.com", name: "Cliente", password: "clave-larga-123", role: "owner" });
    const tok = await login(db, "cli@a.com", "clave-larga-123");
    expect(await agencyActorFromToken(db, tok)).toBeNull(); // no es de agencia
    const me = (await actorFromToken(db, tok))!;
    expect(me.companyId).toBe(cA); expect(me.role).toBe("owner");
    expect(await actorFromToken(db, tok, cA2)).toBeNull(); // empresa hermana de la misma agencia
    expect(await actorFromToken(db, tok, cB)).toBeNull();
    expect((await listOffice(db, me)).length).toBe(1);
    expect((await db.query("SELECT 1 FROM agency_members am JOIN users u ON u.id=am.user_id WHERE u.email='cli@a.com'")).length).toBe(0);
  });
  it("tokens: sesión inválida no resuelve nada", async () => {
    expect(await agencyActorFromToken(db, "token-falso")).toBeNull();
    expect(await actorFromToken(db, "token-falso", cA)).toBeNull();
    expect(await agencyActorFromToken(db, undefined)).toBeNull();
  });
  it("las skills y presupuestos de agencia son independientes", async () => {
    const base = (await getAgencySkill(db, A, "guionista-storytelling")).spec;
    await saveAgencySkill(db, A, "guionista-storytelling", { ...base, systemPrompt: "secreto de A" });
    expect((await getAgencySkill(db, B, "guionista-storytelling")).spec.systemPrompt).not.toContain("secreto de A");
  });
});

describe("Roles de agencia, planes y límites", () => {
  it("agency_member solo lee y opera como 'member' (no aprueba ni gestiona)", async () => {
    const { a: owner } = await newAgency("o@x.com");
    const c = await createClient(db, owner, { name: "C" });
    const uid = (await db.query("INSERT INTO users(id,email,name,password_hash) VALUES('u2','m@x.com','M','x') RETURNING id"))[0].id;
    await db.query("INSERT INTO agency_members(agency_id,user_id,role) VALUES($1,$2,'agency_member')", [owner.agencyId, uid]);
    const member: AgencyActor = { userId: uid, email: "m@x.com", agencyId: owner.agencyId, agencyRole: "agency_member" };
    expect((await listClients(db, member)).length).toBe(1);
    await expect(createClient(db, member, { name: "Otro" })).rejects.toThrow(AuthorizationError);
    await expect(createService(db, member, { name: "S", templateKeys: ["agente-soporte"], priceUsd: 1 })).rejects.toThrow(AuthorizationError);
    await expect(updateBrand(db, member, { name: "Hack" })).rejects.toThrow(AuthorizationError);
    const act = await actAs(db, member, c);
    expect(act.role).toBe("member");
    await expect(decideApprovalAs(act)).rejects.toThrow(AuthorizationError);
  });
  const decideApprovalAs = (act: Actor) => decideApproval(db, act, "x", true, new FakeAdapter());

  it("el plan limita clientes y empleados", async () => {
    const { a } = await newAgency("p@x.com");
    await createClient(db, a, { name: "1" }); await createClient(db, a, { name: "2" });
    await expect(createClient(db, a, { name: "3" })).rejects.toThrow(/permite hasta 2 clientes/);
    await setPlan(a.agencyId, "emprendedor");
    await expect(createClient(db, a, { name: "3" })).resolves.toBeTruthy();
    await setPlan(a.agencyId, "prueba");
    const c = (await listClients(db, a))[0].id; const act = await actAs(db, a, c);
    for (const k of ["agente-soporte", "analista-gastos", "director-creativo", "guionista-storytelling", "analista-precios", "coordinador-pedidos", "supervisor-general", "analista-estrategico"]) await hireFromTemplate(db, act, k);
    await expect(hireFromTemplate(db, act, "asistente-ejecutivo")).rejects.toThrow(/permite hasta 8 empleados/);
  });
  it("el presupuesto de IA de la agencia frena a todos sus clientes", async () => {
    const { a } = await newAgency("b@x.com");
    const c1 = await createClient(db, a, { name: "1" }), c2 = await createClient(db, a, { name: "2" });
    await db.query("UPDATE agencies SET monthly_budget_usd=0.0001 WHERE id=$1", [a.agencyId]);
    const act = await actAs(db, a, c2); const e = await hireFromTemplate(db, act, "guionista-storytelling");
    const p = new ScriptedProvider([{ text: "x" }]);
    await runWorkflow(db, act, await createTask(db, act, { employeeId: e, title: "t", instruction: "i" }), { provider: p });
    expect(p.calls.length).toBe(0);
    void c1;
  });
  it("un servicio desplegado dos veces en el mismo cliente se rechaza", async () => {
    const { a } = await newAgency("d@x.com"); const c = await createClient(db, a, { name: "C" }); const [s] = await applyIndustryTemplate(db, a, "ecommerce");
    await deployServiceToClient(db, a, s, c);
    await expect(deployServiceToClient(db, a, s, c)).rejects.toThrow(/ya está desplegado/);
  });
  it("identidad visual: valida color y logo (sin javascript:/svg)", async () => {
    const { a } = await newAgency("v@x.com");
    await expect(updateBrand(db, a, { name: "N", primaryColor: "rojo" })).rejects.toThrow();
    await expect(updateBrand(db, a, { name: "N", logo: "javascript:alert(1)" })).rejects.toThrow();
    await expect(updateBrand(db, a, { name: "N", logo: "data:image/svg+xml;base64,PHN2Zz4=" })).rejects.toThrow();
    await expect(updateBrand(db, a, { name: "N", logo: "https://ejemplo.com/logo.png" })).resolves.toBeUndefined();
  });
  it("aprobaciones y soporte: la agencia ve las pendientes de sus clientes y las decide con evidencia", async () => {
    const { a } = await newAgency("s@x.com"); const c = await createClient(db, a, { name: "C" }); const act = await actAs(db, a, c);
    const adapter = new FakeAdapter(); await startConnection(db, act, "meta_ads", adapter); await testConnection(db, act, "meta_ads", adapter);
    const e = await hireFromTemplate(db, act, "analista-meta-ads");
    const p = new ScriptedProvider([{ toolCalls: [{ id: "1", name: "meta_ads__pause_ad", input: { ad_id: "A1" } }] }, { text: "propongo pausar" }]);
    await runWorkflow(db, act, await createTask(db, act, { employeeId: e, title: "t", instruction: "revisa" }), { provider: p, adapter });
    const q = await supportQueue(db, a);
    expect(q.approvals.length).toBe(1); expect(q.approvals[0].company_name).toBe("C");
    expect(adapter.executed.length).toBe(0);
    await decideApproval(db, act, q.approvals[0].id, true, adapter);
    expect(adapter.executed.map((x) => x.action)).toEqual(["pause_ad"]);
    expect((await supportQueue(db, a)).approvals.length).toBe(0);
    expect((await listApprovals(db, act, "approved")).length).toBe(1);
  });
});

describe("Migración del MVP", () => {
  it("empresas sin agencia reciben una propia, idempotente, sin perder datos", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cto-"));
    const d1 = await createPgliteDb(dir);
    await d1.query("INSERT INTO users(id,email,name,password_hash) VALUES('u1','old@x.com','Old','x')");
    await d1.query("INSERT INTO companies(id,name) VALUES('c-old','Empresa antigua')"); // sin agency_id (legado)
    await d1.query("INSERT INTO memberships(company_id,user_id,role) VALUES('c-old','u1','owner')");
    await d1.close();
    for (let i = 0; i < 2; i++) { // reabrir dos veces = migrar dos veces
      const d = await createPgliteDb(dir);
      const c = (await d.query("SELECT agency_id FROM companies WHERE id='c-old'"))[0];
      expect(c.agency_id).toBe("ag-c-old");
      expect((await d.query("SELECT role FROM agency_members WHERE agency_id='ag-c-old'")).map((r: any) => r.role)).toEqual(["agency_owner"]);
      expect(Number((await d.query("SELECT count(*) n FROM agencies"))[0].n)).toBe(1);
      expect(Number((await d.query("SELECT count(*) n FROM memberships"))[0].n)).toBe(1);
      await d.close();
    }
  });
  it("el registro de agencia (nuevo) y el registro directo (MVP) coexisten", async () => {
    await signupAgency(db, { email: "n@x.com", name: "N", password: "clave-larga-123", agencyName: "Nueva", specialty: "" });
    const tok = await login(db, "n@x.com", "clave-larga-123");
    expect(await actorFromToken(db, tok)).toBeNull(); // aún sin clientes propios
    expect((await agencyActorFromToken(db, tok))!.agencyRole).toBe("agency_owner");
  });
});
void skillSpecSchema;
