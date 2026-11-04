/**
 * MOTOR DETERMINISTA de «Mi Plan de Libertad». Funciones puras: sin IA, sin red, sin base de datos.
 * Todas las cantidades son pesos mexicanos (MXN) NETOS después de impuestos, tal como las declara la persona.
 * El motor no calcula impuestos ni da asesoría fiscal, legal o de inversión.
 */
export type Conf = "exacto" | "aprox" | "no_se";
export interface Periodic { label: string; amount: number; /** veces al año: 1 anual, 2 semestral, 4 trimestral, 6 bimestral, 12 mensual */ perYear: number; essential: boolean }
export type IncomeKind = "salario" | "retiros_negocio" | "dividendos" | "rentas" | "pension" | "otro";
export interface Income { kind: IncomeKind; label?: string; netMonthly: number; /** true = si dejas de trabajar este ingreso se detiene o cae */ dependsOnHours: boolean; stable?: boolean }
export type Disposition = "conservar" | "delegar_persona" | "asistir_ia" | "automatizar" | "eliminar";
export interface Activity { label: string; area: "ventas" | "marketing" | "atencion" | "administracion" | "operacion" | "equipo" | "otra"; hoursWeek: number; enjoy?: boolean; disposition?: Disposition }
export interface Assumptions {
  inflation: number;            // anual, ej. 0.04
  withdrawalRates: number[];    // escenarios ilustrativos, ej. [0.03,0.035,0.04,0.05]
  highCostDebtRate: number;     // tasa anual desde la cual una deuda se marca de alto costo
  growthPct: number;            // escenario de crecimiento del ingreso
  reductionPct: number;         // escenario de reducción del ingreso
  stressPct: number;            // caso de estrés (caída adicional del ingreso)
  horizonYears: number[];       // para proyectar con inflación
  weeksWorkedPerYear: number;
}
export interface Inputs {
  essentials?: Record<string, number>;     // mensual: vivienda, alimentacion, servicios, transporte, salud, seguros, educacion, dependientes, otros
  debtMinimums?: number;                    // pagos mínimos mensuales de deudas
  variable?: Record<string, number>;       // mensual: restaurantes, entretenimiento, suscripciones, ropa, compras, hobbies, viajes, regalos, otros
  periodic?: Periodic[];
  /** Modo corto: gasto mensual total aproximado, si no se detalla. */
  quickMonthlyTotal?: number;
  quickEssentialMonthly?: number;
  desired?: { totalOverride?: number; additions?: { label: string; monthly: number }[]; reductions?: { label: string; monthly: number }[] };
  incomes?: Income[];
  assets?: { liquid?: number; emergencyFund?: number; investments?: number; investmentsGeneratingCountedIncome?: number; realEstate?: number; businessEquity?: number; otherIlliquid?: number; liabilities?: number };
  risk?: { dependents?: number; incomeVariable?: boolean; topSourceShare?: number; healthInsurance?: boolean; lifeOrDisability?: boolean; highCostDebtBalance?: number; highCostDebtRate?: number; daysBusinessRunsWithoutOwner?: number };
  time?: { hoursWeek?: number; hoursDesired?: number; activities?: Activity[]; delegationHourlyCost?: number; weeksOffPerYear?: number };
  assumptions?: Partial<Assumptions>;
  confidence?: Record<string, Conf>;
}
export interface Metric<T = number> { value: T | null; missing: string[] }
export interface WithdrawalScenario { rate: number; goalGross: Metric; goalNet: Metric; progress: Metric }
export interface Results {
  assumptions: Assumptions;
  essentialMonthly: Metric; currentMonthly: Metric; desiredMonthly: Metric;
  incomeMonthly: Metric; freeCashFlow: Metric; incomeGap: Metric;
  emergency: { recommendedMonths: number; reasons: string[]; fundMonths: Metric; targetAmount: Metric; gapAmount: Metric; ladder: { months: number; target: Metric; covered: boolean | null }[] };
  incomeDependent: Metric; incomeSustainable: Metric; dependencyShare: Metric;
  sustainableCoverage: { essential: Metric; current: Metric; desired: Metric; gapToDesired: Metric };
  netWorth: Metric; investablePool: Metric;
  withdrawal: WithdrawalScenario[];
  time: { hoursNow: Metric; hoursDesired: Metric; hoursToRecover: Metric; recoverableByDisposition: Record<Disposition, number>; unclassifiedHours: number; recoverableHours: Metric; delegationMonthlyCost: Metric };
  scenarios: { name: "crecimiento" | "estabilidad" | "reduccion" | "estres"; incomeMonthly: Metric; freeCashFlow: Metric; runwayMonths: Metric }[];
  inflation: { horizon: number; desiredMonthlyNominal: Metric; goalNetNominal: Metric; liquidPurchasingPowerAtZeroReturn: Metric }[];
  risks: { key: string; level: "alto" | "medio" | "bajo" | "dato_faltante"; text: string }[];
  confidence: { level: "alta" | "media" | "baja"; score: number; note: string };
  incompleteNotes: string[];
}
