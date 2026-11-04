import type { Activity, Disposition, Income, Inputs } from "./engine";

/**
 * CUESTIONARIO ADAPTATIVO de «Mi Plan de Libertad». Una pregunta cada vez, con explicación breve y opción de omitir.
 * Las cinco etapas son NUESTRA organización del proceso; no son una escala científica validada.
 * El flujo es determinista (sin IA): la siguiente pregunta depende de las respuestas anteriores.
 */
export type Stage = 1 | 2 | 3 | 4 | 5;
export const STAGES: Record<Stage, { name: string; blurb: string }> = {
  1: { name: "Claridad de vida", blurb: "Qué significa para ti vivir con libertad." },
  2: { name: "Seguridad financiera", blurb: "Cuánto cuesta tu vida, cuánto entra y qué tan protegido estás." },
  3: { name: "Libertad de tiempo", blurb: "Cuántas horas trabajas y cuáles quieres recuperar." },
  4: { name: "Libertad de elección", blurb: "Qué tanto depende tu ingreso de tu trabajo personal." },
  5: { name: "Independencia financiera", blurb: "Qué vida quieres sostener y qué patrimonio la respaldaría (escenarios, no promesas)." },
};
export type Value = string | number | boolean;
export type Answers = Record<string, Value>;
export interface Option { value: string; label: string }
export interface Question {
  id: string; stage: Stage; depth: "corto" | "profundo"; kind: "texto" | "numero" | "si_no" | "opcion" | "horas" | "porcentaje";
  prompt: string; why?: string; options?: Option[]; unit?: string; max?: number; optional?: boolean; allowApprox?: boolean;
  showIf?: (a: Answers) => boolean;
}
const num = (a: Answers, k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
const yes = (a: Answers, k: string) => a[k] === true;
const money = (id: string, stage: Stage, depth: "corto" | "profundo", prompt: string, why?: string, showIf?: Question["showIf"]): Question => ({ id, stage, depth, kind: "numero", unit: "MXN al mes", prompt, why, showIf, allowApprox: true, max: 1e9 });
const yearly = (id: string, prompt: string): Question => ({ id, stage: 2, depth: "profundo", kind: "numero", unit: "MXN al año", prompt, why: "Lo dividimos entre 12 para ver cuánto cuesta cada mes. Si no lo gastas, déjalo en 0.", allowApprox: true, max: 1e9 });
const text = (id: string, stage: Stage, depth: "corto" | "profundo", prompt: string, why?: string, showIf?: Question["showIf"]): Question => ({ id, stage, depth, kind: "texto", prompt, why, max: 600, showIf });
const hours = (id: string, stage: Stage, depth: "corto" | "profundo", prompt: string, why?: string, showIf?: Question["showIf"]): Question => ({ id, stage, depth, kind: "horas", unit: "horas por semana", prompt, why, max: 168, allowApprox: true, showIf });
const DISP: Option[] = [{ value: "conservar", label: "Conservarla yo" }, { value: "delegar_persona", label: "Delegarla a una persona" }, { value: "asistir_ia", label: "Que un empleado IA me ayude" }, { value: "automatizar", label: "Automatizarla en parte" }, { value: "eliminar", label: "Eliminarla (no aporta valor)" }];
const AREAS: [string, string][] = [["ventas", "ventas"], ["marketing", "marketing y redes"], ["atencion", "atención a clientes"], ["administracion", "administración, cobranza y papeleo"], ["operacion", "operación del día a día"], ["equipo", "equipo y reuniones"]];

export const QUESTIONS: Question[] = [
  // ── Etapa 1 · Claridad de vida ──
  text("c_libre", 1, "corto", "¿Qué significa para ti ser libre?", "Con tus propias palabras. No hay respuesta correcta."),
  text("c_cambio", 1, "corto", "¿Qué cambiarías mañana si el dinero no fuera una preocupación inmediata?"),
  { id: "c_trabajo", stage: 1, depth: "corto", kind: "opcion", prompt: "¿Quieres seguir trabajando o reducir tu participación?", why: "No asumimos que todos quieren retirarse: elige lo que más se acerque.", options: [{ value: "seguir", label: "Seguir trabajando como hoy" }, { value: "reducir", label: "Trabajar menos horas" }, { value: "cambiar", label: "Cambiar a un trabajo o negocio distinto" }, { value: "dejar", label: "Dejar de depender de mi trabajo" }, { value: "no_se", label: "Aún no lo sé" }] },
  { id: "c_plazo", stage: 1, depth: "corto", kind: "opcion", prompt: "¿En cuánto tiempo quieres acercarte a esa vida?", options: [{ value: "1", label: "1 año" }, { value: "3", label: "3 años" }, { value: "5", label: "5 años" }, { value: "10", label: "10 años" }, { value: "20", label: "20 años o más" }, { value: "no_se", label: "No lo sé todavía" }] },
  text("c_semana", 1, "profundo", "¿Cómo sería una semana ideal para ti?", "Cuántos días trabajas, qué haces con tu tiempo, con quién."),
  hours("c_familia", 1, "profundo", "¿Cuánto tiempo a la semana quieres dedicar a tu familia y amigos?"),
  text("c_hobbies", 1, "profundo", "¿Qué hobbies, viajes o actividades valoras?"),
  text("c_posponiendo", 1, "profundo", "¿Qué experiencias estás posponiendo?"),
  text("c_proteger", 1, "profundo", "¿Qué te gustaría proteger de tu estilo de vida actual?"),
  text("c_sacrificios", 1, "profundo", "¿Qué sacrificios NO estás dispuesto a hacer?", "Sirve para que el plan no te proponga caminos que no quieres."),
  // ── Etapa 2 · Seguridad financiera (modo corto) ──
  money("f_gasto_total", 2, "corto", "Más o menos, ¿cuánto gastas al mes en total en tu vida personal y familiar?", "Incluye todo lo de tu casa y tu vida. No es el gasto de tu negocio. Un cálculo aproximado basta; después puedes detallarlo."),
  money("f_gasto_esencial", 2, "corto", "De ese total, ¿cuánto es indispensable (casa, comida, servicios, transporte, salud, deudas mínimas)?", "Es lo que seguirías pagando aunque recortaras todo lo demás."),
  money("i_neto_total", 2, "corto", "¿Cuánto dinero NETO te llega al mes para tus gastos personales?", "Lo que realmente recibes después de impuestos y de pagar tu negocio. No uses la facturación de la empresa."),
  { id: "i_pct_depende", stage: 2, depth: "corto", kind: "porcentaje", unit: "%", prompt: "¿Qué porcentaje de ese ingreso se detendría o caería si dejaras de trabajar un año?", why: "Sueldo y retiros del negocio suelen depender de tu trabajo; rentas, pensión o dividendos no.", max: 100, allowApprox: true },
  { ...money("a_liquido", 2, "corto", "¿Cuánto dinero tienes disponible hoy (efectivo, cuentas y ahorros que podrías usar en días)?", "Un monto total. No pedimos números de cuenta."), unit: "MXN" },
  { ...money("a_fondo", 2, "corto", "De ese dinero, ¿cuánto tienes apartado como fondo de emergencia?", "Si no tienes uno, escribe 0. Evita contarlo dos veces."), unit: "MXN" },
  // ── Etapa 2 · detalle (profundo) ──
  ...["vivienda|Vivienda (renta o hipoteca)", "alimentacion|Alimentación", "servicios|Servicios (luz, agua, gas, internet, celular)", "transporte|Transporte", "salud|Salud", "seguros|Seguros (pagos mensuales)", "educacion|Educación", "dependientes|Dependientes económicos (apoyo a familiares)", "otros_esenciales|Otros compromisos recurrentes"].map((s) => money(`e_${s.split("|")[0]}`, 2, "profundo", `Gasto esencial mensual: ${s.split("|")[1]}`, "Escribe 0 si no aplica.")),
  money("e_deudas_minimos", 2, "profundo", "Pagos mínimos mensuales de deudas (tarjetas, créditos)", "Solo el pago mínimo obligatorio."),
  ...["restaurantes|Restaurantes", "entretenimiento|Entretenimiento", "suscripciones|Suscripciones", "ropa|Ropa", "compras|Compras", "hobbies|Hobbies", "viajes|Viajes (mensualizados)", "regalos|Regalos", "otros_variables|Otros gastos variables"].map((s) => money(`v_${s.split("|")[0]}`, 2, "profundo", `Gasto mensual en: ${s.split("|")[1]}`)),
  yearly("p_vacaciones", "¿Cuánto gastas al año en vacaciones?"), yearly("p_impuestos", "¿Cuánto pagas al año de impuestos personales o prediales que NO se descuentan de tu ingreso neto?"),
  yearly("p_reparaciones", "¿Cuánto gastas al año en reparaciones y mantenimiento (casa, auto)?"), yearly("p_colegiaturas", "¿Cuánto pagas al año en colegiaturas e inscripciones?"),
  yearly("p_seguros", "¿Cuánto pagas al año en seguros que no se cobran cada mes?"), yearly("p_extra", "¿Cuánto gastas al año en compras extraordinarias?"), yearly("p_otros", "¿Otros gastos que ocurren una o pocas veces al año?"),
  // Ingresos (profundo): sustituyen al modo corto
  money("i_salario", 2, "profundo", "Salario neto mensual", "Después de impuestos. 0 si no aplica."), money("i_retiros", 2, "profundo", "Retiros del negocio que realmente usas para gastos personales", "No es la facturación ni la utilidad contable: es lo que sale a tu bolsillo."),
  money("i_dividendos", 2, "profundo", "Dividendos netos mensuales (promedio)"), { id: "i_dividendos_indep", stage: 2, depth: "profundo", kind: "si_no", prompt: "¿Seguirías recibiendo esos dividendos aunque dejaras de trabajar un año?", showIf: (a) => (num(a, "i_dividendos") ?? 0) > 0 },
  money("i_rentas", 2, "profundo", "Rentas netas mensuales (después de gastos e impuestos)"), money("i_pension", 2, "profundo", "Pensiones mensuales"), money("i_otros", 2, "profundo", "Otros ingresos netos mensuales"),
  { id: "i_otros_indep", stage: 2, depth: "profundo", kind: "si_no", prompt: "¿Esos otros ingresos continuarían si dejaras de trabajar un año?", showIf: (a) => (num(a, "i_otros") ?? 0) > 0 },
  { id: "s_variable", stage: 2, depth: "profundo", kind: "si_no", prompt: "¿Tu ingreso cambia bastante de un mes a otro?", why: "Con ingresos variables conviene una reserva mayor." },
  { id: "s_top", stage: 2, depth: "profundo", kind: "opcion", prompt: "¿Qué parte de tu ingreso depende de tu mayor cliente o única fuente?", options: [{ value: "0.2", label: "Menos de 25%" }, { value: "0.4", label: "Entre 25% y 50%" }, { value: "0.6", label: "Entre 50% y 75%" }, { value: "0.85", label: "Más de 75%" }] },
  { id: "s_dependientes", stage: 2, depth: "profundo", kind: "numero", unit: "personas", prompt: "¿Cuántas personas dependen económicamente de ti?", max: 50 },
  { id: "s_seguro_salud", stage: 2, depth: "profundo", kind: "si_no", prompt: "¿Tienes seguro de gastos médicos?" },
  { id: "s_seguro_vida", stage: 2, depth: "profundo", kind: "si_no", prompt: "¿Tienes seguro de vida o de incapacidad?", showIf: (a) => (num(a, "s_dependientes") ?? 0) > 0 },
  { ...money("s_deuda_alta", 2, "profundo", "¿Cuánto debes en deudas de alto costo (tarjetas, préstamos caros)?"), unit: "MXN" },
  { id: "s_deuda_tasa", stage: 2, depth: "profundo", kind: "porcentaje", unit: "% anual", prompt: "¿Qué tasa anual aproximada pagas por esa deuda?", max: 300, allowApprox: true, showIf: (a) => (num(a, "s_deuda_alta") ?? 0) > 0 },
  // ── Etapa 3 · Libertad de tiempo ──
  hours("t_horas_sem", 3, "corto", "¿Cuántas horas trabajas en una semana normal?", "Cuenta también lo que haces fuera de horario y por WhatsApp."),
  hours("t_horas_deseadas", 3, "corto", "¿Cuántas horas a la semana te gustaría trabajar?", "Puede ser más, igual o menos que hoy."),
  hours("t_fuera", 3, "profundo", "De esas horas, ¿cuántas son fuera de tu horario habitual?"), hours("t_traslados", 3, "profundo", "¿Cuántas horas a la semana pasas en traslados de trabajo?"), hours("t_descanso", 3, "profundo", "¿Cuántas horas a la semana tienes de descanso real?"),
  ...AREAS.flatMap(([k, n]) => [hours(`t_h_${k}`, 3, "profundo", `¿Cuántas horas a la semana dedicas a ${n}?`, "0 si no lo haces."), { id: `t_d_${k}`, stage: 3 as Stage, depth: "profundo" as const, kind: "opcion" as const, prompt: `Del tiempo en ${n}, ¿qué te gustaría hacer?`, why: "No se promete automatizar nada por completo: primero validamos integraciones, calidad y permisos.", options: DISP, showIf: (a: Answers) => (num(a, `t_h_${k}`) ?? 0) > 0 }]),
  text("t_disfruta", 3, "profundo", "¿Qué actividades disfrutas hacer personalmente en tu negocio?"), text("t_dejar", 3, "profundo", "¿Qué actividades quieres dejar de hacer?"),
  // ── Etapa 4 · Libertad de elección ──
  { id: "l_dias_sin_dueno", stage: 4, depth: "profundo", kind: "numero", unit: "días", prompt: "¿Cuántos días puede operar tu negocio sin tu intervención?", max: 365 },
  { id: "l_costo_hora", stage: 4, depth: "profundo", kind: "numero", unit: "MXN por hora", prompt: "¿Cuánto costaría por hora contratar a alguien para las tareas que quieres delegar?", why: "Sirve para estimar el costo de recuperar tiempo. Si no lo sabes, déjalo vacío.", allowApprox: true, max: 100000, showIf: (a) => Object.keys(a).some((k) => k.startsWith("t_d_") && a[k] === "delegar_persona") },
  { id: "l_decir_no", stage: 4, depth: "profundo", kind: "opcion", prompt: "Hoy, ¿qué tan fácil te resulta rechazar un cliente, proyecto o condición que no te conviene?", options: [{ value: "facil", label: "Fácil" }, { value: "dificil", label: "Difícil" }, { value: "imposible", label: "Casi imposible por necesidad de ingreso" }] },
  // ── Etapa 5 · Independencia financiera ──
  money("d_total", 5, "corto", "¿Cuánto costaría al mes la vida que quieres? (en pesos de hoy)", "Si no lo sabes, puedes dejarlo vacío y usar el siguiente paso para sumar o restar a lo que gastas hoy."),
  { ...money("d_mas", 5, "profundo", "Si no escribiste un total: ¿cuánto MÁS al mes gastarías en la vida que quieres?", "Viajes, hobbies, tiempo con tu familia…", (a) => num(a, "d_total") === undefined), unit: "MXN al mes" },
  { ...money("d_menos", 5, "profundo", "¿Y cuánto MENOS gastarías al mes en cosas que dejarías de pagar?", undefined, (a) => num(a, "d_total") === undefined), unit: "MXN al mes" },
  { ...money("a_inversiones", 5, "profundo", "¿Cuánto tienes en inversiones (fondos, acciones, etc.)? Un monto total aproximado."), unit: "MXN" },
  { ...money("a_inv_flujo", 5, "profundo", "De esas inversiones, ¿cuánto YA produce los dividendos o rentas que contaste en tus ingresos?", "Así evitamos contarlas dos veces.", (a) => (num(a, "a_inversiones") ?? 0) > 0), unit: "MXN" },
  { ...money("a_inmuebles", 5, "profundo", "Valor aproximado de tus inmuebles (incluida tu casa)"), unit: "MXN" }, { ...money("a_negocio", 5, "profundo", "Valor aproximado de tu participación en negocios"), unit: "MXN" },
  { ...money("a_otros", 5, "profundo", "Otros bienes difíciles de convertir en efectivo (vehículos, arte, etc.)"), unit: "MXN" }, { ...money("a_deudas", 5, "profundo", "Total de lo que debes (hipotecas, créditos, tarjetas)"), unit: "MXN" },
];
export const QBY = new Map(QUESTIONS.map((q) => [q.id, q]));
const applicable = (q: Question, a: Answers, depth: "corto" | "profundo") => (depth === "profundo" || q.depth === "corto") && (!q.showIf || q.showIf(a));
export function nextQuestion(a: Answers, skipped: string[], depth: "corto" | "profundo"): Question | null {
  for (const q of QUESTIONS) if (applicable(q, a, depth) && a[q.id] === undefined && !skipped.includes(q.id)) return q;
  return null;
}
export function progress(a: Answers, skipped: string[], depth: "corto" | "profundo") {
  const list = QUESTIONS.filter((q) => applicable(q, a, depth)); const done = list.filter((q) => a[q.id] !== undefined || skipped.includes(q.id)).length;
  return { done, total: list.length, byStage: ([1, 2, 3, 4, 5] as Stage[]).map((s) => { const l = list.filter((q) => q.stage === s); return { stage: s, name: STAGES[s].name, done: l.filter((q) => a[q.id] !== undefined || skipped.includes(q.id)).length, total: l.length }; }) };
}
/** Valida y normaliza una respuesta según el tipo de pregunta. Lanza Error con mensaje en español. */
export function parseAnswer(q: Question, raw: string): Value {
  const t = raw.trim(); if (!t) throw new Error("Escribe una respuesta o usa «Omitir».");
  switch (q.kind) {
    case "texto": return t.slice(0, q.max ?? 600);
    case "si_no": if (t !== "si" && t !== "no") throw new Error("Elige Sí o No."); return t === "si";
    case "opcion": if (!q.options?.some((o) => o.value === t)) throw new Error("Elige una de las opciones."); return t;
    default: { const n = Number(t.replace(/[\s$,]/g, "")); if (!Number.isFinite(n) || n < 0) throw new Error("Escribe un número mayor o igual a 0."); if (n > (q.max ?? 1e9)) throw new Error(`El máximo es ${q.max ?? 1e9}.`); return Math.round(n * 100) / 100; }
  }
}
/** Convierte las respuestas en entradas del motor. Lo no respondido queda sin definir: el motor lo reporta como dato faltante. */
export function buildInputs(a: Answers, conf: Record<string, string> = {}, assumptions: Inputs["assumptions"] = {}): Inputs {
  const n = (k: string) => num(a, k); const pick = (pre: string) => { const o: Record<string, number> = {}; for (const q of QUESTIONS) if (q.id.startsWith(pre) && n(q.id) !== undefined) o[q.id.slice(pre.length)] = n(q.id)!; return o; };
  const inputs: Inputs = { assumptions, confidence: {} };
  const ess = pick("e_"); delete ess.deudas_minimos; const vari = pick("v_"); const detailed = Object.keys(ess).length > 0 || Object.keys(vari).length > 0;
  if (detailed) { inputs.essentials = ess; inputs.variable = vari; if (n("e_deudas_minimos") !== undefined) inputs.debtMinimums = n("e_deudas_minimos"); }
  else { if (n("f_gasto_total") !== undefined) inputs.quickMonthlyTotal = n("f_gasto_total"); if (n("f_gasto_esencial") !== undefined) inputs.quickEssentialMonthly = n("f_gasto_esencial"); }
  const per = [["p_vacaciones", "Vacaciones", false], ["p_impuestos", "Impuestos anuales", true], ["p_reparaciones", "Reparaciones y mantenimiento", true], ["p_colegiaturas", "Colegiaturas", true], ["p_seguros", "Seguros anuales", true], ["p_extra", "Compras extraordinarias", false], ["p_otros", "Otros periódicos", false]] as const;
  const periodic = per.filter(([k]) => n(k) !== undefined).map(([k, label, essential]) => ({ label, amount: n(k)!, perYear: 1, essential })); if (periodic.length) inputs.periodic = periodic;
  const inc: Income[] = [];
  if (["i_salario", "i_retiros", "i_dividendos", "i_rentas", "i_pension", "i_otros"].some((k) => n(k) !== undefined)) {
    if (n("i_salario")) inc.push({ kind: "salario", netMonthly: n("i_salario")!, dependsOnHours: true }); if (n("i_retiros")) inc.push({ kind: "retiros_negocio", netMonthly: n("i_retiros")!, dependsOnHours: true, stable: !yes(a, "s_variable") });
    if (n("i_dividendos")) inc.push({ kind: "dividendos", netMonthly: n("i_dividendos")!, dependsOnHours: a.i_dividendos_indep === false }); if (n("i_rentas")) inc.push({ kind: "rentas", netMonthly: n("i_rentas")!, dependsOnHours: false });
    if (n("i_pension")) inc.push({ kind: "pension", netMonthly: n("i_pension")!, dependsOnHours: false }); if (n("i_otros")) inc.push({ kind: "otro", netMonthly: n("i_otros")!, dependsOnHours: a.i_otros_indep === false });
    if (!inc.length) inc.push({ kind: "otro", netMonthly: 0, dependsOnHours: true });
  } else if (n("i_neto_total") !== undefined) { const p = Math.min(100, Math.max(0, n("i_pct_depende") ?? 100)) / 100; const t = n("i_neto_total")!; inc.push({ kind: "otro", label: "Ingreso que depende de tu trabajo", netMonthly: t * p, dependsOnHours: true }, { kind: "otro", label: "Ingreso que no depende de tu trabajo", netMonthly: t * (1 - p), dependsOnHours: false }); }
  if (inc.length) inputs.incomes = inc;
  inputs.assets = { liquid: n("a_liquido"), emergencyFund: n("a_fondo"), investments: n("a_inversiones"), investmentsGeneratingCountedIncome: n("a_inv_flujo"), realEstate: n("a_inmuebles"), businessEquity: n("a_negocio"), otherIlliquid: n("a_otros"), liabilities: n("a_deudas") };
  for (const k of Object.keys(inputs.assets) as (keyof NonNullable<Inputs["assets"]>)[]) if (inputs.assets[k] === undefined) delete inputs.assets[k]; if (!Object.keys(inputs.assets).length) delete inputs.assets;
  inputs.risk = { dependents: n("s_dependientes"), incomeVariable: typeof a.s_variable === "boolean" ? a.s_variable : undefined, topSourceShare: typeof a.s_top === "string" ? Number(a.s_top) : undefined, healthInsurance: typeof a.s_seguro_salud === "boolean" ? a.s_seguro_salud : undefined, lifeOrDisability: typeof a.s_seguro_vida === "boolean" ? a.s_seguro_vida : undefined, highCostDebtBalance: n("s_deuda_alta"), highCostDebtRate: n("s_deuda_tasa") !== undefined ? n("s_deuda_tasa")! / 100 : undefined, daysBusinessRunsWithoutOwner: n("l_dias_sin_dueno") };
  for (const k of Object.keys(inputs.risk) as (keyof NonNullable<Inputs["risk"]>)[]) if (inputs.risk[k] === undefined) delete inputs.risk[k];
  const acts: Activity[] = AREAS.filter(([k]) => n(`t_h_${k}`) !== undefined && n(`t_h_${k}`)! > 0).map(([k, label]) => ({ label, area: k as Activity["area"], hoursWeek: n(`t_h_${k}`)!, disposition: typeof a[`t_d_${k}`] === "string" ? (a[`t_d_${k}`] as Disposition) : undefined }));
  inputs.time = { hoursWeek: n("t_horas_sem"), hoursDesired: n("t_horas_deseadas"), delegationHourlyCost: n("l_costo_hora"), ...(acts.length ? { activities: acts } : {}) };
  for (const k of Object.keys(inputs.time) as (keyof NonNullable<Inputs["time"]>)[]) if (inputs.time[k] === undefined) delete inputs.time[k];
  if (n("d_total") !== undefined) inputs.desired = { totalOverride: n("d_total") }; else if (n("d_mas") !== undefined || n("d_menos") !== undefined) inputs.desired = { additions: n("d_mas") ? [{ label: "Más gasto deseado", monthly: n("d_mas")! }] : [], reductions: n("d_menos") ? [{ label: "Gasto que dejarías", monthly: n("d_menos")! }] : [] };
  const confMap: Record<string, "exacto" | "aprox" | "no_se"> = {}; const grp = (label: string, keys: string[]) => { const present = keys.filter((k) => a[k] !== undefined); if (present.length) confMap[label] = present.some((k) => conf[k] === "aprox") ? "aprox" : "exacto"; };
  grp("gastos", ["f_gasto_total", ...QUESTIONS.filter((q) => q.id.startsWith("e_") || q.id.startsWith("v_")).map((q) => q.id)]); grp("ingresos", ["i_neto_total", "i_salario", "i_retiros", "i_dividendos", "i_rentas", "i_pension", "i_otros"]); grp("liquidez", ["a_liquido"]); grp("horas", ["t_horas_sem"]); grp("deseado", ["d_total", "d_mas"]);
  inputs.confidence = confMap; return inputs;
}
