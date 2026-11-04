import type { Answers } from "./cuestionario";
import type { Results } from "./engine";

/** Formato de pesos mexicanos. */
export const mxn = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n));
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
export type Origin = "dato" | "calculo" | "estimacion" | "recomendacion" | "supuesto";
export const ORIGIN_LABEL: Record<Origin, string> = { dato: "Dato que tú aportaste", calculo: "Cálculo matemático", estimacion: "Estimación", recomendacion: "Recomendación general", supuesto: "Supuesto sin confirmar" };

export interface Goal { text: string; origin: Origin }
/** Objetivos concretos y revisables, armados con TUS respuestas y los cálculos. No interpretan emociones ni definen tu felicidad. */
export function goalsFrom(a: Answers, r: Results): Goal[] {
  const g: Goal[] = [];
  if (r.time.hoursNow.value !== null && r.time.hoursDesired.value !== null && r.time.hoursToRecover.value! > 0) g.push({ text: `Pasar de ${r.time.hoursNow.value} a ${r.time.hoursDesired.value} horas de trabajo por semana (recuperar ${r.time.hoursToRecover.value}).`, origin: "dato" });
  else if (r.time.hoursNow.value !== null && r.time.hoursDesired.value !== null) g.push({ text: `Mantener tu tiempo de trabajo en ${r.time.hoursDesired.value} horas por semana.`, origin: "dato" });
  if (r.desiredMonthly.value !== null) g.push({ text: `Poder sostener ${mxn(r.desiredMonthly.value)} al mes (en pesos de hoy) con ingresos netos.`, origin: "dato" });
  if (r.sustainableCoverage.desired.value !== null) g.push({ text: `Hoy ${pct(r.sustainableCoverage.desired.value)} de esa vida se cubre con ingresos que no dependen de tus horas de trabajo.`, origin: "calculo" });
  if (r.emergency.fundMonths.value !== null) g.push({ text: `Fondo de emergencia: de ${r.emergency.fundMonths.value.toFixed(1)} a ${r.emergency.recommendedMonths} meses de gasto esencial (referencia que usamos según los riesgos que declaraste).`, origin: "recomendacion" });
  const plazo = a.c_plazo; if (typeof plazo === "string" && plazo !== "no_se") g.push({ text: `Revisar este plan cada trimestre y acercarte a esta vida en ${plazo} año(s).`, origin: "dato" });
  return g;
}
export interface Action { when: 30 | 90 | 365; text: string; origin: Origin }
/** Plan de acción 30/90/365 con reglas fijas a partir de los resultados. Son recomendaciones GENERALES, no asesoría financiera personalizada. */
export function actionPlan(r: Results, a: Answers): Action[] {
  const out: Action[] = []; const add = (when: Action["when"], text: string) => out.push({ when, text, origin: "recomendacion" });
  const missing = [...new Set([r.currentMonthly, r.incomeMonthly, r.desiredMonthly, r.time.hoursNow, r.netWorth].flatMap((m) => m.missing))];
  if (missing.length) add(30, `Completa lo que falta para que los cálculos sean más precisos: ${missing.slice(0, 4).join(", ")}.`);
  const fm = r.emergency.fundMonths.value; if (fm !== null && fm < 3) add(30, "Define una cantidad mensual fija para tu fondo de emergencia y automatiza el traspaso el día que recibes ingresos.");
  if (r.risks.some((x) => x.key === "deuda" && x.level === "alto")) add(30, "Haz una lista de tus deudas ordenadas por tasa de interés y revisa opciones para reducir las más caras (CONDUSEF ofrece información comparativa).");
  if (r.risks.some((x) => x.key === "proteccion" && x.level === "alto")) add(30, "Revisa con un profesional autorizado la protección de tus dependientes (seguro de vida o incapacidad).");
  if (r.time.hoursToRecover.value !== null && r.time.hoursToRecover.value > 0) add(30, "Elige una o dos tareas que quieras dejar de hacer y pruébalas con tu Oficina IA; tú revisas cada resultado antes de usarlo.");
  if (r.time.unclassifiedHours > 0) add(30, `Clasifica las ${r.time.unclassifiedHours} horas semanales que aún no decides si conservar, delegar o automatizar.`);
  add(30, "Haz tu primer seguimiento mensual: ingreso neto, gasto, horas y ahorro del mes.");
  if (fm !== null && fm < Math.min(3, r.emergency.recommendedMonths)) add(90, "Llega a por lo menos 3 meses de gasto esencial en tu fondo de emergencia.");
  else if (fm !== null && fm < r.emergency.recommendedMonths) add(90, `Acércate a ${r.emergency.recommendedMonths} meses de gasto esencial en tu fondo de emergencia.`);
  if (r.time.hoursToRecover.value) add(90, "Mide cuántas horas recuperaste realmente con cada tarea delegada o asistida; solo lo medido cuenta como ahorro.");
  if (r.risks.some((x) => x.key === "concentracion" && (x.level === "alto" || x.level === "medio"))) add(90, "Plantea cómo repartir tu ingreso entre más clientes o fuentes para depender menos de una sola.");
  if (r.risks.some((x) => x.key === "dependencia_dueno" && x.level !== "bajo")) add(90, "Documenta los procesos clave de tu negocio para que pueda operar más días sin ti.");
  add(90, "Revisa tus supuestos (inflación, escenarios de retiro) y compara una nueva versión de tu plan con la primera.");
  if (r.sustainableCoverage.desired.value !== null && r.sustainableCoverage.desired.value < 1) add(365, "Define cómo aumentar los ingresos que no dependen de tus horas (por ejemplo, sistemas que operen sin ti, rentas, inversión a largo plazo con asesoría profesional).");
  add(365, "Repite el diagnóstico completo, compara versiones y ajusta tus metas: tu definición de libertad puede cambiar y está bien.");
  if (typeof a.c_trabajo === "string" && a.c_trabajo === "seguir") add(365, "Confirma si prefieres seguir trabajando igual: tu plan puede enfocarse en elegir cómo y en qué trabajar, no en dejar de hacerlo.");
  return out;
}
export const dataBadges = (r: Results) => ({ completos: r.confidence.level, nota: r.confidence.note });
