import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { Actor } from "@/server/auth";
import { EMPLOYEES } from "@/server/catalog/data";
import { hireFromTemplate } from "@/server/catalog/office";
import { IDENTITIES, allProfiles, displayName, identityFor, portraitPrompt, profileFor } from "@/features/employees/catalog";
import { readiness } from "@/features/employees/readiness";
import { cleanName, MAX_PHOTO_BYTES, photoToDataUrl } from "@/features/employees/photo";
import { personalizeEmployee } from "@/features/employees/service";
import { newDb, newCompany } from "./helpers";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
describe("catálogo central de identidades", () => {
  it("cada plantilla real tiene identidad y ninguna sobra", () => {
    expect(IDENTITIES.map((i) => i.key).sort()).toEqual(EMPLOYEES.map((e) => e.key).sort());
  });
  it("nombres propios únicos y fichas completas", () => {
    expect(new Set(IDENTITIES.map((i) => i.nombre)).size).toBe(IDENTITIES.length);
    for (const p of allProfiles()) { expect(p.nombre && p.puesto && p.especialidad && p.linea && p.departamento.nombre).toBeTruthy(); expect(p.responsabilidades.length).toBeGreaterThan(0); expect(portraitPrompt(p.key)).toMatch(/fictional/); }
  });
  it("Valentina Torres es la especialista en ventas conversacionales", () => {
    const p = profileFor("vendedor-conversacional")!; expect(p.nombre).toBe("Valentina Torres"); expect(p.departamento.key).toBe("ventas");
  });
  it("displayName usa la identidad si el empleado conserva el nombre del puesto, y respeta el nombre del cliente", () => {
    expect(displayName({ name: "Vendedor conversacional", role_title: "Vendedor conversacional", template_key: "vendedor-conversacional" })).toBe("Valentina Torres");
    expect(displayName({ name: "Vale", role_title: "x", template_key: "vendedor-conversacional" })).toBe("Vale");
  });
});
describe("estados: configurado ≠ conectado ≠ operativo", () => {
  const key = "analista-meta-ads"; // requiere conexiones obligatorias
  it("sin conexiones ni IA verificada NO es operativo", () => {
    const r = readiness({ templateKey: key, status: "active", connected: new Set(), aiOk: null });
    expect(r.configurado.level).toBe("si"); expect(r.conectado.level).not.toBe("si"); expect(r.operativo.level).toBe("no");
  });
  it("conectado pero sin IA verificada sigue sin ser operativo", () => {
    const need = EMPLOYEES.find((e) => e.key === key)!.connections.filter((c) => c.required).map((c) => c.toolkit);
    const r = readiness({ templateKey: key, status: "active", connected: new Set(need), aiOk: false });
    expect(r.conectado.level).toBe("si"); expect(r.operativo.level).toBe("no");
  });
  it("solo configurado + conectado + IA verificada es operativo; en pausa no", () => {
    const need = EMPLOYEES.find((e) => e.key === key)!.connections.filter((c) => c.required).map((c) => c.toolkit);
    expect(readiness({ templateKey: key, status: "active", connected: new Set(need), aiOk: true }).operativo.level).toBe("si");
    expect(readiness({ templateKey: key, status: "paused", connected: new Set(need), aiOk: true }).operativo.level).toBe("no");
  });
});
describe("foto y nombre", () => {
  it("acepta PNG real y rechaza otros contenidos aunque el tipo declarado sea imagen", () => {
    expect(photoToDataUrl(PNG, "image/png")).toMatch(/^data:image\/png;base64,/);
    expect(() => photoToDataUrl(new TextEncoder().encode("<svg onload=alert(1)>"), "image/png")).toThrow(/PNG, JPG o WebP/);
    expect(() => photoToDataUrl(PNG, "image/svg+xml")).toThrow();
    expect(() => photoToDataUrl(new Uint8Array(MAX_PHOTO_BYTES + 1).fill(0x89), "image/png")).toThrow(/pesa demasiado/);
  });
  it("limpia el nombre", () => { expect(cleanName("  Vale   <b>T</b> ")).toBe("Vale bT/b"); expect(() => cleanName("a")).toThrow(); });
});
describe("personalización aislada por oficina", () => {
  let db: Db; let a: Actor; let b: Actor;
  beforeEach(async () => { db = await newDb(); a = await newCompany(db, "a@x.com", "A"); b = await newCompany(db, "b@x.com", "B"); });
  it("contrata con el nombre de la identidad y permite renombrar y poner foto", async () => {
    const id = await hireFromTemplate(db, a, "vendedor-conversacional");
    expect((await db.query("SELECT name FROM employees WHERE id=$1", [id]))[0].name).toBe("Valentina Torres");
    await personalizeEmployee(db, a, id, { name: "Vale", photo: photoToDataUrl(PNG, "image/png") });
    const r = (await db.query("SELECT name, photo FROM employees WHERE id=$1", [id]))[0]; expect(r.name).toBe("Vale"); expect(r.photo).toMatch(/^data:image\/png/);
    await personalizeEmployee(db, a, id, { removePhoto: true }); expect((await db.query("SELECT photo FROM employees WHERE id=$1", [id]))[0].photo).toBeNull();
  });
  it("otra oficina no puede cambiar a un empleado ajeno ni guardar fotos no válidas", async () => {
    const id = await hireFromTemplate(db, a, "vendedor-conversacional");
    await expect(personalizeEmployee(db, b, id, { name: "Hackeado" })).rejects.toThrow(/no encontrado/);
    await expect(personalizeEmployee(db, a, id, { photo: "data:text/html;base64,AAAA" })).rejects.toThrow(/no es válida/);
    expect((await db.query("SELECT name FROM employees WHERE id=$1", [id]))[0].name).toBe("Valentina Torres");
  });
});
