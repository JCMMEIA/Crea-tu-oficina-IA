import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { signupAgency, login, agencyActorFromToken, actAs, actorFromToken, AgencyActor } from "@/server/auth";
import { createClient, applyIndustryTemplate } from "@/server/agency";
import { deployServiceToClient } from "@/server/agency/deploy";
import { hireFromTemplate, setEmployeeStatus } from "@/server/catalog/office";
import { addClientUser } from "@/server/agency";
import { createAutomation } from "@/server/automations";
import { startConnection, testConnection } from "@/server/connectors";
import { buildScene, InZone, InDesk, DESK_W, DESK_D } from "@/server/office3d/layout";
import { companyScene, agencyScene, clientSceneForAgency } from "@/server/office3d";
import { newDb, FakeAdapter } from "./helpers";

const brand = { name: "Agencia", color: "#0a7d5a", logo: null, tagline: "" };
const emp = (i: number, status: InDesk["status"] = "active"): InDesk => ({ id: "e" + i + Math.random().toString(36).slice(2, 6), name: "Emp " + i, roleTitle: "Rol", status, skillName: "Skill", skillVersion: 1, missingConnections: [] });
const zone = (key: string, n: number): InZone => ({ id: "z-" + key, key, kind: "department", name: key, employees: Array.from({ length: n }, (_, i) => emp(i)), services: [] });
const scene = (zones: InZone[]) => buildScene({ kind: "company", title: "T", subtitle: "S", brand, zones });
const overlap = (a: { x: number; z: number; w: number; d: number }, b: typeof a) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;

describe("layout puro", () => {
  it("1) sin empleados ni departamentos: solo recepción, vista vacía útil", () => {
    const s = scene([]);
    expect(s.zones).toEqual([]); expect(s.stats).toEqual({ zones: 0, employees: 0, automations: 0 }); expect(s.reception.w).toBeGreaterThan(0);
  });
  it("departamento sin empleados: zona visible pero vacía (estado 'empty', sin estaciones)", () => {
    const s = scene([zone("marketing", 0)]);
    expect(s.zones[0].desks.length).toBe(0); expect(s.zones[0].status).toBe("empty");
  });
  it("2) un departamento: una zona con una estación por empleado", () => {
    const s = scene([zone("marketing", 3)]);
    expect(s.zones.length).toBe(1); expect(s.zones[0].desks.length).toBe(3); expect(s.stats.employees).toBe(3); expect(s.zones[0].status).toBe("ready");
  });
  it("3) múltiples departamentos: orden estable, colores por área, sin solapamientos", () => {
    const s = scene([zone("finanzas", 2), zone("ventas", 2), zone("marketing", 2), zone("direccion", 1), zone("atencion", 1), zone("operaciones", 2)]);
    expect(s.zones.map((z) => z.key)).toEqual(["direccion", "marketing", "ventas", "operaciones", "atencion", "finanzas"]);
    expect(new Set(s.zones.map((z) => z.color)).size).toBe(s.zones.length);
    const boxes = [{ ...s.reception }, ...s.zones.map((z) => ({ x: z.x, z: z.z, w: z.w, d: z.d }))];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
  });
  it("4) varios empleados en marketing y ventas: estaciones dentro de su módulo y sin chocar", () => {
    const s = scene([zone("marketing", 7), zone("ventas", 5)]);
    expect(s.zones.map((z) => z.desks.length)).toEqual([7, 5]);
    for (const z of s.zones) {
      for (const d of z.desks) { expect(Math.abs(d.x - z.x)).toBeLessThanOrEqual(z.w / 2 - DESK_W / 2 + 1e-6); expect(Math.abs(d.z - z.z)).toBeLessThanOrEqual(z.d / 2 - DESK_D / 2 + 1e-6); }
      const ds = z.desks.map((d) => ({ x: d.x, z: d.z, w: DESK_W - 0.1, d: DESK_D - 0.1 }));
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) expect(overlap(ds[i], ds[j])).toBe(false);
    }
  });
  it("nunca inventa ni pierde empleados (varios tamaños)", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 9, 13, 25]) { const s = scene([zone("marketing", n), zone("ventas", n)]); expect(s.stats.employees).toBe(2 * n); expect(new Set(s.zones.flatMap((z) => z.desks.map((d) => d.id))).size).toBe(2 * n); }
  });
  it("estado de zona: pausados y conexiones faltantes ⇒ requiere configuración con motivos", () => {
    const z = zone("marketing", 2); z.employees[0].status = "paused"; z.employees[1].missingConnections = ["Meta Ads"];
    const s = scene([z]).zones[0];
    expect(s.status).toBe("needs_setup"); expect(s.notes.join(" ")).toMatch(/pausa/); expect(s.notes.join(" ")).toMatch(/Meta Ads/);
  });
  it("determinista: misma entrada, misma escena", () => {
    const zs = [zone("marketing", 4), zone("ventas", 3)];
    expect(scene(zs)).toEqual(scene(zs));
  });
  it("departamentos personalizados reciben color y van después de los estándar", () => {
    const c: InZone = { ...zone("custom-ab12", 1), name: "Taller", custom: true };
    const s = scene([c, zone("ventas", 1)]);
    expect(s.zones.map((z) => z.label)).toEqual(["ventas", "Taller"]);
  });
});

describe("escena desde datos reales + aislamiento", () => {
  let db: Db, A: AgencyActor, B: AgencyActor;
  const mkAgency = async (email: string, name: string) => { await signupAgency(db, { email, name: "D", password: "clave-larga-123", agencyName: name, specialty: "Esp" }); return (await agencyActorFromToken(db, await login(db, email, "clave-larga-123")))!; };
  beforeEach(async () => { db = await newDb(); A = await mkAgency("a@x.com", "Agencia A"); B = await mkAgency("b@x.com", "Agencia B"); });

  it("cliente sin empleados ⇒ escena vacía; con empleados ⇒ coincide EXACTO con la base", async () => {
    const c = await createClient(db, A, { name: "Cliente" }); const act = await actAs(db, A, c);
    expect((await companyScene(db, act)).stats).toEqual({ zones: 0, employees: 0, automations: 0 });
    for (const k of ["analista-meta-ads", "optimizador-campanas", "vendedor-conversacional", "agente-soporte"]) await hireFromTemplate(db, act, k);
    const s = await companyScene(db, act);
    const rows = await db.query("SELECT count(*)::int n FROM employees WHERE company_id=$1", [c]);
    expect(s.stats.employees).toBe(rows[0].n); expect(s.zones.map((z) => [z.key, z.desks.length])).toEqual([["marketing", 2], ["ventas", 1], ["atencion", 1]]);
    expect(s.brand.name).toBe("Agencia A");
  });
  it("estado pausado, skill personalizada y conexiones requeridas se reflejan; automatizaciones solo si existen", async () => {
    const c = await createClient(db, A, { name: "Cliente" }); const act = await actAs(db, A, c);
    const e = await hireFromTemplate(db, act, "analista-meta-ads");
    let s = await companyScene(db, act);
    expect(s.zones[0].status).toBe("needs_setup"); expect(s.zones[0].notes.join(" ")).toMatch(/Meta Ads/);
    expect(s.zones.find((z) => z.kind === "automation")).toBeUndefined();
    const ad = new FakeAdapter(); await startConnection(db, act, "meta_ads", ad); await testConnection(db, act, "meta_ads", ad);
    await setEmployeeStatus(db, act, e, "paused");
    s = await companyScene(db, act);
    expect(s.zones[0].desks[0].status).toBe("paused"); expect(s.zones[0].notes.join(" ")).not.toMatch(/Falta conectar/);
    await createAutomation(db, act, { name: "Reporte", trigger: { type: "interval", everyMinutes: 60 }, employeeId: e, instruction: "x" });
    s = await companyScene(db, act);
    expect(s.zones.find((z) => z.kind === "automation")!.desks.length).toBe(1);
    expect(s.stats.automations).toBe(1); expect(s.stats.employees).toBe(1); // la automatización no se cuenta como empleado
  });
  it("servicios vinculados a la zona", async () => {
    const c = await createClient(db, A, { name: "C" }); const [svc] = await applyIndustryTemplate(db, A, "ecommerce");
    await deployServiceToClient(db, A, svc, c);
    const s = await companyScene(db, await actAs(db, A, c));
    expect(s.zones.find((z) => z.key === "marketing")!.services.length).toBeGreaterThan(0);
  });
  it("escena de agencia: solo sus clientes; la otra agencia no aparece", async () => {
    const cA = await createClient(db, A, { name: "Cliente de A" }), cB = await createClient(db, B, { name: "Cliente de B" });
    await hireFromTemplate(db, await actAs(db, A, cA), "agente-soporte"); await hireFromTemplate(db, await actAs(db, B, cB), "agente-soporte");
    const s = await agencyScene(db, A);
    expect(s.zones.map((z) => z.label)).toEqual(["Cliente de A"]); expect(s.stats.employees).toBe(1);
    expect(JSON.stringify(s)).not.toContain("Cliente de B");
  });
  it("escena de un cliente ajeno ⇒ 'no encontrada'; usuario cliente solo ve su empresa", async () => {
    const cA = await createClient(db, A, { name: "CA" }), cA2 = await createClient(db, A, { name: "CA2" }); const cB = await createClient(db, B, { name: "CB" });
    await hireFromTemplate(db, await actAs(db, B, cB), "agente-soporte");
    await expect(clientSceneForAgency(db, A, cB)).rejects.toThrow(/no encontrada/);
    await addClientUser(db, A, cA, { email: "cli@a.com", name: "C", password: "clave-larga-123", role: "viewer" });
    const me = (await actorFromToken(db, await login(db, "cli@a.com", "clave-larga-123")))!;
    const s = await companyScene(db, me);
    expect(s.title).toBe("CA"); expect(JSON.stringify(s)).not.toContain("CB");
    void cA2;
  });
});
