import type { Db } from "../db";
import { profileOf } from "./profiles";
import { LEVEL_RANK, SENS_RANK, type Level, type Sensitivity } from "./types";

export interface TaskMeta {
  companyId: string | null; employeeId: string | null; taskId: string | null; level: Level; sensitivity: Sensitivity; needsTools: boolean; needsJson: boolean;
  validate?: { sections?: string[]; json?: boolean; minChars?: number }; reasons: string[];
}
const KEYWORDS_C = /\b(an[aá]lisis|estrategi|comparar|compara|diagn[oó]stic|plan trimestral|auditor[ií]a|m[uú]ltiples|varios documentos)\b/i;
const up = (a: Level, b: Level): Level => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);
const topSens = (a: Sensitivity, b: Sensitivity): Sensitivity => (SENS_RANK[a] >= SENS_RANK[b] ? a : b);

/** Clasifica una tarea para el router. Heurísticas explícitas y auditables (se guardan los motivos). El Cerebro Empresarial siempre cuenta como información interna. */
export async function classifyTask(db: Db, task: { id: string; company_id: string; employee_id: string; instruction: string; context?: string; depth?: number }, opts: { toolCount: number; contextChars: number; brainFields: number }): Promise<TaskMeta> {
  const emp = (await db.query("SELECT template_key FROM employees WHERE id=$1 AND company_id=$2", [task.employee_id, task.company_id]))[0];
  const prof = profileOf(emp?.template_key); const reasons: string[] = [`perfil del puesto: ${prof.level}/${prof.sensitivity}`];
  let level: Level = prof.level; let sensitivity: Sensitivity = prof.sensitivity; let validate: TaskMeta["validate"];
  {
    const len = task.instruction.length; if (len < 300 && opts.toolCount === 0 && !KEYWORDS_C.test(task.instruction)) { if (LEVEL_RANK[level] > 1 && prof.quality !== "alta") { level = "A"; reasons.push("instrucción corta y sin herramientas → A"); } }
    if (KEYWORDS_C.test(task.instruction) && len > 400) { level = up(level, "C"); reasons.push("pide análisis/estrategia extensos → C"); }
  }
  if (opts.contextChars > 14_000) { level = up(level, "C"); reasons.push("mucho contexto → C"); }
  if ((task.depth ?? 0) > 0) { level = up(level, "B"); reasons.push("tarea delegada: al menos B"); }
  if (opts.toolCount >= 3) { level = up(level, "B"); reasons.push("varias herramientas → al menos B"); }
  if (opts.brainFields > 0) { sensitivity = topSens(sensitivity, "internal"); reasons.push("incluye el Cerebro Empresarial → interna"); }
  return { companyId: task.company_id, employeeId: task.employee_id, taskId: task.id, level, sensitivity, needsTools: opts.toolCount > 0, needsJson: false, validate, reasons };
}
