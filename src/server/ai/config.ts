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
const rowToModel = (r: any): ModelRow => ({ ...r, price_in_usd_mtok: num(r.price_in_usd_mtok), price_out_usd_mtok: num(r.price_out_usd_mtok), credit_weight: num(r.credit_weight), context_window: Number(r.context_window) });
export const listModels = async (db: Db): Promise<ModelRow[]> => (await db.query("SELECT * FROM ai_models ORDER BY tier, price_out_usd_mtok, label")).map(rowToModel);
export const usableModels = async (db: Db): Promise<ModelRow[]> => (await db.query("SELECT * FROM ai_models WHERE enabled AND verified ORDER BY price_out_usd_mtok")).map(rowToModel);

const modelSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,60}$/, "Identificador no válido (minúsculas, números, punto, guion)."),
  provider: z.enum(["openrouter", "anthropic"]), model_id: z.string().trim().min(2).max(120), label: z.string().trim().min(2).max(80),
  tier: z.enum(["free", "economy", "premium"]), max_level: z.enum(["A", "B", "C"]),
  price_in_usd_mtok: z.coerce.number().min(0).max(1000), price_out_usd_mtok: z.coerce.number().min(0).max(1000), context_window: z.coerce.number().int().min(1000).max(5_000_000),
  supports_tools: z.coerce.boolean(), supports_json: z.coerce.boolean(), data_policy: z.enum(["unknown", "may_train", "no_training", "zero_retention"]),
  credit_weight: z.coerce.number().min(0.1).max(50), enabled: z.coerce.boolean(), verified: z.coerce.boolean(), notes: z.string().max(500).default(""),
}).superRefine((m, ctx) => {
  if (m.tier === "free" && (m.price_in_usd_mtok > 0 || m.price_out_usd_mtok > 0)) ctx.addIssue({ code: "custom", message: "Un modelo gratuito debe tener precio 0." });
  if (m.tier !== "free" && (m.price_in_usd_mtok <= 0 || m.price_out_usd_mtok <= 0)) ctx.addIssue({ code: "custom", message: "Un modelo de pago necesita precio de entrada y de salida mayores a 0: sin precio no se puede controlar el costo." });
  if (m.enabled && !m.verified) ctx.addIssue({ code: "custom", message: "No se puede activar un modelo sin verificar su precio y su política de datos." });
  if (m.tier === "free" && m.max_level === "C") ctx.addIssue({ code: "custom", message: "Un modelo gratuito no se autoriza para tareas complejas (nivel C)." });
});
export async function upsertModel(db: Db, op: Operator | null, input: unknown) {
  assertOperator(op); const m = modelSchema.parse(input);
  await db.query(`INSERT INTO ai_models(id,provider,model_id,label,tier,max_level,price_in_usd_mtok,price_out_usd_mtok,context_window,supports_tools,supports_json,data_policy,credit_weight,enabled,verified,notes,updated_by,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
    ON CONFLICT (id) DO UPDATE SET provider=$2,model_id=$3,label=$4,tier=$5,max_level=$6,price_in_usd_mtok=$7,price_out_usd_mtok=$8,context_window=$9,supports_tools=$10,supports_json=$11,data_policy=$12,credit_weight=$13,enabled=$14,verified=$15,notes=$16,updated_by=$17,updated_at=now()`,
    [m.id, m.provider, m.model_id, m.label, m.tier, m.max_level, m.price_in_usd_mtok, m.price_out_usd_mtok, m.context_window, m.supports_tools, m.supports_json, m.data_policy, m.credit_weight, m.enabled, m.verified, m.notes, op.email]);
  await audit(db, { userId: op.userId }, "ai.model.upsert", m.id, { tier: m.tier, enabled: m.enabled, verified: m.verified, in: m.price_in_usd_mtok, out: m.price_out_usd_mtok, policy: m.data_policy });
}
export async function setModelEnabled(db: Db, op: Operator | null, id: string, enabled: boolean) {
  assertOperator(op); const r = (await db.query("SELECT verified FROM ai_models WHERE id=$1", [id]))[0]; if (!r) throw new Error("Modelo no encontrado.");
  if (enabled && !r.verified) throw new Error("No se puede activar un modelo sin verificar su precio y su política de datos.");
  await db.query("UPDATE ai_models SET enabled=$2, updated_by=$3, updated_at=now() WHERE id=$1", [id, enabled, op.email]); await audit(db, { userId: op.userId }, enabled ? "ai.model.enable" : "ai.model.disable", id);
}

const settingsSchema = z.object({ maxAttempts: z.coerce.number().int().min(1).max(5), maxCallUsd: z.coerce.number().min(0.001).max(5), allowPaidFallback: z.coerce.boolean(), freeForInternal: z.coerce.boolean(), callTimeoutMs: z.coerce.number().int().min(5000).max(300_000), alertThresholds: z.array(z.number().int().min(1).max(100)).min(1).max(5) });
export async function getSettings(db: Db): Promise<AiSettings> {
  const rows = await db.query("SELECT key,value FROM ai_settings"); const o: Record<string, unknown> = {}; for (const r of rows) o[r.key as string] = r.value;
  const p = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...o }); return p.success ? p.data : DEFAULT_SETTINGS;
}
export async function updateSettings(db: Db, op: Operator | null, patch: Partial<AiSettings>) {
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
const limitSchema = z.object({ monthly_credits: z.coerce.number().int().min(1000).max(1_000_000_000), monthly_budget_usd: z.coerce.number().min(0.01).max(100_000), max_offices: z.coerce.number().int().min(1).max(100), allowed_tiers: z.array(z.enum(["free", "economy", "premium"])).min(1), max_level: z.enum(["A", "B", "C"]), max_task_usd: z.coerce.number().min(0.001).max(50) });
export async function updatePlanLimit(db: Db, op: Operator | null, plan: string, input: unknown) {
  assertOperator(op); await ensurePlanDefaults(db); const v = limitSchema.parse(input);
  if (v.max_task_usd > v.monthly_budget_usd) throw new Error("El tope por tarea no puede superar el presupuesto mensual.");
  const r = await db.query("UPDATE ai_plan_limits SET monthly_credits=$2,monthly_budget_usd=$3,max_offices=$4,allowed_tiers=$5,max_level=$6,max_task_usd=$7,updated_by=$8,updated_at=now() WHERE plan=$1 RETURNING plan", [plan, v.monthly_credits, v.monthly_budget_usd, v.max_offices, v.allowed_tiers, v.max_level, v.max_task_usd, op.email]);
  if (!r.length) throw new Error("Plan no encontrado."); await audit(db, { userId: op.userId }, "ai.plan_limit.update", plan, v as unknown as Record<string, unknown>);
}
