import { DEFAULT_ASSUMPTIONS } from "./defaults";
import type { Assumptions, Disposition, Inputs, Metric, Results } from "./types";

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ok = (value: number): Metric => ({ value: r2(value), missing: [] });
const ratio = (n: number): Metric => ({ value: Math.round((n + Number.EPSILON) * 10000) / 10000, missing: [] });
const no = (...missing: string[]): Metric => ({ value: null, missing });
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const nn = (x: unknown) => (isNum(x) && x > 0 ? x : 0);
const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + nn(b), 0);
const has = (o?: Record<string, number>) => !!o && Object.values(o).some((v) => isNum(v));

/** Valor mensual de un gasto periódico: monto × veces al año ÷ 12 (prorrateo). */
export const monthlyOfPeriodic = (amount: number, perYear: number) => (nn(amount) * Math.max(0, perYear)) / 12;
/** Cuántos meses de gasto esencial conviene tener de reserva, según riesgos DECLARADOS. Es una regla orientativa propia, no una ley ni una garantía. */
export function recommendedEmergencyMonths(i: Inputs) {
  const reasons: string[] = []; let pts = 0; const r = i.risk ?? {};
  if (r.incomeVariable || (i.incomes ?? []).some((x) => x.stable === false)) { pts++; reasons.push("tus ingresos varían de un mes a otro"); }
  if (nn(r.dependents) > 0) { pts++; reasons.push("hay personas que dependen de ti"); }
  if (isNum(r.topSourceShare) && r.topSourceShare >= 0.5) { pts++; reasons.push("más de la mitad de tu ingreso viene de una sola fuente o cliente"); }
  return { months: pts === 0 ? 3 : pts === 1 ? 6 : pts === 2 ? 9 : 12, reasons: reasons.length ? reasons : ["no declaraste factores de riesgo adicionales (referencia mínima)"] };
}

export function compute(input: Inputs): Results {
  const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, ...(input.assumptions ?? {}) };
  const notes: string[] = [];
  const itemized = has(input.essentials) || has(input.variable) || (input.periodic?.length ?? 0) > 0 || isNum(input.debtMinimums);
  const periodicEss = (input.periodic ?? []).filter((p) => p.essential).reduce((s, p) => s + monthlyOfPeriodic(p.amount, p.perYear), 0);
  const periodicVar = (input.periodic ?? []).filter((p) => !p.essential).reduce((s, p) => s + monthlyOfPeriodic(p.amount, p.perYear), 0);

  // 1 y 2. Gasto esencial y gasto actual completo
  let essential: Metric = no("gastos esenciales"), current: Metric = no("gastos mensuales");
  if (has(input.essentials) || isNum(input.debtMinimums) || periodicEss > 0) essential = ok(sum(input.essentials) + nn(input.debtMinimums) + periodicEss);
  else if (isNum(input.quickEssentialMonthly)) essential = ok(nn(input.quickEssentialMonthly));
  if (itemized && essential.value !== null) current = ok(essential.value + sum(input.variable) + periodicVar);
  else if (isNum(input.quickMonthlyTotal)) { current = ok(nn(input.quickMonthlyTotal)); if (essential.value !== null && essential.value > current.value!) notes.push("Tu gasto esencial es mayor que tu gasto total aproximado: revisa ambos datos."); }
  if (itemized && essential.value === null) notes.push("Falta detallar los gastos esenciales: sin ellos no se puede calcular el gasto actual completo.");

  // 3. Estilo de vida deseado
  let desired: Metric = no("costo del estilo de vida deseado");
  const d = input.desired;
  if (d && isNum(d.totalOverride)) desired = ok(nn(d.totalOverride));
  else if (d && current.value !== null && ((d.additions?.length ?? 0) > 0 || (d.reductions?.length ?? 0) > 0)) desired = ok(Math.max(0, current.value + (d.additions ?? []).reduce((s, x) => s + nn(x.monthly), 0) - (d.reductions ?? []).reduce((s, x) => s + nn(x.monthly), 0)));
  else if (d && current.value !== null) desired = ok(current.value); // sin cambios declarados: igual al actual

  // 4 a 6. Ingreso, flujo y brecha
  const incomes = input.incomes ?? [];
  const incomeTotal: Metric = incomes.length ? ok(incomes.reduce((s, x) => s + nn(x.netMonthly), 0)) : no("ingresos netos mensuales");
  const flow: Metric = incomeTotal.value !== null && current.value !== null ? ok(incomeTotal.value - current.value) : no(...incomeTotal.missing, ...current.missing);
  const gap: Metric = incomeTotal.value !== null && desired.value !== null ? ok(desired.value - incomeTotal.value) : no(...incomeTotal.missing, ...desired.missing);

  // 7 y 8. Fondo de emergencia
  const rec = recommendedEmergencyMonths(input); const fund = input.assets?.emergencyFund;
  const base = essential.value;
  const emergency = {
    recommendedMonths: rec.months, reasons: rec.reasons,
    fundMonths: base !== null && base > 0 && isNum(fund) ? ok(nn(fund) / base) : no(...(base === null ? ["gasto esencial"] : []), ...(isNum(fund) ? [] : ["fondo de emergencia actual"])),
    targetAmount: base !== null ? ok(rec.months * base) : no("gasto esencial"),
    gapAmount: base !== null && isNum(fund) ? ok(Math.max(0, rec.months * base - nn(fund))) : no(...(base === null ? ["gasto esencial"] : []), ...(isNum(fund) ? [] : ["fondo de emergencia actual"])),
    ladder: [3, 6, 9, 12].map((m) => ({ months: m, target: base !== null ? ok(m * base) : no("gasto esencial"), covered: base !== null && isNum(fund) ? nn(fund) >= m * base : null })),
  };

  // 9 a 11. Dependencia del trabajo personal e ingresos sostenibles (sin doble conteo: cada ingreso se cuenta una sola vez)
  const dep = incomes.filter((x) => x.dependsOnHours).reduce((s, x) => s + nn(x.netMonthly), 0);
  const sus = incomes.filter((x) => !x.dependsOnHours).reduce((s, x) => s + nn(x.netMonthly), 0);
  const tot = incomeTotal.value;
  const cov = (target: Metric): Metric => (tot === null || target.value === null || target.value <= 0 ? no(...(tot === null ? ["ingresos"] : []), ...(target.value === null ? target.missing : [])) : ratio(sus / target.value));
  const sustainableCoverage = { essential: cov(essential), current: cov(current), desired: cov(desired), gapToDesired: tot !== null && desired.value !== null ? ok(Math.max(0, desired.value - sus)) : no(...(tot === null ? ["ingresos"] : []), ...desired.missing) };

  // Patrimonio
  const A = input.assets ?? {};
  const anyAsset = Object.values(A).some(isNum);
  const netWorth: Metric = anyAsset ? ok(nn(A.liquid) + nn(A.investments) + nn(A.realEstate) + nn(A.businessEquity) + nn(A.otherIlliquid) - nn(A.liabilities)) : no("patrimonio");
  // Bolsa invertible: efectivo y ahorro por encima del fondo de emergencia + inversiones, SIN las que ya producen un ingreso contado arriba (evita doble conteo).
  if (isNum(A.emergencyFund) && isNum(A.liquid) && A.emergencyFund > A.liquid) notes.push("Tu fondo de emergencia es mayor que tu liquidez total: revisa ambos datos.");
  if (isNum(A.investmentsGeneratingCountedIncome) && isNum(A.investments) && A.investmentsGeneratingCountedIncome > A.investments) notes.push("Las inversiones que ya generan ingreso no pueden superar tus inversiones totales.");
  const pool: Metric = isNum(A.liquid) || isNum(A.investments) ? ok(Math.max(0, nn(A.liquid) - nn(A.emergencyFund)) + Math.max(0, nn(A.investments) - nn(A.investmentsGeneratingCountedIncome))) : no("liquidez o inversiones");

  // 12. Meta patrimonial ilustrativa por escenario de tasa de retiro
  const withdrawal = a.withdrawalRates.filter((r) => r > 0 && r < 1).map((rate) => {
    const gross: Metric = desired.value !== null ? ok((desired.value * 12) / rate) : no(...desired.missing);
    const net: Metric = sustainableCoverage.gapToDesired.value !== null ? ok((sustainableCoverage.gapToDesired.value * 12) / rate) : no(...sustainableCoverage.gapToDesired.missing);
    const progress: Metric = net.value !== null && pool.value !== null ? (net.value === 0 ? ratio(1) : ratio(Math.min(pool.value / net.value, 9.99))) : no(...net.missing, ...pool.missing);
    return { rate, goalGross: gross, goalNet: net, progress };
  });

  // 13 a 15. Tiempo
  const T = input.time ?? {}; const acts = T.activities ?? [];
  const byDisp: Record<Disposition, number> = { conservar: 0, delegar_persona: 0, asistir_ia: 0, automatizar: 0, eliminar: 0 }; let unclassified = 0;
  for (const x of acts) { if (x.disposition) byDisp[x.disposition] += nn(x.hoursWeek); else unclassified += nn(x.hoursWeek); }
  const toRecover: Metric = isNum(T.hoursWeek) && isNum(T.hoursDesired) ? ok(Math.max(0, T.hoursWeek - T.hoursDesired)) : no(...(isNum(T.hoursWeek) ? [] : ["horas trabajadas por semana"]), ...(isNum(T.hoursDesired) ? [] : ["horas deseadas por semana"]));
  // Horas que PODRÍAN liberarse según lo clasificado (no es ahorro medido: requiere validar permisos, calidad e integraciones).
  const recoverableHours: Metric = acts.length ? ok(byDisp.delegar_persona + byDisp.eliminar + byDisp.automatizar * 0.5 + byDisp.asistir_ia * 0.3) : no("actividades clasificadas");
  const weeksW = Math.max(1, 52 - nn(T.weeksOffPerYear ?? 4));
  const delegCost: Metric = isNum(T.delegationHourlyCost) && byDisp.delegar_persona >= 0 && acts.length ? ok((byDisp.delegar_persona * nn(T.delegationHourlyCost) * weeksW) / 12) : no(...(isNum(T.delegationHourlyCost) ? [] : ["costo por hora de delegar"]), ...(acts.length ? [] : ["actividades clasificadas"]));

  // 16. Escenarios de ingreso
  const mk = (name: Results["scenarios"][number]["name"], mult: number) => {
    const inc: Metric = tot !== null ? ok(tot * mult) : no(...incomeTotal.missing);
    const fl: Metric = inc.value !== null && current.value !== null ? ok(inc.value - current.value) : no(...inc.missing, ...current.missing);
    const liquid = A.liquid; const run: Metric = fl.value === null ? no(...fl.missing) : fl.value >= 0 ? { value: null, missing: [] } : isNum(liquid) ? ok(nn(liquid) / -fl.value) : no("liquidez");
    return { name, incomeMonthly: inc, freeCashFlow: fl, runwayMonths: run };
  };
  const scenarios = [mk("crecimiento", 1 + a.growthPct), mk("estabilidad", 1), mk("reduccion", 1 - a.reductionPct), mk("estres", 1 - a.stressPct)];

  // 17. Inflación (en pesos de hoy → pesos nominales al horizonte)
  const inflation = a.horizonYears.map((h) => { const f = Math.pow(1 + a.inflation, h); const mid = withdrawal[Math.min(2, withdrawal.length - 1)]; return {
    horizon: h, desiredMonthlyNominal: desired.value !== null ? ok(desired.value * f) : no(...desired.missing),
    goalNetNominal: mid?.goalNet.value != null ? ok(mid.goalNet.value * f) : no(...(mid?.goalNet.missing ?? ["meta patrimonial"])),
    liquidPurchasingPowerAtZeroReturn: isNum(A.liquid) ? ok(nn(A.liquid) / f) : no("liquidez") }; });

  // 18. Riesgos de concentración, liquidez y otros
  const risks: Results["risks"] = []; const R = input.risk ?? {};
  risks.push(isNum(R.topSourceShare) ? { key: "concentracion", level: R.topSourceShare >= 0.6 ? "alto" : R.topSourceShare >= 0.4 ? "medio" : "bajo", text: `${Math.round(R.topSourceShare * 100)}% de tu ingreso depende de una sola fuente o cliente.` } : { key: "concentracion", level: "dato_faltante", text: "No sabemos cuánto de tu ingreso depende de una sola fuente." });
  const illiquid = nn(A.realEstate) + nn(A.businessEquity) + nn(A.otherIlliquid); const totalAssets = nn(A.liquid) + nn(A.investments) + illiquid;
  risks.push(anyAsset && totalAssets > 0 ? { key: "liquidez", level: illiquid / totalAssets >= 0.8 ? "alto" : illiquid / totalAssets >= 0.5 ? "medio" : "bajo", text: `${Math.round((illiquid / totalAssets) * 100)}% de tus bienes es difícil de convertir en efectivo rápido (inmuebles, negocio u otros).` } : { key: "liquidez", level: "dato_faltante", text: "Falta tu patrimonio para evaluar liquidez." });
  risks.push(isNum(R.highCostDebtBalance) && R.highCostDebtBalance > 0 ? { key: "deuda", level: (R.highCostDebtRate ?? 1) >= a.highCostDebtRate ? "alto" : "medio", text: `Tienes deuda por ${r2(R.highCostDebtBalance)} MXN${isNum(R.highCostDebtRate) ? ` con tasa anual declarada de ${Math.round(R.highCostDebtRate * 100)}%` : " (sin tasa declarada)"}.` } : { key: "deuda", level: isNum(R.highCostDebtBalance) ? "bajo" : "dato_faltante", text: isNum(R.highCostDebtBalance) ? "No declaraste deuda de alto costo." : "No sabemos si tienes deuda de alto costo." });
  if (nn(R.dependents) > 0 && R.lifeOrDisability === false) risks.push({ key: "proteccion", level: "alto", text: "Hay dependientes y no declaraste seguro de vida o incapacidad." });
  else if (R.healthInsurance === false) risks.push({ key: "proteccion", level: "medio", text: "No declaraste seguro de gastos médicos." });
  if (isNum(R.daysBusinessRunsWithoutOwner)) risks.push({ key: "dependencia_dueno", level: R.daysBusinessRunsWithoutOwner < 3 ? "alto" : R.daysBusinessRunsWithoutOwner < 14 ? "medio" : "bajo", text: `Tu negocio puede operar ${R.daysBusinessRunsWithoutOwner} día(s) sin tu intervención.` });
  if (emergency.fundMonths.value !== null && emergency.fundMonths.value < Math.min(3, rec.months)) risks.push({ key: "fondo", level: "alto", text: `Tu fondo cubre ${emergency.fundMonths.value.toFixed(1)} meses de gasto esencial.` });

  // Confianza en los datos
  const keyFields: [string, boolean][] = [["gastos", current.value !== null], ["ingresos", tot !== null], ["liquidez", isNum(A.liquid)], ["horas", isNum(T.hoursWeek)], ["deseado", desired.value !== null], ["fondo", isNum(A.emergencyFund)]];
  const present = keyFields.filter(([, p]) => p).length; const cf = Object.values(input.confidence ?? {});
  const quality = cf.length ? cf.reduce((s, c) => s + (c === "exacto" ? 1 : c === "aprox" ? 0.6 : 0), 0) / cf.length : 0.6;
  const score = r2((present / keyFields.length) * quality);
  const confidence = { level: score >= 0.7 ? "alta" as const : score >= 0.4 ? "media" as const : "baja" as const, score, note: `${present} de ${keyFields.length} datos clave capturados; calidad declarada de las respuestas ${Math.round(quality * 100)}%.` };
  return { assumptions: a, essentialMonthly: essential, currentMonthly: current, desiredMonthly: desired, incomeMonthly: incomeTotal, freeCashFlow: flow, incomeGap: gap, emergency,
    incomeDependent: incomes.length ? ok(dep) : no("ingresos"), incomeSustainable: incomes.length ? ok(sus) : no("ingresos"), dependencyShare: tot !== null && tot > 0 ? ratio(dep / tot) : no("ingresos"),
    sustainableCoverage, netWorth, investablePool: pool, withdrawal,
    time: { hoursNow: isNum(T.hoursWeek) ? ok(T.hoursWeek) : no("horas trabajadas por semana"), hoursDesired: isNum(T.hoursDesired) ? ok(T.hoursDesired) : no("horas deseadas por semana"), hoursToRecover: toRecover, recoverableByDisposition: byDisp, unclassifiedHours: r2(unclassified), recoverableHours, delegationMonthlyCost: delegCost },
    scenarios, inflation, risks, confidence, incompleteNotes: notes };
}
