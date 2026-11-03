import { Db } from "../db";
import { SkillSpec, skillSpecSchema } from "../skills/spec";

export async function getSkillForRun(db: Db, companyId: string, employeeId: string) {
  const e = (await db.query("SELECT name,permissions,max_output_tokens,current_skill_version FROM employees WHERE id=$1 AND company_id=$2", [employeeId, companyId]))[0];
  if (!e) throw new Error("Empleado no encontrado.");
  const s = (await db.query("SELECT spec FROM skill_versions WHERE employee_id=$1 AND version=$2", [employeeId, e.current_skill_version]))[0];
  return { employeeName: e.name as string, permissions: (e.permissions ?? {}) as Record<string, "none" | "read" | "write">, maxOutputTokens: e.max_output_tokens as number, version: e.current_skill_version as number, skill: skillSpecSchema.parse(s.spec) as SkillSpec };
}
