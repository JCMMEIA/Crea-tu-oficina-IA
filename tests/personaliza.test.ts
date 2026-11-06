import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { Db } from "@/server/db";
import { signupAgency, login, agencyActorFromToken, actAs, AgencyActor, AuthorizationError } from "@/server/auth";
import { createClient, updateBrand, getAgency } from "@/server/agency";
import { hireFromTemplate } from "@/server/catalog/office";
import { companyScene, agencyScene } from "@/server/office3d";
import { buildScene } from "@/server/office3d/layout";
import { getOfficeDesign, saveOfficeDesign, previewScene } from "@/server/office3d/design_store";
import { DEFAULT_DESIGN, SPACE_KEYS, STYLE_KEYS, OfficeDesign, placeDecor, resolveTheme, sanitizeDesign, suggestFromDescription, isCustomized } from "@/server/office3d/design";
import { newDb } from "./helpers";

let db: Db;
const mk = async (email: string, name: string): Promise<AgencyActor> => {
  await signupAgency(db, { email, name: "Dueño", password: "clave-larga-123", agencyName: name, specialty: "Marketing" });
  return (await agencyActorFromToken(db, await login(db, email, "clave-larga-123")))!;
};
const D = (p: Partial<OfficeDesign>): OfficeDesign => ({ ...DEFAULT_DESIGN, ...p });
beforeEach(async () => { db = await newDb(); });

describe("modelo: estilo × espacio", () => {
  it("sin nada elegido el tema es el de siempre (sin look): oficinas existentes no cambian", () => {
    expect(isCustomized(DEFAULT_DESIGN)).toBe(false);
    for (const k of ["moderno", "calido", "fresco", undefined]) expect(resolveTheme(DEFAULT_DESIGN, k).look).toBeUndefined();
    expect(resolveTheme(DEFAULT_DESIGN, "calido").floor).toBe("#f0e3cf");
  });
  it("las 7×6 combinaciones se resuelven, son distintas y estilo/espacio son independientes", () => {
    const seen = new Set<string>();
    for (const style of STYLE_KEYS) for (const space of SPACE_KEYS) {
      const t = resolveTheme(D({ style, space, description: "una isla con magia" }), "moderno");
      if (style === "clasico" && space === "clasica") { expect(t.look).toBeUndefined(); continue; }
      expect(t.look!.style).toBe(style); expect(t.look!.space).toBe(space); expect(t.look!.decor.length).toBeGreaterThan(0);
      expect(t.floor).toMatch(/^#[0-9a-f]{6}$/i); seen.add(JSON.stringify([t.floor, t.look!.backdrop, t.look!.decor, t.look!.pattern]));
    }
    expect(seen.size).toBeGreaterThan(20);
    const a = resolveTheme(D({ style: "bloques", space: "mansion" })), b = resolveTheme(D({ style: "submarino", space: "penthouse" }));
    expect(a.look!.backdrop).toBe("garden"); expect(a.floor).not.toBe(b.floor); expect(b.look!.backdrop).toBe("night");
  });
  it("solo espacio (estilo limpio) conserva el tono heredado; con estilo lo sustituye", () => {
    expect(resolveTheme(D({ space: "playa" }), "calido").floor).toBe("#f0e3cf");
    expect(resolveTheme(D({ style: "heroes" }), "calido").floor).not.toBe("#f0e3cf");
  });
  it("«reducir movimiento» y «animaciones» apagan el movimiento; las luces son independientes", () => {
    const t = (fx: any) => resolveTheme(D({ style: "heroes", fx: { ...DEFAULT_DESIGN.fx, ...fx } })).look!.fx;
    expect(t({}).motion).toBe(true); expect(t({ reduceMotion: true }).motion).toBe(false); expect(t({ animations: false }).motion).toBe(false);
    expect(t({ animations: false }).lights).toBe(true); expect(t({ lights: false }).lights).toBe(false);
    expect(resolveTheme(D({ style: "heroes", fx: { ...DEFAULT_DESIGN.fx, premium: false } })).look!.decor.length).toBeLessThanOrEqual(4);
  });
  it("la decoración es determinista y queda fuera de las zonas", () => {
    const look = resolveTheme(D({ style: "cuentos", space: "mansion" })).look!;
    const b = { w: 14, d: 9 }; const a1 = placeDecor(look, b), a2 = placeDecor(look, b);
    expect(a1).toEqual(a2); expect(a1.length).toBeGreaterThan(0);
    for (const it of a1) expect(Math.abs(it.x) > b.w / 2 - 0.01 || Math.abs(it.z) > b.d / 2 - 0.01).toBe(true);
  });
  it("sanitizeDesign acepta basura sin lanzar y recorta la descripción", () => {
    expect(sanitizeDesign(null)).toEqual(DEFAULT_DESIGN); expect(sanitizeDesign("x")).toEqual(DEFAULT_DESIGN);
    const s = sanitizeDesign({ style: "<script>", space: 9, fx: { lights: "sí" }, description: "<b>hola</b>" + "a".repeat(500) });
    expect(s.style).toBe("clasico"); expect(s.space).toBe("clasica"); expect(s.fx.lights).toBe(true); expect(s.description.length).toBeLessThanOrEqual(300); expect(s.description).not.toMatch(/[<>]/);
  });
});

describe("diseño personalizado: reglas locales", () => {
  it("palabras clave → estilo/espacio/color/ajustes", () => {
    const s = suggestFromDescription("Quiero una oficina en una isla tropical con mucha magia, color rosa y sin animaciones");
    expect(s.understood).toBe(true); expect(s.style).toBe("cuentos"); expect(s.space).toBe("playa"); expect(s.accent).toBe("#ec4899"); expect(s.fx.animations).toBe(false);
    expect(suggestFromDescription("laboratorio de química").style).toBe("desierto");
    expect(suggestFromDescription("un penthouse de lujo con bloques de construcción")).toMatchObject({ style: "bloques", space: "penthouse" });
    expect(suggestFromDescription("fondo del mar con corales").style).toBe("submarino");
  });
  it("texto sin sentido: lo dice con honestidad y no inventa nada; es determinista", () => {
    const s = suggestFromDescription("asdf qwer"); expect(s.understood).toBe(false); expect(s.style).toBeNull(); expect(s.summary).toMatch(/No reconocí/);
    expect(suggestFromDescription("magia y castillo")).toEqual(suggestFromDescription("magia y castillo"));
  });
  it("«personalizado» se dibuja con el estilo que sale de la descripción", () => {
    expect(resolveTheme(D({ style: "personalizado", description: "mar y corales" })).look!.decor).toContain("coral");
    expect(resolveTheme(D({ style: "personalizado", description: "mar y corales", space: "playa" })).look!.style).toBe("personalizado");
  });
});

describe("guardado, recuperación y modificación posterior", () => {
  it("columna idempotente: aplicar el esquema otra vez no falla ni borra nada", async () => {
    const A = await mk("a@t.test", "A"); await saveOfficeDesign(db, A, D({ style: "bloques", space: "mansion" }));
    const stmt = fs.readFileSync("src/server/db/schema.sql", "utf8").match(/ALTER TABLE agencies ADD COLUMN IF NOT EXISTS office_design[^;]*;/)![0];
    expect(stmt).toContain("IF NOT EXISTS"); await db.query(stmt); await db.query(stmt);
    // el esquema completo también se vuelve a aplicar sin errores (así arranca producción cada vez)
    const { createPgliteDb } = await import("@/server/db"); const again = await createPgliteDb(); await again.close();
    expect((await getOfficeDesign(db, A)).style).toBe("bloques");
  });
  it("oficina antigua ('{}'): devuelve el valor por defecto y la escena queda como antes", async () => {
    const A = await mk("a@t.test", "A"); expect(await getOfficeDesign(db, A)).toEqual(DEFAULT_DESIGN);
    expect((await agencyScene(db, A)).theme.look).toBeUndefined();
  });
  it("guarda, se recupera tras un nuevo inicio de sesión y se puede modificar después", async () => {
    const A = await mk("a@t.test", "A");
    await saveOfficeDesign(db, A, D({ style: "submarino", space: "penthouse", description: "hola" }));
    const A2 = (await agencyActorFromToken(db, await login(db, "a@t.test", "clave-larga-123")))!; // «volver a iniciar sesión»
    expect(await getOfficeDesign(db, A2)).toMatchObject({ style: "submarino", space: "penthouse", description: "hola" });
    await saveOfficeDesign(db, A2, D({ style: "heroes", space: "playa", fx: { ...DEFAULT_DESIGN.fx, lights: false } }));
    expect(await getOfficeDesign(db, A)).toMatchObject({ style: "heroes", space: "playa", fx: expect.objectContaining({ lights: false }) });
  });
  it("«Mi marca» (updateBrand) no borra el diseño y el diseño no borra la marca", async () => {
    const A = await mk("a@t.test", "A"); await saveOfficeDesign(db, A, D({ style: "cuentos" }));
    await updateBrand(db, A, { name: "Nueva", primaryColor: "#0a7d5a", style: "calido" });
    expect((await getOfficeDesign(db, A)).style).toBe("cuentos");
    await saveOfficeDesign(db, A, D({ style: "desierto" }));
    const ag = await getAgency(db, A); expect(ag.brand.primaryColor).toBe("#0a7d5a"); expect(ag.brand.style).toBe("calido"); expect(ag.name).toBe("Nueva");
  });
  it("entradas inválidas se normalizan (no rompen ni guardan basura)", async () => {
    const A = await mk("a@t.test", "A"); await saveOfficeDesign(db, A, { style: "hack", space: {}, fx: 5 });
    expect(await getOfficeDesign(db, A)).toEqual(DEFAULT_DESIGN);
  });
});

describe("aislamiento y permisos", () => {
  it("cada oficina tiene su diseño; guardar en una no cambia la otra", async () => {
    const A = await mk("a@t.test", "A"), B = await mk("b@t.test", "B");
    await saveOfficeDesign(db, A, D({ style: "bloques", space: "mansion" })); await saveOfficeDesign(db, B, D({ style: "submarino", space: "playa" }));
    await saveOfficeDesign(db, A, D({ style: "heroes" }));
    expect((await getOfficeDesign(db, B)).style).toBe("submarino"); expect((await getOfficeDesign(db, A)).space).toBe("clasica");
    expect((await agencyScene(db, B)).theme.look!.style).toBe("submarino");
  });
  it("el identificador de la agencia sale de la sesión: no se puede escribir en otra aunque venga en la entrada", async () => {
    const A = await mk("a@t.test", "A"), B = await mk("b@t.test", "B");
    await saveOfficeDesign(db, A, { style: "bloques", agencyId: B.agencyId, agency_id: B.agencyId });
    expect(await getOfficeDesign(db, B)).toEqual(DEFAULT_DESIGN);
    expect(JSON.stringify((await db.query("SELECT office_design FROM agencies WHERE id=$1", [A.agencyId]))[0].office_design)).not.toContain(B.agencyId);
  });
  it("sin permiso de marca (miembro) no se puede guardar; sin sesión tampoco", async () => {
    const A = await mk("a@t.test", "A"); const member = { ...A, agencyRole: "agency_member" } as AgencyActor;
    await expect(saveOfficeDesign(db, member, D({ style: "bloques" }))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(saveOfficeDesign(db, null as any, D({}))).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getOfficeDesign(db, A)).toEqual(DEFAULT_DESIGN);
  });
  it("la oficina de un cliente refleja el diseño de SU agencia y nunca el de otra", async () => {
    const A = await mk("a@t.test", "A"), B = await mk("b@t.test", "B");
    await db.query("UPDATE agencies SET plan='avanzado' WHERE id IN ($1,$2)", [A.agencyId, B.agencyId]);
    const ca = await createClient(db, A, { name: "CA" }), cb = await createClient(db, B, { name: "CB" });
    await saveOfficeDesign(db, A, D({ style: "cuentos", space: "mansion" }));
    expect((await companyScene(db, await actAs(db, A, ca))).theme.look!.style).toBe("cuentos");
    expect((await companyScene(db, await actAs(db, B, cb))).theme.look).toBeUndefined();
    await expect(actAs(db, A, cb)).rejects.toThrow();
  });
});

describe("no regresión: cambiar el diseño no toca datos reales", () => {
  it("empleados, departamentos, zonas, estaciones, plan y presupuesto idénticos antes y después", async () => {
    const A = await mk("a@t.test", "A"); await db.query("UPDATE agencies SET plan='avanzado' WHERE id=$1", [A.agencyId]);
    const c = await createClient(db, A, { name: "C" }); const act = await actAs(db, A, c);
    for (const k of ["analista-meta-ads", "creador-anuncios", "agente-soporte", "analista-gastos"]) await hireFromTemplate(db, act, k);
    const snap = async () => JSON.stringify([
      await db.query("SELECT * FROM employees ORDER BY id"), await db.query("SELECT id,key,name FROM departments ORDER BY id"),
      await db.query("SELECT id,plan,billing_status,monthly_budget_usd,stripe_subscription_id,brand,name FROM agencies ORDER BY id"),
      await db.query("SELECT id,monthly_budget_usd FROM companies ORDER BY id"), await db.query("SELECT count(*) FROM tasks"), await db.query("SELECT count(*) FROM subscriptions")]);
    const shape = (s: any) => ({ stats: s.stats, zones: s.zones.map((z: any) => [z.id, z.x, z.z, z.w, z.d, z.desks.map((d: any) => [d.id, d.x, d.z])]), bounds: s.bounds });
    const before = await snap(), sBefore = shape(await companyScene(db, act));
    for (const d of [D({ style: "bloques", space: "mansion" }), D({ style: "submarino", space: "grande" }), D({ style: "personalizado", description: "playa" }), DEFAULT_DESIGN]) await saveOfficeDesign(db, A, d);
    expect(await snap()).toBe(before); // (la columna office_design no entra en esta foto)
    await saveOfficeDesign(db, A, D({ style: "heroes", space: "penthouse" }));
    expect(shape(await companyScene(db, act))).toEqual(sBefore); // mismas estaciones y posiciones: el diseño es solo presentación
    expect((await companyScene(db, act)).stats.employees).toBe(4);
  });
  it("la vista previa usa la oficina con más empleados de ESTA agencia (nunca de otra)", async () => {
    const A = await mk("a@t.test", "A"), B = await mk("b@t.test", "B"); await db.query("UPDATE agencies SET plan='avanzado'");
    const cb = await createClient(db, B, { name: "Secreto" }); await hireFromTemplate(db, await actAs(db, B, cb), "agente-soporte");
    const ca = await createClient(db, A, { name: "Mio" }); await hireFromTemplate(db, await actAs(db, A, ca), "analista-gastos");
    const p = await previewScene(db, A); expect(p.title).toBe("Mio"); expect(JSON.stringify(p)).not.toContain("Secreto");
  });
  it("layout puro: el tema inyectado no altera la geometría", () => {
    const brand = { name: "x", color: "#0a7d5a", logo: null, tagline: "" };
    const z = [{ id: "z", key: "marketing", kind: "department" as const, name: "m", employees: [], services: [] }];
    const a = buildScene({ kind: "company", title: "t", subtitle: "s", brand, zones: z }), b = buildScene({ kind: "company", title: "t", subtitle: "s", brand, zones: z, theme: resolveTheme(D({ style: "bloques", space: "playa" })) });
    expect(b.zones).toEqual(a.zones); expect(b.bounds).toEqual(a.bounds); expect(b.reception).toEqual(a.reception);
  });
});
