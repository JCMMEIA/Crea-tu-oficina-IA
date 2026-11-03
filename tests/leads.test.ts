import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { addLead, pickUtm } from "@/server/leads";
import { newDb } from "./helpers";

let db: Db; beforeEach(async () => { db = await newDb(); });
describe("acceso anticipado", () => {
  it("guarda con consentimiento y UTM; mismo correo = actualiza, no duplica", async () => {
    await addLead(db, { email: "A@X.com", name: "A", consent: true, utm: pickUtm({ utm_source: "meta", fbclid: "abc", otro: "x" }) });
    await addLead(db, { email: "a@x.com", name: "A2", stage: "idea", consent: true });
    const r = await db.query("SELECT email,name,stage,utm FROM leads");
    expect(r.length).toBe(1); expect(r[0].email).toBe("a@x.com"); expect(r[0].name).toBe("A2");
    expect(pickUtm({ utm_source: "meta", fbclid: "abc", otro: "x" })).toEqual({ utm_source: "meta", fbclid: "abc" });
  });
  it("rechaza sin consentimiento o con correo inválido; honeypot se ignora sin guardar", async () => {
    await expect(addLead(db, { email: "a@x.com", consent: false })).rejects.toThrow();
    await expect(addLead(db, { email: "no-es-correo", consent: true })).rejects.toThrow();
    expect(await addLead(db, { email: "bot@x.com", consent: true }, "http://spam")).toBe("ignored");
    expect((await db.query("SELECT 1 FROM leads")).length).toBe(0);
  });
  it("tope por hora contra abuso", async () => {
    for (let i = 0; i < 200; i++) await db.query("INSERT INTO leads(id,email,consent) VALUES($1,$2,true)", ["l" + i, `u${i}@x.com`]);
    await expect(addLead(db, { email: "nuevo@x.com", consent: true })).rejects.toThrow(/demasiadas/i);
  });
});
