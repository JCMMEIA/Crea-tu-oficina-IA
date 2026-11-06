import type { Db } from "../db";

/** Una tarea «en progreso» sin ninguna señal en este tiempo se considera abandonada (p. ej. se reinició el servidor) y NO deja al empleado «trabajando» para siempre. */
export const WORKING_STALE_MINUTES = 10;

/** Empleados con una tarea realmente en curso. Se deriva de datos existentes (tasks.status + task_events); no requiere campos nuevos. */
export async function workingEmployeeIds(db: Db, companyId: string): Promise<Set<string>> {
  const rows = await db.query(
    `SELECT DISTINCT t.employee_id FROM tasks t
      WHERE t.company_id=$1 AND t.status='in_progress'
        AND COALESCE((SELECT max(e.created_at) FROM task_events e WHERE e.task_id=t.id), t.created_at) > now() - ($2 || ' minutes')::interval`,
    [companyId, String(WORKING_STALE_MINUTES)]);
  return new Set(rows.map((r) => r.employee_id as string));
}
