/** Tipos compartidos del router de IA. Un solo router para las 41 plantillas de empleados: la diferencia entre puestos son DATOS (perfiles), no motores. */
export type Tier = "free" | "economy" | "premium";
export type Level = "A" | "B" | "C";                       // A sencilla · B intermedia · C compleja
export type Sensitivity = "public" | "internal" | "confidential";
export type DataPolicy = "unknown" | "may_train" | "no_training" | "zero_retention";
export const LEVEL_RANK: Record<Level, number> = { A: 1, B: 2, C: 3 };
export const SENS_RANK: Record<Sensitivity, number> = { public: 0, internal: 1, confidential: 2 };
export const TIER_ORDER: Tier[] = ["free", "economy", "premium"];

export interface ModelRow {
  id: string; provider: "openrouter" | "anthropic"; model_id: string; label: string; tier: Tier; max_level: Level;
  price_in_usd_mtok: number; price_out_usd_mtok: number; context_window: number; supports_tools: boolean; supports_json: boolean;
  data_policy: DataPolicy; credit_weight: number; enabled: boolean; verified: boolean; notes: string;
  /** Proveedores/endpoints de OpenRouter APROBADOS para este modelo (slugs). Se envían como `provider.only`: es la restricción que se aplica DE VERDAD en la API. Vacío = no apto para datos sensibles. */
  allowed_providers: string[];
}
export interface AiSettings {
  maxAttempts: number;               // intentos totales por llamada (modelo inicial + fallbacks)
  maxCallUsd: number;                // tope duro de costo de UNA llamada
  allowPaidFallback: boolean;        // ¿un intento gratuito que falla puede escalar a un modelo de pago?
  freeForInternal: boolean;          // ¿modelos gratuitos con política verificada pueden ver datos internos?
  callTimeoutMs: number;
  alertThresholds: number[];         // % de la cuota que dispara una alerta
}
export const DEFAULT_SETTINGS: AiSettings = { maxAttempts: 3, maxCallUsd: 0.5, allowPaidFallback: false, freeForInternal: false, callTimeoutMs: 90_000, alertThresholds: [80, 100] };
export interface PlanLimit { plan: string; monthly_credits: number; monthly_budget_usd: number; max_offices: number; allowed_tiers: Tier[]; max_level: Level; max_task_usd: number }
