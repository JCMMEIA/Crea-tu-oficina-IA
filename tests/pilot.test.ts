import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { actAs, Actor, AgencyActor } from "@/server/auth";
import { analyze, parseInventory, importInventory, executeInternal, listDrafts, listInventory, loadItems } from "@/server/inventory";
import { PILOT, EXPECTED, VERDE_VIVO_CSV, createPilotAgency, createPilotClient, hirePilotTeam, createPilotAutomation } from "@/server/pilot";
import { runDueAutomations } from "@/server/automations";
import { decideApproval, listApprovals, listTasks, getTask, createTask } from "@/server/tasks";
import { companyScene } from "@/server/office3d";
import { createClient } from "@/server/agency";
import { hireFromTemplate } from "@/server/catalog/office";
import { createLinkCode, getActiveIdentity } from "@/server/messaging/link";
import { handleInbound } from "@/server/messaging/coordinator";
import { processJobs, scanNotifications } from "@/server/messaging/jobs";
import { InboundMessage } from "@/server/messaging/types";
import { newDb, FakeAdapter, FakeChannel } from "./helpers";
import { identityFor } from "@/features/employees/catalog";
const idn = (k: string) => identityFor(k)!.nombre; // los empleados contratados llevan su nombre propio, no el del puesto
import { PilotSimProvider } from "../scripts/pilot/sim_provider";

let db: Db, A: AgencyActor, owner: Actor, companyId: string, team: Record<string, string>, connector: FakeAdapter;
const day = 86400_000;
async function runAutomation(sim = new PilotSimProvider()) { const t0 = new Date(); await createPilotAutomation(db, owner, team["controlador-inventario"], t0); await runDueAutomations(db, { provider: sim, adapter: connector, retryDelayMs: 0 }, new Date(t0.getTime() + day + 60_000)); return sim; }
beforeEach(async () => {
  db = await newDb(); connector = new FakeAdapter();
  A = await createPilotAgency(db, { email: "nova@pilot.test", password: "clave-piloto-123" });
  ({ companyId, actor: owner } = await createPilotClient(db, A)); team = await hirePilotTeam(db, owner);
});

describe("inventario ficticio de Verde Vivo", () => {
  it("detecta 3 productos bajo el mínimo y 66 unidades hasta el máximo (cálculo, no IA)", async () => {
    expect(await importInventory(db, owner, VERDE_VIVO_CSV)).toEqual({ loaded: 10 });
    const { analysis } = await listInventory(db, owner);
    expect(analysis.total_productos).toBe(10); expect(analysis.bajo_minimo.map((l) => l.sku)).toEqual(["VV-FER-1", "VV-MAC-20", "VV-SUS-5"]);
    expect(analysis.total_unidades).toBe(EXPECTED.unidades); expect(analysis.bajo_minimo.length).toBe(EXPECTED.bajoMinimo);
    expect(analysis.bajo_minimo.map((l) => l.unidades).sort((a, b) => a - b)).toEqual([18, 22, 26]);
    // comprobación independiente en SQL (no usa analyze)
    const q = (await db.query("SELECT count(*)::int n, sum(max_stock-stock)::int u FROM inventory_items WHERE company_id=$1 AND stock<min_stock", [companyId]))[0];
    expect(q).toEqual({ n: 3, u: 66 });
  });
  it("un producto exactamente en el mínimo NO está «bajo el mínimo»; sin faltantes → 0 unidades", () => {
    expect(analyze([{ sku: "A", name: "A", stock: 6, min: 6, max: 18, cost: 1, supplier: "" }]).bajo_minimo).toEqual([]);
    expect(analyze([{ sku: "A", name: "A", stock: 5, min: 6, max: 18, cost: 2, supplier: "" }])).toMatchObject({ total_unidades: 13, costo_estimado: 26 });
  });
  it("rechaza archivos inválidos con mensajes claros y no cambia nada (todo o nada)", async () => {
    await importInventory(db, owner, VERDE_VIVO_CSV);
    const bad: [string, RegExp][] = [["sku,producto,stock\nA,x,1", /Falta la columna/], ["sku,producto,stock,minimo,maximo\nA,x,-1,2,5", /entero de 0/], ["sku,producto,stock,minimo,maximo\nA,x,1,9,5", /mínimo .* no puede ser mayor/],
      ["sku,producto,stock,minimo,maximo\nA,x,1,2,5\nA,y,1,2,5", /SKU repetido/], ["sku,producto,stock,minimo,maximo\nA,x,uno,2,5", /entero/], ["", /no tiene datos/]];
    for (const [csv, re] of bad) await expect(importInventory(db, owner, csv)).rejects.toThrow(re);
    expect((await loadItems(db, companyId)).length).toBe(10);
  });
  it("acepta comillas, columnas en otro orden y CRLF", () => {
    const r = parseInventory('maximo,minimo,stock,producto,sku\r\n20,5,1,"Maceta, grande",M1\r\n'); expect(r.errors).toEqual([]); expect(r.items[0]).toMatchObject({ name: "Maceta, grande", stock: 1, min: 5, max: 20 });
  });
  it("solo quien administra puede cargar; quien solo ve puede consultar", async () => {
    await expect(importInventory(db, { ...owner, role: "viewer" }, VERDE_VIVO_CSV)).rejects.toThrow();
    await importInventory(db, owner, VERDE_VIVO_CSV); expect((await listInventory(db, { ...owner, role: "viewer" })).items.length).toBe(10);
  });
  it("el inventario es de cada empresa: otra empresa no ve nada", async () => {
    await importInventory(db, owner, VERDE_VIVO_CSV);
    const other = await actAs(db, A, await createClient(db, A, { name: "Otro negocio" }));
    expect((await listInventory(db, other)).items).toEqual([]);
    expect((await executeInternal(db, { companyId: other.companyId, taskId: "x" }, "calcular_resurtido", {})).data).toMatchObject({ total_unidades: 0 });
  });
});

describe("herramientas internas: el sistema decide las cantidades, no el modelo", () => {
  beforeEach(async () => { await importInventory(db, owner, VERDE_VIVO_CSV); });
  it("el borrador se recalcula en el servidor aunque el modelo mande otras cifras", async () => {
    const r: any = await executeInternal(db, { companyId, taskId: "t" }, "guardar_borrador_resurtido", { unidades: 9999, items: [{ sku: "X", unidades: 1000 }] });
    expect(r.ok).toBe(true); expect(r.data).toMatchObject({ productos: 3, total_unidades: 66, estado: "borrador (no enviado)" });
    const d = (await db.query("SELECT items,total_units,status FROM restock_drafts"))[0]; expect(d.total_units).toBe(66); expect(d.status).toBe("borrador"); expect((d.items as any[]).map((i) => i.sku)).not.toContain("X");
  });
  it("sin faltantes no se crea borrador", async () => {
    await importInventory(db, owner, "sku,producto,stock,minimo,maximo\nA,x,10,2,20"); const r: any = await executeInternal(db, { companyId, taskId: "t" }, "guardar_borrador_resurtido", {});
    expect(r.data.mensaje).toMatch(/No hay productos bajo el mínimo/); expect((await db.query("SELECT 1 FROM restock_drafts")).length).toBe(0);
  });
  it("solo se aprueba un borrador propio y vigente; ajeno o repetido falla", async () => {
    const d: any = (await executeInternal(db, { companyId, taskId: "t" }, "guardar_borrador_resurtido", {})).data;
    const otherCompany = await createClient(db, A, { name: "Otro" });
    expect((await executeInternal(db, { companyId: otherCompany, taskId: "t" }, "solicitar_resurtido", { draft_id: d.draft_id })).ok).toBe(false);
    expect((await executeInternal(db, { companyId, taskId: "t" }, "solicitar_resurtido", { draft_id: "no-existe" })).ok).toBe(false);
    const ok: any = await executeInternal(db, { companyId, taskId: "t" }, "solicitar_resurtido", { draft_id: d.draft_id }); expect(ok.ok).toBe(true); expect(ok.data.mensaje).toMatch(/NO se envió ninguna compra/);
    expect((await executeInternal(db, { companyId, taskId: "t" }, "solicitar_resurtido", { draft_id: d.draft_id })).ok).toBe(false);
  });
});

describe("piloto completo: automatización → delegación → aprobación", () => {
  beforeEach(async () => { await importInventory(db, owner, VERDE_VIVO_CSV); });
  it("2-3 · el equipo de tres y la oficina 3D reflejan a los empleados reales", async () => {
    const s = await companyScene(db, owner);
    expect(s.stats.employees).toBe(3); expect(s.zones.map((z) => [z.key, z.desks.length])).toEqual([["direccion", 1], ["operaciones", 2]]); expect(s.brand.name).toBe(PILOT.agency); expect(s.title).toBe(PILOT.client);
  });
  it("5-6-7 · el programador ejecuta la cadena completa y deja la solicitud pendiente SIN comprar nada", async () => {
    const sim = await runAutomation();
    const tasks = await listTasks(db, owner); expect(tasks.length).toBe(3);
    const byRole = Object.fromEntries(tasks.map((t: any) => [t.employee_name, t])); const root = byRole[idn("controlador-inventario")], mid = byRole[idn("analista-proveedores")], last = byRole[idn("supervisor-general")];
    expect(root.depth).toBe(0); expect(mid.parent_task_id).toBe(root.id); expect(mid.depth).toBe(1); expect(last.parent_task_id).toBe(mid.id); expect(last.depth).toBe(2);
    expect([root.status, mid.status, last.status]).toEqual(["completed", "completed", "awaiting_approval"]);
    expect(sim.calls.map((c) => c.tool).filter(Boolean)).toEqual(["inventario__leer_inventario", "inventario__calcular_resurtido", "delegate_task", "inventario__calcular_resurtido", "inventario__guardar_borrador_resurtido", "delegate_task", "inventario__solicitar_resurtido"]);
    const drafts = await listDrafts(db, owner); expect(drafts.length).toBe(1); expect(drafts[0]).toMatchObject({ total_units: 66, status: "borrador" }); expect((drafts[0].items as any[]).length).toBe(3);
    const [ap] = await listApprovals(db, owner); expect(ap.summary).toMatch(/resurtir 3 productos \(66 unidades\)/); expect(ap.summary).toMatch(/no se envía ninguna compra/); expect(ap.args.draft_id).toBe(drafts[0].id); expect(ap.status).toBe("pending");
    expect(connector.executed.length).toBe(0);
    const ev = (await getTask(db, owner, root.id))!.events; expect(ev.filter((e: any) => e.kind === "tool_executed").length).toBe(2); expect(ev.some((e: any) => e.kind === "delegated")).toBe(true);
    expect((await db.query("SELECT status FROM automation_runs"))[0].status).toBe("completed");
  });
  it("la tarea delegada recibe el contexto del traspaso con los datos reales", async () => {
    await runAutomation(); const mid: any = (await listTasks(db, owner)).find((t: any) => t.employee_name === idn("analista-proveedores"));
    const ctx = (await getTask(db, owner, mid.id))!.task.context as string; expect(ctx).toMatch(/3 productos bajo el mínimo/); expect(ctx).toMatch(/66 unidades/); expect(ctx).toMatch(/Maceta de barro 20 cm \(4\/10\)/);
  });
  it("7 · aprobar: el borrador queda «aprobado, sin enviar», con evidencia, y la tarea termina", async () => {
    await runAutomation(); const [ap] = await listApprovals(db, owner);
    const r = await decideApproval(db, owner, ap.id, true, connector); expect(r.executed).toBe(true);
    expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("aprobado_sin_enviar");
    expect((await db.query("SELECT evidence FROM approvals"))[0].evidence.data.mensaje).toMatch(/NO se envió ninguna compra/);
    expect((await db.query("SELECT status FROM tasks WHERE parent_task_id IS NOT NULL ORDER BY depth DESC LIMIT 1"))[0].status).toBe("completed"); expect(connector.executed.length).toBe(0);
  });
  it("7 · rechazar: el borrador queda rechazado y no se registra ninguna orden", async () => {
    await runAutomation(); const [ap] = await listApprovals(db, owner); await decideApproval(db, owner, ap.id, false, connector);
    expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("rechazado"); expect((await db.query("SELECT 1 FROM restock_drafts WHERE status='aprobado_sin_enviar'")).length).toBe(0);
  });
  it("quien solo puede ver no aprueba; una solicitud caducada no se ejecuta", async () => {
    await runAutomation(); const [ap] = await listApprovals(db, owner);
    await expect(decideApproval(db, { ...owner, role: "viewer" }, ap.id, true, connector)).rejects.toThrow();
    await db.query("UPDATE approvals SET expires_at = now() - interval '1 minute'"); await expect(decideApproval(db, owner, ap.id, true, connector)).rejects.toThrow(/expiró/);
    expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("borrador");
  });
  it("sin productos bajo el mínimo: no hay delegación, ni borrador, ni solicitud", async () => {
    await importInventory(db, owner, "sku,producto,stock,minimo,maximo\nA,x,10,2,20"); const sim = await runAutomation();
    expect((await listTasks(db, owner)).length).toBe(1); expect((await db.query("SELECT 1 FROM restock_drafts")).length + (await listApprovals(db, owner)).length).toBe(0);
    expect(sim.calls.some((c) => c.tool === "delegate_task")).toBe(false);
  });
  it("el motor le dice al modelo quiénes son sus compañeros (con id) para poder delegar", async () => {
    const seen: string[] = []; const spy = { id: "espía", pricing: () => ({ inUsd: 1, outUsd: 1 }), complete: async (r: any) => { seen.push(r.system); return { text: "ok", toolCalls: [], inputTokens: 1, outputTokens: 1 }; } };
    await createPilotAutomation(db, owner, team["controlador-inventario"], new Date()); await runDueAutomations(db, { provider: spy as any, adapter: connector }, new Date(Date.now() + day + 1000));
    expect(seen[0]).toContain("## Tus compañeros"); expect(seen[0]).toContain(`(id: ${team["analista-proveedores"]})`); expect(seen[0]).not.toContain(`(id: ${team["controlador-inventario"]})`);
  });
  it("no se puede delegar a un empleado de otra empresa", async () => {
    const other = await actAs(db, A, await createClient(db, A, { name: "Otro" })); const foreign = await hireFromTemplate(db, other, "analista-proveedores");
    await expect(createTask(db, owner, { employeeId: foreign, title: "x", instruction: "y" })).rejects.toThrow(/no encontrado/);
  });
  it("sin presupuesto de IA la cadena no corre y no se inventa nada", async () => {
    await db.query("UPDATE companies SET monthly_budget_usd=0.0001 WHERE id=$1", [companyId]); const sim = await runAutomation();
    expect(sim.calls.length).toBe(0); expect((await db.query("SELECT 1 FROM restock_drafts")).length).toBe(0); expect((await listTasks(db, owner))[0].error).toMatch(/Presupuesto mensual/);
  });
  it("sin IA configurada la automatización falla de forma honesta (no simula)", async () => {
    const t0 = new Date(); await createPilotAutomation(db, owner, team["controlador-inventario"], t0); await runDueAutomations(db, { provider: null, adapter: connector, retryDelayMs: 0 }, new Date(t0.getTime() + day + 1000));
    expect((await listTasks(db, owner))[0]).toMatchObject({ status: "failed" }); expect((await listDrafts(db, owner)).length).toBe(0);
    expect((await db.query("SELECT 1 FROM audit_log WHERE action='automation.alert'")).length).toBe(1);
  });
});

describe("8 · aprobación por Telegram (canal SIMULADO)", () => {
  it("el aviso llega al dueño vinculado; la acción sensible exige APROBAR y luego CONFIRMAR; solo entonces se registra", async () => {
    await importInventory(db, owner, VERDE_VIVO_CSV); const tg = new FakeChannel("telegram"); const wa = new FakeChannel("whatsapp");
    const { code } = await createLinkCode(db, A.userId, "telegram", true);
    const msg = (t: string, id: string): InboundMessage => ({ channel: "telegram", externalMsgId: id, externalId: "9001", display: "Dueña", kind: "text", text: t, at: new Date() });
    expect(await handleInbound(db, msg(`/start ${code}`, "m1"), { connector })).toBe("linked");
    await runAutomation(); await scanNotifications(db);
    const deps = { provider: null, connector, adapters: { telegram: tg, whatsapp: wa }, retryDelayMs: 0 }; await processJobs(db, deps);
    const notice = tg.sent.find((s) => /Aprobación pendiente/.test(s.text))!; expect(notice.text).toMatch(/resurtir 3 productos \(66 unidades\)/); const k = notice.text.match(/APROBAR ([A-Z0-9]{6})/)![1];
    await handleInbound(db, msg("sí, apruébalo", "m2"), { connector }); await handleInbound(db, msg(`CONFIRMAR ${k}`, "m3"), { connector }); await processJobs(db, deps);
    expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("borrador"); // ni «sí» ni CONFIRMAR sin APROBAR ejecutan nada
    await handleInbound(db, msg(`APROBAR ${k}`, "m4"), { connector }); await processJobs(db, deps);
    expect(tg.sent.at(-1)!.text).toMatch(/Acción sensible/); expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("borrador");
    await handleInbound(db, msg(`CONFIRMAR ${k}`, "m5"), { connector }); await processJobs(db, deps);
    expect((await db.query("SELECT status FROM restock_drafts"))[0].status).toBe("aprobado_sin_enviar"); expect(tg.sent.at(-1)!.text).toMatch(/ejecutada/);
    expect((await getActiveIdentity(db, "telegram", "9001"))!.user_id).toBe(A.userId);
  });
});

describe("piloto privado: registro cerrado", () => {
  it("con SIGNUP_ALLOWED_EMAILS solo entran los correos autorizados", async () => {
    const { signupAgency } = await import("@/server/auth"); process.env.SIGNUP_ALLOWED_EMAILS = "duena@nova.test, otra@nova.test";
    try {
      await expect(signupAgency(db, { email: "intruso@x.com", name: "I", password: "clave-larga-123", agencyName: "X", specialty: "" })).rejects.toThrow(/registro está cerrado/);
      expect((await db.query("SELECT 1 FROM users WHERE email='intruso@x.com'")).length).toBe(0);
      await expect(signupAgency(db, { email: "DUENA@nova.test", name: "D", password: "clave-larga-123", agencyName: "Y", specialty: "" })).resolves.toBeTruthy();
    } finally { delete process.env.SIGNUP_ALLOWED_EMAILS; }
  });
});
