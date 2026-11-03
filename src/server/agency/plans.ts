/** Límites por plan. Sin precios ni cobros: la facturación se conectará después, con autorización. */
export const PLANS = {
  prueba: { label: "Prueba", maxClients: 2, maxEmployees: 8 },
  emprendedor: { label: "Emprendedor", maxClients: 5, maxEmployees: 30 },
  agencia: { label: "Agencia", maxClients: 25, maxEmployees: 200 },
  avanzado: { label: "Avanzado", maxClients: 100, maxEmployees: 1000 },
} as const;
export type PlanKey = keyof typeof PLANS;
export const planOf = (k: string) => PLANS[(k in PLANS ? k : "prueba") as PlanKey];
