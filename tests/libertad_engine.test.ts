import { describe, it, expect } from "vitest";
import { compute, monthlyOfPeriodic, recommendedEmergencyMonths, type Inputs } from "@/features/libertad/engine";

const v = (m: { value: number | null }) => m.value;
const asalariada: Inputs = {
  essentials: { vivienda: 9000, alimentacion: 5000, servicios: 1500, transporte: 2000, salud: 800, seguros: 500, educacion: 0, dependientes: 0, otros_esenciales: 0 }, debtMinimums: 1200,
  variable: { restaurantes: 1500, entretenimiento: 600, suscripciones: 400, ropa: 500, compras: 500, hobbies: 300, viajes: 0, regalos: 200, otros_variables: 0 },
  periodic: [{ label: "Predial", amount: 2400, perYear: 1, essential: true }, { label: "Vacaciones", amount: 24000, perYear: 1, essential: false }, { label: "Seguro auto", amount: 6000, perYear: 2, essential: true }],
  desired: { additions: [{ label: "Viaje extra", monthly: 3000 }], reductions: [{ label: "Suscripciones", monthly: 400 }] },
  incomes: [{ kind: "salario", netMonthly: 32000, dependsOnHours: true, stable: true }],
  assets: { liquid: 60000, emergencyFund: 48000, investments: 100000, investmentsGeneratingCountedIncome: 0, liabilities: 0 },
  risk: { dependents: 0, topSourceShare: 1, highCostDebtBalance: 0 }, time: { hoursWeek: 45, hoursDesired: 35 },
};
describe("motor de Mi Plan de Libertad: fórmulas", () => {
  it("prorratea los gastos no mensuales: anual/12, semestral×2/12", () => {
    expect(monthlyOfPeriodic(2400, 1)).toBe(200); expect(monthlyOfPeriodic(6000, 2)).toBe(1000); expect(monthlyOfPeriodic(1000, 12)).toBe(1000); expect(monthlyOfPeriodic(-5, 1)).toBe(0);
  });
  it("persona asalariada: esencial, actual completo, deseado, flujo y brecha coinciden con el cálculo a mano", () => {
    const r = compute(asalariada);
    // esenciales 18800 + deuda 1200 + predial 200 + seguro auto 1000 = 21200
    expect(v(r.essentialMonthly)).toBe(21200);
    // + variables 4000 + vacaciones 2000 = 27200
    expect(v(r.currentMonthly)).toBe(27200);
    expect(v(r.desiredMonthly)).toBe(29800);            // 27200 + 3000 - 400
    expect(v(r.freeCashFlow)).toBe(4800);               // 32000 - 27200
    expect(v(r.incomeGap)).toBe(-2200);                 // deseado menor que ingreso: no hay brecha
    expect(v(r.incomeSustainable)).toBe(0); expect(v(r.dependencyShare)).toBe(1);
  });
  it("fondo de emergencia: referencia según riesgos, cobertura en meses y brecha", () => {
    const r = compute(asalariada);
    expect(r.emergency.recommendedMonths).toBe(6);       // un solo ingreso (>=50%) → 1 punto
    expect(v(r.emergency.fundMonths)).toBeCloseTo(2.26, 2); // 48000/21200
    expect(v(r.emergency.targetAmount)).toBe(127200); expect(v(r.emergency.gapAmount)).toBe(79200);
    expect(r.emergency.ladder.map((l) => l.covered)).toEqual([false, false, false, false]);
    expect(recommendedEmergencyMonths({}).months).toBe(3);
    expect(recommendedEmergencyMonths({ risk: { incomeVariable: true, dependents: 2, topSourceShare: 0.7 } }).months).toBe(12);
  });
  it("meta patrimonial por escenario: gasto anual neto / tasa; la tasa de retiro NO es rendimiento", () => {
    const r = compute({ ...asalariada, incomes: [{ kind: "salario", netMonthly: 32000, dependsOnHours: true }, { kind: "rentas", netMonthly: 10000, dependsOnHours: false }] });
    expect(v(r.incomeSustainable)).toBe(10000);
    expect(v(r.sustainableCoverage.gapToDesired)).toBe(19800);
    const s4 = r.withdrawal.find((w) => w.rate === 0.04)!; expect(v(s4.goalNet)).toBe(5940000);   // 19800*12/0.04
    expect(v(s4.goalGross)).toBe(8940000);                                                       // 29800*12/0.04
    const s3 = r.withdrawal.find((w) => w.rate === 0.03)!; expect(v(s3.goalNet)!).toBeGreaterThan(v(s4.goalNet)!);
    // bolsa invertible: (60000-48000) + 100000 = 112000 → avance 112000/5940000
    expect(v(r.investablePool)).toBe(112000); expect(v(s4.progress)).toBeCloseTo(0.02, 2);
  });
  it("no cuenta dos veces: las inversiones que ya generan el ingreso contado se excluyen de la bolsa invertible", () => {
    const r = compute({ ...asalariada, assets: { liquid: 60000, emergencyFund: 48000, investments: 100000, investmentsGeneratingCountedIncome: 100000 } });
    expect(v(r.investablePool)).toBe(12000);
  });
  it("ingresos sostenibles vs dependientes de horas; cobertura de gasto esencial", () => {
    const r = compute({ ...asalariada, incomes: [{ kind: "retiros_negocio", netMonthly: 30000, dependsOnHours: true }, { kind: "dividendos", netMonthly: 5000, dependsOnHours: false }, { kind: "pension", netMonthly: 2000, dependsOnHours: false }] });
    expect(v(r.incomeDependent)).toBe(30000); expect(v(r.incomeSustainable)).toBe(7000); expect(v(r.dependencyShare)).toBeCloseTo(0.8108, 3);
    expect(v(r.sustainableCoverage.essential)).toBeCloseTo(7000 / 21200, 4);
  });
  it("tiempo: horas por recuperar, clasificación y costo de delegar (solo con el costo por hora declarado)", () => {
    const r = compute({ time: { hoursWeek: 60, hoursDesired: 40, weeksOffPerYear: 4, delegationHourlyCost: 150, activities: [
      { label: "Responder clientes", area: "atencion", hoursWeek: 8, disposition: "asistir_ia" }, { label: "Cobranza", area: "administracion", hoursWeek: 4, disposition: "delegar_persona" },
      { label: "Reportes", area: "administracion", hoursWeek: 3, disposition: "eliminar" }, { label: "Ventas clave", area: "ventas", hoursWeek: 10, disposition: "conservar" }, { label: "Redes", area: "marketing", hoursWeek: 5 }] } });
    expect(v(r.time.hoursToRecover)).toBe(20); expect(r.time.unclassifiedHours).toBe(5);
    expect(v(r.time.recoverableHours)).toBeCloseTo(4 + 3 + 8 * 0.3, 5);   // delegar + eliminar + 30% de lo asistido por IA (supuesto)
    expect(v(r.time.delegationMonthlyCost)).toBe(r2m(4 * 150 * 48 / 12));
    expect(compute({ time: { hoursWeek: 60, hoursDesired: 40, activities: [{ label: "x", area: "otra", hoursWeek: 2, disposition: "delegar_persona" }] } }).time.delegationMonthlyCost.value).toBeNull();
  });
  it("inflación: el objetivo en pesos de hoy crece a pesos futuros y la liquidez pierde poder de compra", () => {
    const r = compute({ ...asalariada, assumptions: { inflation: 0.05, horizonYears: [10] } });
    const h = r.inflation[0]; expect(v(h.desiredMonthlyNominal)).toBeCloseTo(29800 * Math.pow(1.05, 10), 1); expect(v(h.liquidPurchasingPowerAtZeroReturn)).toBeCloseTo(60000 / Math.pow(1.05, 10), 1);
  });
  it("escenarios de crecimiento, estabilidad, reducción y estrés con meses de autonomía", () => {
    const r = compute({ ...asalariada, assumptions: { reductionPct: 0.2, stressPct: 0.4, growthPct: 0.1 } }); const by = Object.fromEntries(r.scenarios.map((s) => [s.name, s]));
    expect(v(by.estabilidad.freeCashFlow)).toBe(4800); expect(v(by.crecimiento.incomeMonthly)).toBe(35200); expect(v(by.reduccion.freeCashFlow)).toBe(32000 * 0.8 - 27200);
    expect(v(by.estres.freeCashFlow)).toBe(32000 * 0.6 - 27200); expect(v(by.estres.runwayMonths)).toBeCloseTo(60000 / 8000, 2); expect(by.estabilidad.runwayMonths.value).toBeNull();
  });
});
const r2m = (n: number) => Math.round(n * 100) / 100;

describe("motor: casos de negocio y datos incompletos", () => {
  it("empresario con ingresos variables y concentración: pide más fondo y marca el riesgo", () => {
    const r = compute({ ...asalariada, incomes: [{ kind: "retiros_negocio", netMonthly: 40000, dependsOnHours: true, stable: false }], risk: { incomeVariable: true, dependents: 2, topSourceShare: 0.7, daysBusinessRunsWithoutOwner: 1 } });
    expect(r.emergency.recommendedMonths).toBe(12); expect(r.risks.find((x) => x.key === "concentracion")!.level).toBe("alto"); expect(r.risks.find((x) => x.key === "dependencia_dueno")!.level).toBe("alto");
  });
  it("negocio con alta facturación y poca utilidad: el motor solo usa lo que sale al bolsillo (retiros netos), no la facturación", () => {
    const r = compute({ ...asalariada, incomes: [{ kind: "retiros_negocio", netMonthly: 8000, dependsOnHours: true }] });
    expect(v(r.incomeMonthly)).toBe(8000); expect(v(r.freeCashFlow)).toBe(8000 - 27200);
    expect(JSON.stringify(Object.keys(asalariada))).not.toMatch(/factur|ventas_totales/i);
  });
  it("patrimonio ilíquido: mucho valor, poca liquidez → riesgo de liquidez alto", () => {
    const r = compute({ ...asalariada, assets: { liquid: 20000, emergencyFund: 20000, investments: 0, realEstate: 4000000, businessEquity: 3000000 } });
    expect(v(r.netWorth)).toBe(7020000); expect(r.risks.find((x) => x.key === "liquidez")!.level).toBe("alto"); expect(v(r.investablePool)).toBe(0);
  });
  it("deudas de alto costo y dependientes sin seguro generan alertas", () => {
    const r = compute({ ...asalariada, assets: { ...asalariada.assets, liabilities: 80000 }, risk: { dependents: 2, lifeOrDisability: false, highCostDebtBalance: 50000, highCostDebtRate: 0.6 } });
    expect(r.risks.find((x) => x.key === "deuda")!.level).toBe("alto"); expect(r.risks.find((x) => x.key === "proteccion")!.level).toBe("alto"); expect(v(r.netWorth)).toBe(160000 - 80000);
  });
  it("quiere seguir trabajando: sin horas por recuperar y sin dependencia de una meta de retiro obligatoria", () => {
    const r = compute({ ...asalariada, time: { hoursWeek: 40, hoursDesired: 40 } }); expect(v(r.time.hoursToRecover)).toBe(0);
    const r2 = compute({ ...asalariada, time: { hoursWeek: 30, hoursDesired: 45 } }); expect(v(r2.time.hoursToRecover)).toBe(0); // desea trabajar más: no hay horas por recuperar
  });
  it("retiro temprano: la meta crece cuando baja la tasa y cuando sube el estilo de vida deseado", () => {
    const base = compute({ ...asalariada, desired: { totalOverride: 30000 } }), alto = compute({ ...asalariada, desired: { totalOverride: 60000 } });
    expect(v(alto.withdrawal[0].goalGross)!).toBeGreaterThan(v(base.withdrawal[0].goalGross)!); expect(v(base.withdrawal[0].goalGross)!).toBeGreaterThan(v(base.withdrawal[3].goalGross)!);
  });
  it("información incompleta: no inventa precisión; dice qué falta y la confianza es baja", () => {
    const r = compute({ quickMonthlyTotal: 20000 });
    expect(v(r.currentMonthly)).toBe(20000); expect(r.essentialMonthly.value).toBeNull(); expect(r.freeCashFlow.value).toBeNull(); expect(r.freeCashFlow.missing).toContain("ingresos netos mensuales");
    expect(r.emergency.fundMonths.value).toBeNull(); expect(r.withdrawal.every((w) => w.goalNet.value === null)).toBe(true); expect(r.confidence.level).toBe("baja");
    const vacio = compute({}); expect(vacio.currentMonthly.value).toBeNull(); expect(vacio.netWorth.value).toBeNull(); expect(vacio.confidence.level).toBe("baja");
  });
  it("modo corto: gasto total aproximado + ingreso + liquidez ya dan flujo y meses de autonomía", () => {
    const r = compute({ quickMonthlyTotal: 30000, quickEssentialMonthly: 18000, incomes: [{ kind: "retiros_negocio", netMonthly: 35000, dependsOnHours: true }], assets: { liquid: 90000, emergencyFund: 90000 }, desired: { totalOverride: 50000 } });
    expect(v(r.freeCashFlow)).toBe(5000); expect(v(r.emergency.fundMonths)).toBe(5); expect(v(r.incomeGap)).toBe(15000);
  });
  it("casos extremos: ceros, negativos y números inválidos no producen NaN ni infinitos", () => {
    const r = compute({ essentials: { vivienda: -100, alimentacion: NaN as any }, incomes: [{ kind: "salario", netMonthly: 0, dependsOnHours: true }], assets: { liquid: 0, emergencyFund: 0 }, desired: { totalOverride: 0 }, time: { hoursWeek: 0, hoursDesired: 0 }, assumptions: { withdrawalRates: [0, 1, 0.04] } });
    const flat = JSON.stringify(r); expect(flat).not.toMatch(/NaN|Infinity|null.*undefined/); expect(r.withdrawal).toHaveLength(1);
  });
  it("la confianza baja cuando las respuestas son aproximadas o desconocidas", () => {
    const exacto = compute({ ...asalariada, confidence: { gastos: "exacto", ingresos: "exacto" } }), aprox = compute({ ...asalariada, confidence: { gastos: "aprox", ingresos: "no_se" } });
    expect(exacto.confidence.score).toBeGreaterThan(aprox.confidence.score);
  });
  it("los supuestos son editables y se reflejan en el resultado", () => {
    const r = compute({ ...asalariada, assumptions: { withdrawalRates: [0.025], stressPct: 0.5 } }); expect(r.withdrawal).toHaveLength(1); expect(r.withdrawal[0].rate).toBe(0.025); expect(r.assumptions.stressPct).toBe(0.5);
  });
});
