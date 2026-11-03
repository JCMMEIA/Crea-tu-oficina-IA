/** Límites por plan. Los PRECIOS no están definidos todavía: los fija José con variables PLAN_PRICE_USD_<PLAN>. Sin precio = «por confirmar». */
export const PLANS = {
  prueba: { label: "Prueba", maxClients: 2, maxEmployees: 8 },
  emprendedor: { label: "Emprendedor", maxClients: 5, maxEmployees: 30 },
  agencia: { label: "Agencia", maxClients: 25, maxEmployees: 200 },
  avanzado: { label: "Avanzado", maxClients: 100, maxEmployees: 1000 },
} as const;
export type PlanKey = keyof typeof PLANS;
export const planOf = (k: string) => PLANS[(k in PLANS ? k : "prueba") as PlanKey];
export const PLAN_ORDER: PlanKey[] = ["prueba", "emprendedor", "agencia", "avanzado"];
export const PLAN_BLURB: Record<PlanKey, string> = {
  prueba: "Para conocer la plataforma y armar tu primera demostración.",
  emprendedor: "Para quien está empezando a atender a sus primeros clientes.",
  agencia: "Para una agencia con varios clientes activos.",
  avanzado: "Para agencias grandes que necesitan mucho espacio.",
};
export const isPlanKey = (k: string): k is PlanKey => k in PLANS;
/** Precio mensual en USD si José lo configuró; si no, null (la interfaz dice «por confirmar», nunca inventa un número). */
export function planPrice(k: PlanKey): number | null {
  const v = Number(process.env[`PLAN_PRICE_USD_${k.toUpperCase()}`]);
  return Number.isFinite(v) && v > 0 ? v : null;
}
