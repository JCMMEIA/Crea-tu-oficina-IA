import type { Assumptions } from "./types";
/** Supuestos de partida EDITABLES. Son ilustrativos, no predicciones ni recomendaciones. La persona puede cambiarlos y ver el efecto. */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  inflation: 0.04, withdrawalRates: [0.03, 0.035, 0.04, 0.05], highCostDebtRate: 0.25,
  growthPct: 0.1, reductionPct: 0.2, stressPct: 0.4, horizonYears: [5, 10, 20], weeksWorkedPerYear: 48,
};
export const ESSENTIAL_KEYS = ["vivienda", "alimentacion", "servicios", "transporte", "salud", "seguros", "educacion", "dependientes", "otros_esenciales"] as const;
export const VARIABLE_KEYS = ["restaurantes", "entretenimiento", "suscripciones", "ropa", "compras", "hobbies", "viajes", "regalos", "otros_variables"] as const;
export const PERIODIC_PERYEAR: Record<string, number> = { anual: 1, semestral: 2, trimestral: 4, bimestral: 6, mensual: 12 };
