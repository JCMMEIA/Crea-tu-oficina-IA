import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { newDb } from "./helpers";
import { explainError, getSettings, listModels, listPlanLimits, modelInputFromForm, parseNumber, saveModel, setModelEnabled, slugId, updatePlanLimit, updateSettings, usableModels } from "@/server/ai/config";

/**
 * INCIDENTE: en /admin/ia «el modelo no se guardó» (catálogo vacío tras recargar). Causa raíz reproducida: el formulario rechazaba entradas normales
 * (id con «/», precios «0,10» o «$0.10», miles «1,000,000», mayúsculas) con mensajes en inglés o errores SQL, que solo se veían en un aviso temporal de la URL;
 * el éxito era silencioso; y repetir un modelo con otro id interno chocaba con la restricción única (proveedor, modelo). Estas pruebas fijan la corrección.
 */
process.env.PLATFORM_ADMIN_EMAILS = "op@ejemplo.test"; const OP = { userId: "op", email: "op@ejemplo.test" };
let db: Db; beforeEach(async () => { db = await newDb(); await db.query("INSERT INTO users(id,email,name,password_hash) VALUES('op','op@ejemplo.test','Op','x') ON CONFLICT DO NOTHING"); });
const base = { id: "haiku-55", provider: "openrouter", model_id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", tier: "economy", max_level: "B", price_in_usd_mtok: "0.10", price_out_usd_mtok: "0.50", context_window: "1000000", supports_tools: true, supports_json: true, data_policy: "zero_retention", credit_weight: "1", enabled: true, verified: true, notes: "", allowed_providers: "amazon-bedrock, google-vertex" };
const msg = async (o: any) => { try { await saveModel(db, OP, { ...base, ...o }); return "OK"; } catch (e: any) { return explainError(e); } };

describe("entradas que antes fallaban ahora se guardan (y las inválidas explican qué corregir)", () => {
  it.each([
    ["id con barra (el id del proveedor pegado en «identificador»)", { id: "anthropic/claude-haiku-5.5" }, "anthropic-claude-haiku-5.5"],
    ["id con mayúsculas y espacios", { id: "Mi Haiku 5.5" }, "mi-haiku-5.5"], ["id vacío: se genera solo", { id: "" }, "openrouter-anthropic-claude-haiku-5.5"],
    ["precio con coma decimal", { price_in_usd_mtok: "0,10", price_out_usd_mtok: "0,50" }, "haiku-55"], ["precio con $ y US$", { price_in_usd_mtok: "$0.10", price_out_usd_mtok: "US$ 0.50" }, "haiku-55"],
    ["contexto con comas o espacios", { context_window: "1,000,000" }, "haiku-55"], ["contexto con espacios", { context_window: "1 000 000" }, "haiku-55"],
  ])("%s", async (_n, over, id) => { const r = await saveModel(db, OP, { ...base, ...over }); expect(r.id).toBe(id); expect(r.action).toBe("creado"); const m = (await listModels(db)).find((x) => x.id === id)!; expect(m.price_in_usd_mtok).toBe(0.1); expect(m.price_out_usd_mtok).toBe(0.5); expect(m.context_window).toBe(1000000); expect(m.allowed_providers).toEqual(["amazon-bedrock", "google-vertex"]); });
  it("parseNumber: formatos humanos y basura", () => { expect(parseNumber("0,10")).toBe(0.1); expect(parseNumber("1,234.50")).toBe(1234.5); expect(parseNumber("1.234,50")).toBe(1234.5); expect(parseNumber("abc")).toBeNaN(); expect(parseNumber("")).toBeNaN(); expect(parseNumber(" 3 ")).toBe(3); expect(slugId("Ñandú/Ñ 5.5")).toBe("nandu-n-5.5"); });
  it("los errores salen en español, nombran el campo y se muestran TODOS (no solo el primero)", async () => {
    expect(await msg({ price_in_usd_mtok: "abc" })).toMatch(/«US\$ por millón de entrada» debe ser un número/); expect(await msg({ context_window: "mucho" })).toMatch(/«Ventana de contexto» debe ser un número/);
    expect(await msg({ verified: false })).toMatch(/marca «VERIFICADOS» o deja «Activo» sin marcar/); expect(await msg({ tier: "free" })).toMatch(/gratuito debe tener precio 0/);
    const todo = await msg({ label: "x", price_in_usd_mtok: "abc", model_id: "" }); expect(todo).toMatch(/nombre es muy corto/); expect(todo).toMatch(/precio|número|entrada/i); expect(todo).toMatch(/id del modelo/); expect(todo).not.toMatch(/Invalid|expected|received/i);
    expect(await msg({ allowed_providers: "Amazon Bedrock!" })).toMatch(/proveedor aprobado solo puede tener/); expect(await msg({ provider: "anthropic", allowed_providers: "x" })).toMatch(/solo aplican a OpenRouter/);
    expect(await msg({ provider: "otro" })).toMatch(/openrouter|anthropic/); expect((await listModels(db)).length).toBe(0); // los errores no dejan nada a medias
  });
  it("un error SQL de duplicado se traduce a una frase útil", () => { expect(explainError(new Error('duplicate key value violates unique constraint "ai_models_provider_model_id_key"'))).toMatch(/ya está registrado/); });
});
describe("idempotencia: guardar dos veces no duplica ni falla", () => {
  it("repetir exactamente el mismo envío → una sola fila y «sin_cambios» (sin auditoría extra)", async () => {
    const a = await saveModel(db, OP, base); const b = await saveModel(db, OP, base); expect([a.action, b.action]).toEqual(["creado", "sin_cambios"]); expect((await listModels(db)).length).toBe(1);
    expect((await db.query("SELECT count(*)::int n FROM audit_log WHERE action='ai.model.upsert'"))[0].n).toBe(1);
  });
  it("mismo proveedor+modelo con OTRO identificador interno → actualiza el existente (no duplica y no revienta la restricción única)", async () => {
    await saveModel(db, OP, base); const r = await saveModel(db, OP, { ...base, id: "haiku-otro", label: "Haiku renombrado" }); expect(r.matchedBy).toBe("proveedor+modelo"); expect(r.id).toBe("haiku-55"); expect(r.action).toBe("actualizado");
    const all = await listModels(db); expect(all).toHaveLength(1); expect(all[0].label).toBe("Haiku renombrado");
  });
  it("editar un modelo existente hacia el proveedor+modelo de OTRO se rechaza con un mensaje claro y no cambia nada", async () => {
    await saveModel(db, OP, base); await saveModel(db, OP, { ...base, id: "otro", model_id: "vendor/otro", label: "Otro" });
    await expect(saveModel(db, OP, { ...base, id: "otro", model_id: base.model_id, label: "Otro" })).rejects.toThrow(/Ya existe otro modelo registrado con ese proveedor y esa id de modelo/); expect((await listModels(db)).map((m) => m.model_id).sort()).toEqual([base.model_id, "vendor/otro"].sort());
  });
  it("un id interno nuevo que choca con otro modelo recibe sufijo -2", async () => {
    await saveModel(db, OP, { ...base, id: "eco", model_id: "vendor/a", label: "Modelo A" }); const r = await saveModel(db, OP, { ...base, id: "", model_id: "vendor/b", label: "Modelo B", provider: "openrouter" }); expect(r.id).toBe("openrouter-vendor-b");
    const r2 = await saveModel(db, OP, { ...base, id: "", model_id: "vendor/b", label: "Modelo B2", provider: "anthropic", allowed_providers: "" }); expect(r2.id).toBe("anthropic-vendor-b");
  });
});
describe("guardar, editar, desactivar y volver a consultar", () => {
  it("ciclo completo con lectura posterior desde la base de datos", async () => {
    const c = await saveModel(db, OP, base); expect(c.model).toMatchObject({ enabled: true, verified: true, tier: "economy" }); expect((await usableModels(db)).map((m) => m.id)).toEqual(["haiku-55"]);
    const e = await saveModel(db, OP, { ...base, price_out_usd_mtok: "0,60", notes: "precio revisado" }); expect(e.action).toBe("actualizado"); expect((await listModels(db))[0]).toMatchObject({ price_out_usd_mtok: 0.6, notes: "precio revisado" });
    await setModelEnabled(db, OP, "haiku-55", false); expect((await usableModels(db))).toHaveLength(0); expect((await listModels(db))[0].enabled).toBe(false); await setModelEnabled(db, OP, "haiku-55", true); expect((await usableModels(db))).toHaveLength(1);
    await saveModel(db, OP, { ...base, enabled: false, verified: false }); await expect(setModelEnabled(db, OP, "haiku-55", true)).rejects.toThrow(/sin verificar/); await expect(setModelEnabled(db, OP, "no-existe", true)).rejects.toThrow(/no encontrado/i);
    expect((await db.query("SELECT action FROM audit_log WHERE action LIKE 'ai.model.%' ORDER BY id")).map((r: any) => r.action)).toEqual(["ai.model.upsert", "ai.model.upsert", "ai.model.disable", "ai.model.enable", "ai.model.upsert"]);
  });
  it("solo un operador puede guardar", async () => { await expect(saveModel(db, null, base)).rejects.toThrow(/permiso/); await expect(saveModel(db, { userId: "x", email: "otro@ejemplo.test" }, base)).rejects.toThrow(/permiso/); expect(await listModels(db)).toHaveLength(0); });
});
describe("del formulario HTML al modelo (lo que hace el panel)", () => {
  const form = (o: Record<string, string>) => modelInputFromForm((k) => (k in o ? o[k] : null));
  it("las casillas sin marcar llegan como false y las marcadas («on») como true", async () => {
    const r = await saveModel(db, OP, form({ id: "", provider: "openrouter", model_id: "vendor/m", label: "Modelo M", tier: "economy", max_level: "B", price_in_usd_mtok: "0,2", price_out_usd_mtok: "0,8", context_window: "32000", data_policy: "no_training", supports_tools: "on", allowed_providers: "a-b" }));
    expect(r.model).toMatchObject({ supports_tools: true, supports_json: false, enabled: false, verified: false, price_in_usd_mtok: 0.2 }); expect(r.model.allowed_providers).toEqual(["a-b"]);
  });
  it("el peso de créditos vacío vale 1", async () => { const r = await saveModel(db, OP, form({ provider: "openrouter", model_id: "vendor/m", label: "Modelo M", tier: "free", max_level: "A", price_in_usd_mtok: "0", price_out_usd_mtok: "0", context_window: "32000", data_policy: "unknown", credit_weight: "" })); expect(r.model.credit_weight).toBe(1); });
});
describe("reglas y cuotas: mismos mensajes claros y formatos humanos", () => {
  it("«0,05» y «80, 100» se aceptan; el texto no numérico se explica", async () => {
    await updateSettings(db, OP, { maxCallUsd: "0,05", maxAttempts: "2", callTimeoutMs: "90000", alertThresholds: "80, 100", allowPaidFallback: false, freeForInternal: false }); expect(await getSettings(db)).toMatchObject({ maxCallUsd: 0.05, maxAttempts: 2, alertThresholds: [80, 100] });
    await expect(updateSettings(db, OP, { maxCallUsd: "barato" })).rejects.toThrow(/Costo máximo de una llamada/); await expect(updateSettings(db, OP, { maxAttempts: "9" })).rejects.toThrow(/no puede ser mayor que 5/); await expect(updateSettings(db, OP, { alertThresholds: "a,b" })).rejects.toThrow(/porcentajes/);
  });
  it("cuota de plan con «6,5» se guarda; con tope por tarea mayor al presupuesto se rechaza en español", async () => {
    await updatePlanLimit(db, OP, "pro", { monthly_credits: "2000000", monthly_budget_usd: "6,5", max_offices: "1", allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: "0.4" }); expect((await listPlanLimits(db)).find((l) => l.plan === "pro")!.monthly_budget_usd).toBe(6.5);
    await expect(updatePlanLimit(db, OP, "pro", { monthly_credits: "2000000", monthly_budget_usd: "1", max_offices: "1", allowed_tiers: ["free"], max_level: "B", max_task_usd: "5" })).rejects.toThrow(/tope por tarea/); await expect(updatePlanLimit(db, OP, "pro", { monthly_credits: "x", monthly_budget_usd: "1", max_offices: "1", allowed_tiers: ["free"], max_level: "B", max_task_usd: "1" })).rejects.toThrow(/Créditos por mes/);
  });
});
describe("compatibilidad con la versión anterior (rollback del instalador v2)", () => {
  it("la columna nueva es aditiva: el INSERT de la versión anterior (sin allowed_providers) sigue funcionando y deja el valor por defecto", async () => {
    await db.query(`INSERT INTO ai_models(id,provider,model_id,label,tier,max_level,price_in_usd_mtok,price_out_usd_mtok,context_window,supports_tools,supports_json,data_policy,credit_weight,enabled,verified,notes,updated_by,updated_at)
      VALUES('viejo','openrouter','v/viejo','Viejo','economy','B',0.1,0.5,32000,true,true,'no_training',1,false,false,'','x',now())`);
    const m = (await listModels(db))[0]; expect(m.allowed_providers).toEqual([]); // sin proveedores aprobados: no apto para datos sensibles (falla cerrado)
  });
  it("las sentencias del router en el esquema son idempotentes: aplicarlas dos veces no falla", async () => { const fs = await import("node:fs"); const stmts = fs.readFileSync("src/server/db/schema.sql", "utf8").split(/;\s*\n/).map((q) => q.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim()).filter((q) => /ai_models/.test(q)).filter((q) => /^(CREATE|ALTER)/i.test(q)); expect(stmts.length).toBeGreaterThanOrEqual(2); for (let i = 0; i < 2; i++) for (const q of stmts) await db.query(q); expect((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='ai_models' AND column_name='allowed_providers'"))[0].n).toBe(1); });
});
