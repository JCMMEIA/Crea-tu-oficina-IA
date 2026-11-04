import { z } from "zod";
import type { Db } from "../db";
import { audit } from "../auth/audit";
import { assertOperator, type Operator } from "../commercial/admin";
import { DEFAULT_SETTINGS, type AiSettings, type ModelRow, type PlanLimit, type Tier } from "./types";

/**
 * CONFIGURACIÓN DEL ROUTER (todo editable desde /admin/ia, con validación y auditoría). No hay modelos ni precios «de fábrica»:
 * un modelo solo participa si una persona lo registró con su precio y política de datos y lo marcó verificado y activo.
 */
const num = (v: unknown) => Number(v);
const rowToModel = (r: any): ModelRow => ({ ...r, price_in_usd_mtok: num(r.price_in_usd_mtok), price_out_usd_mtok: num(r.price_out_usd_mtok), credit_weight: num(r.credit_weight), context_window: Number(r.context_window), allowed_providers: Array.isArray(r.allowed_providers) ? r.allowed_providers : [] });
export const listModels = async (db: Db): Promise<ModelRow[]> => (await db.query("SELECT * FROM ai_models ORDER BY tier, price_out_usd_mtok, label")).map(rowToModel);
export const usableModels = async (db: Db): Promise<ModelRow[]> => (await db.query("SELECT * FROM ai_models WHERE enabled AND verified ORDER BY price_out_usd_mtok")).map(rowToModel);

/** Números tal como los escribe una persona (o un asistente): «0.10», «0,10», «$0.10», «US$ 0.10», «1,000,000», «1 000 000». Devuelve NaN si no es un número. */
export function parseNumber(v: unknown): number {
  if (typeof v === "number") return v; let t = String(v ?? "").trim().replace(/us\$|\$|usd|mxn|\s|_/gi, ""); if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");   // 1.234,50 · 1,234.50
  else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");                    // 1,000,000
  else t = t.replace(",", ".");                                                       // 0,10
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
}
const numField = (label: string, o: { min: number; max: number; int?: boolean; ej: string }) => z.preprocess(parseNumber, z.number({ error: `«${label}» debe ser un número (por ejemplo ${o.ej}).` }).refine((n) => !Number.isNaN(n), { message: `«${label}» debe ser un número (por ejemplo ${o.ej}).` }).min(o.min, { message: `«${label}» no puede ser menor que ${o.min}.` }).max(o.max, { message: `«${label}» no puede ser mayor que ${o.max}.` }).refine((n) => !o.int || Number.isInteger(n), { message: `«${label}» debe ser un número entero.` }));
const flag = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());
/** Identificador interno seguro: minúsculas, números, punto, guion bajo y guion. «anthropic/Claude Haiku 5.5» → «anthropic-claude-haiku-5.5». */
export const slugId = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+|[-._]+$/g, "").slice(0, 60);
export const PROVIDER_SLUG = /^[a-z0-9][a-z0-9._/-]{0,60}$/;
const providersField = z.preprocess((v) => (Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]+/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean), z.array(z.string().regex(PROVIDER_SLUG, "Un proveedor aprobado solo puede tener minúsculas, números, punto, guion y barra (por ejemplo «amazon-bedrock»).")).max(8, "Máximo 8 proveedores aprobados por modelo."));
const modelSchema = z.object({
  id: z.string().optional().default(""),
  provider: z.enum(["openrouter", "anthropic"], { error: "El proveedor debe ser «openrouter» o «anthropic»." }), model_id: z.string({ error: "Falta el id del modelo en el proveedor." }).trim().min(2, "El id del modelo en el proveedor es muy corto.").max(120, "El id del modelo es demasiado largo."), label: z.string({ error: "Falta el nombre." }).trim().min(2, "El nombre es muy corto (mínimo 2 letras).").max(80, "El nombre es demasiado largo (máximo 80)."),
  tier: z.enum(["free", "economy", "premium"], { error: "La categoría debe ser gratuita, económica o premium." }), max_level: z.enum(["A", "B", "C"], { error: "El nivel máximo debe ser A, B o C." }),
  price_in_usd_mtok: numField("US$ por millón de entrada", { min: 0, max: 1000, ej: "0.10" }), price_out_usd_mtok: numField("US$ por millón de salida", { min: 0, max: 1000, ej: "0.50" }), context_window: numField("Ventana de contexto", { min: 1000, max: 5_000_000, int: true, ej: "200000" }),
  supports_tools: flag, supports_json: flag, data_policy: z.enum(["unknown", "may_train", "no_training", "zero_retention"], { error: "Política de datos no válida." }),
  credit_weight: numField("Peso en créditos", { min: 0.1, max: 50, ej: "1" }), enabled: flag, verified: flag, notes: z.string().max(500, "Las notas son demasiado largas (máximo 500).").optional().default(""), allowed_providers: providersField.optional().default([]),
}).superRefine((m, ctx) => {
  if (m.tier === "free" && (m.price_in_usd_mtok > 0 || m.price_out_usd_mtok > 0)) ctx.addIssue({ code: "custom", message: "Un modelo gratuito debe tener precio 0." });
  if (m.tier !== "free" && (m.price_in_usd_mtok <= 0 || m.price_out_usd_mtok <= 0)) ctx.addIssue({ code: "custom", message: "Un modelo de pago necesita precio de entrada y de salida mayores a 0: sin precio no se puede controlar el costo." });
  if (m.enabled && !m.verified) ctx.addIssue({ code: "custom", message: "No se puede activar un modelo sin verificar su precio y su política de datos: marca «VERIFICADOS» o deja «Activo» sin marcar." });
  if (m.tier === "free" && m.max_level === "C") ctx.addIssue({ code: "custom", message: "Un modelo gratuito no se autoriza para tareas complejas (nivel C)." });
  if (m.provider === "anthropic" && m.allowed_providers.length) ctx.addIssue({ code: "custom", message: "Los proveedores aprobados solo aplican a OpenRouter." });
});
export type ModelInput = z.input<typeof modelSchema>;
export interface SaveModelResult { id: string; action: "creado" | "actualizado" | "sin_cambios"; matchedBy: "id" | "proveedor+modelo" | "nuevo"; model: ModelRow }
const FIELDS = ["provider", "model_id", "label", "tier", "max_level", "price_in_usd_mtok", "price_out_usd_mtok", "context_window", "supports_tools", "supports_json", "data_policy", "credit_weight", "enabled", "verified", "notes", "allowed_providers"] as const;
/** Guarda (crea o actualiza) un modelo de forma IDEMPOTENTE: la clave real es (proveedor, id del modelo). Repetir el envío no duplica ni falla. Todo en una transacción junto con la auditoría. */
export async function saveModel(db: Db, op: Operator | null, input: unknown): Promise<SaveModelResult> {
  assertOperator(op); const m = modelSchema.parse(input);
  return db.tx(async (t) => {
    const byId = m.id ? slugId(m.id) : ""; let existing: any = byId ? (await t.query("SELECT * FROM ai_models WHERE id=$1", [byId]))[0] : undefined; let matchedBy: SaveModelResult["matchedBy"] = existing ? "id" : "nuevo";
    const sameModel: any = (await t.query("SELECT * FROM ai_models WHERE provider=$1 AND model_id=$2", [m.provider, m.model_id]))[0];
    if (existing && sameModel && sameModel.id !== existing.id) throw new Error(`Ya existe otro modelo registrado con ese proveedor y esa id de modelo («${sameModel.id}»). Edítalo en lugar de crear otro.`);
    if (!existing && sameModel) { existing = sameModel; matchedBy = "proveedor+modelo"; }
    let id: string; if (existing) id = existing.id as string; else { const base = byId.length >= 2 ? byId : slugId(`${m.provider}-${m.model_id}`) || "modelo"; id = base; for (let n = 2; (await t.query("SELECT 1 FROM ai_models WHERE id=$1", [id])).length; n++) id = `${base}-${n}`.slice(0, 60); }
    const vals = [m.provider, m.model_id, m.label, m.tier, m.max_level, m.price_in_usd_mtok, m.price_out_usd_mtok, m.context_window, m.supports_tools, m.supports_json, m.data_policy, m.credit_weight, m.enabled, m.verified, m.notes, m.allowed_providers];
    let action: SaveModelResult["action"] = "creado";
    if (existing) { const before = rowToModel(existing) as any; const same = FIELDS.every((k, i) => JSON.stringify(before[k]) === JSON.stringify(vals[i])); action = same ? "sin_cambios" : "actualizado"; }
    if (action !== "sin_cambios") {
      await t.query(`INSERT INTO ai_models(id,provider,model_id,label,tier,max_level,price_in_usd_mtok,price_out_usd_mtok,context_window,supports_tools,supports_json,data_policy,credit_weight,enabled,verified,notes,allowed_providers,updated_by,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
        ON CONFLICT (id) DO UPDATE SET provider=$2,model_id=$3,label=$4,tier=$5,max_level=$6,price_in_usd_mtok=$7,price_out_usd_mtok=$8,context_window=$9,supports_tools=$10,supports_json=$11,data_policy=$12,credit_weight=$13,enabled=$14,verified=$15,notes=$16,allowed_providers=$17,updated_by=$18,updated_at=now()`, [id, ...vals, op.email]);
      await audit(t, { userId: op.userId }, "ai.model.upsert", id, { action, tier: m.tier, enabled: m.enabled, verified: m.verified, in: m.price_in_usd_mtok, out: m.price_out_usd_mtok, policy: m.data_policy, providers: m.allowed_providers });
    }
    const saved = (await t.query("SELECT * FROM ai_models WHERE id=$1", [id]))[0]; if (!saved) throw new Error("El modelo no quedó guardado (la lectura posterior no lo encontró). No se aplicó ningún cambio.");
    return { id, action, matchedBy, model: rowToModel(saved) };
  });
}
/** Compatibilidad: misma función con el nombre anterior. */
export async function upsertModel(db: Db, op: Operator | null, input: unknown) { await saveModel(db, op, input); }
/** Convierte un formulario (FormData u objeto) en la entrada de saveModel. Las casillas sin marcar llegan como false. */
export function modelInputFromForm(get: (k: string) => string | null | undefined): ModelInput {
  const v = (k: string) => String(get(k) ?? ""); const on = (k: string) => get(k) === "on";
  return { id: v("id"), provider: v("provider") as any, model_id: v("model_id"), label: v("label"), tier: v("tier") as any, max_level: v("max_level") as any, price_in_usd_mtok: v("price_in_usd_mtok"), price_out_usd_mtok: v("price_out_usd_mtok"), context_window: v("context_window"), supports_tools: on("supports_tools"), supports_json: on("supports_json"), data_policy: v("data_policy") as any, credit_weight: v("credit_weight") || "1", enabled: on("enabled"), verified: on("verified"), notes: v("notes"), allowed_providers: v("allowed_providers") };
}
/** Mensaje claro para una persona a partir de cualquier error (incluye todos los problemas de validación, no solo el primero). */
export function explainError(e: any): string {
  if (e?.name === "ZodError") return [...new Set((e.issues ?? []).map((i: any) => String(i.message)))].slice(0, 4).join(" · ") || "Revisa los datos.";
  const msg = String(e?.message ?? e ?? ""); if (/duplicate key|unique constraint/i.test(msg)) return "Ese modelo ya está registrado (mismo proveedor e id de modelo). Edítalo en lugar de crear otro."; return msg.slice(0, 300) || "No se pudo guardar.";
}
export async function setModelEnabled(db: Db, op: Operator | null, id: string, enabled: boolean) {
  assertOperator(op); const r = (await db.query("SELECT verified FROM ai_models WHERE id=$1", [id]))[0]; if (!r) throw new Error("Modelo no encontrado.");
  if (enabled && !r.verified) throw new Error("No se puede activar un modelo sin verificar su precio y su política de datos.");
  await db.query("UPDATE ai_models SET enabled=$2, updated_by=$3, updated_at=now() WHERE id=$1", [id, enabled, op.email]); await audit(db, { userId: op.userId }, enabled ? "ai.model.enable" : "ai.model.disable", id);
}

const settingsSchema = z.object({ maxAttempts: numField("Intentos máximos por llamada", { min: 1, max: 5, int: true, ej: "2" }), maxCallUsd: numField("Costo máximo de una llamada (US$)", { min: 0.001, max: 5, ej: "0.05" }), allowPaidFallback: flag, freeForInternal: flag, callTimeoutMs: numField("Tiempo límite por llamada (ms)", { min: 5000, max: 300_000, int: true, ej: "90000" }),
  alertThresholds: z.preprocess((v) => (Array.isArray(v) ? v : String(v ?? "").split(/[,;\s]+/).filter(Boolean)).map(parseNumber), z.array(z.number({ error: "Las alertas deben ser porcentajes enteros (por ejemplo 80, 100)." }).int("Las alertas deben ser porcentajes enteros (por ejemplo 80, 100).").min(1, "Cada alerta debe estar entre 1 y 100.").max(100, "Cada alerta debe estar entre 1 y 100.")).min(1, "Indica al menos una alerta.").max(5, "Máximo 5 alertas.")) });
export async function getSettings(db: Db): Promise<AiSettings> {
  const rows = await db.query("SELECT key,value FROM ai_settings"); const o: Record<string, unknown> = {}; for (const r of rows) o[r.key as string] = r.value;
  const p = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...o }); return p.success ? p.data : DEFAULT_SETTINGS;
}
export async function updateSettings(db: Db, op: Operator | null, patch: Record<string, unknown>) {
  assertOperator(op); const merged = settingsSchema.parse({ ...(await getSettings(db)), ...patch });
  for (const [k, v] of Object.entries(merged)) await db.query("INSERT INTO ai_settings(key,value,updated_by,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=now()", [k, JSON.stringify(v), op.email]);
  await audit(db, { userId: op.userId }, "ai.settings.update", "settings", patch as Record<string, unknown>);
}

/** Límites PROVISIONALES e internos por plan (no publicados). Starter/Pro/Business siguen la propuesta de la dirección; los planes anteriores quedan con topes finitos. */
export const DEFAULT_PLAN_LIMITS: PlanLimit[] = [
  { plan: "prueba", monthly_credits: 50_000, monthly_budget_usd: 0.5, max_offices: 1, allowed_tiers: ["free", "economy"], max_level: "B", max_task_usd: 0.05 },
  { plan: "emprendedor", monthly_credits: 500_000, monthly_budget_usd: 6, max_offices: 1, allowed_tiers: ["free", "economy", "premium"], max_level: "B", max_task_usd: 0.25 },
  { plan: "starter", monthly_credits: 500_000, monthly_budget_usd: 6, max_offices: 1, allowed_tiers: ["free", "economy", "premium"], max_level: "B", max_task_usd: 0.25 },
  { plan: "pro", monthly_credits: 2_000_000, monthly_budget_usd: 16, max_offices: 1, allowed_tiers: ["free", "economy", "premium"], max_level: "C", max_task_usd: 0.4 },
  { plan: "business", monthly_credits: 5_000_000, monthly_budget_usd: 40, max_offices: 3, allowed_tiers: ["free", "economy", "premium"], max_level: "C", max_task_usd: 0.6 },
  { plan: "agencia", monthly_credits: 5_000_000, monthly_budget_usd: 40, max_offices: 5, allowed_tiers: ["free", "economy", "premium"], max_level: "C", max_task_usd: 0.6 },
  { plan: "avanzado", monthly_credits: 15_000_000, monthly_budget_usd: 100, max_offices: 10, allowed_tiers: ["free", "economy", "premium"], max_level: "C", max_task_usd: 0.8 },
];
const toLimit = (r: any): PlanLimit => ({ plan: r.plan, monthly_credits: Number(r.monthly_credits), monthly_budget_usd: Number(r.monthly_budget_usd), max_offices: Number(r.max_offices), allowed_tiers: r.allowed_tiers as Tier[], max_level: r.max_level, max_task_usd: Number(r.max_task_usd) });
export async function ensurePlanDefaults(db: Db) { for (const p of DEFAULT_PLAN_LIMITS) await db.query("INSERT INTO ai_plan_limits(plan,monthly_credits,monthly_budget_usd,max_offices,allowed_tiers,max_level,max_task_usd) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (plan) DO NOTHING", [p.plan, p.monthly_credits, p.monthly_budget_usd, p.max_offices, p.allowed_tiers, p.max_level, p.max_task_usd]); }
export async function listPlanLimits(db: Db): Promise<PlanLimit[]> { await ensurePlanDefaults(db); return (await db.query("SELECT * FROM ai_plan_limits ORDER BY monthly_credits")).map(toLimit); }
export async function getPlanLimit(db: Db, plan: string): Promise<PlanLimit> { await ensurePlanDefaults(db); const r = (await db.query("SELECT * FROM ai_plan_limits WHERE plan=$1", [plan]))[0] ?? (await db.query("SELECT * FROM ai_plan_limits WHERE plan='prueba'"))[0]; return toLimit(r); }
const limitSchema = z.object({ monthly_credits: numField("Créditos por mes", { min: 1000, max: 1_000_000_000, int: true, ej: "500000" }), monthly_budget_usd: numField("Gasto máximo USD por mes", { min: 0.01, max: 100_000, ej: "6" }), max_offices: numField("Oficinas", { min: 1, max: 100, int: true, ej: "1" }), allowed_tiers: z.array(z.enum(["free", "economy", "premium"])).min(1, "Elige al menos una categoría de modelos."), max_level: z.enum(["A", "B", "C"]), max_task_usd: numField("Tope por tarea (US$)", { min: 0.001, max: 50, ej: "0.25" }) });
export async function updatePlanLimit(db: Db, op: Operator | null, plan: string, input: unknown) {
  assertOperator(op); await ensurePlanDefaults(db); const v = limitSchema.parse(input);
  if (v.max_task_usd > v.monthly_budget_usd) throw new Error("El tope por tarea no puede superar el presupuesto mensual.");
  const r = await db.query("UPDATE ai_plan_limits SET monthly_credits=$2,monthly_budget_usd=$3,max_offices=$4,allowed_tiers=$5,max_level=$6,max_task_usd=$7,updated_by=$8,updated_at=now() WHERE plan=$1 RETURNING plan", [plan, v.monthly_credits, v.monthly_budget_usd, v.max_offices, v.allowed_tiers, v.max_level, v.max_task_usd, op.email]);
  if (!r.length) throw new Error("Plan no encontrado."); await audit(db, { userId: op.userId }, "ai.plan_limit.update", plan, v as unknown as Record<string, unknown>);
}
