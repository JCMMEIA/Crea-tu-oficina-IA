import { z } from "zod";
import { Db, Row, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";
import { DEPARTMENTS, EMPLOYEES, getDepartment, getTemplate } from "./data";
import { defaultSkill } from "../skills";
import { skillForHire } from "../agency";
import { planOf } from "../agency/plans";

export const profileSchema = z.object({
  sector: z.string().max(200).optional(), products: z.string().max(2000).optional(), clients: z.string().max(1000).optional(),
  country: z.string().max(100).optional(), website: z.string().max(300).optional(), social: z.string().max(500).optional(),
  competitors: z.string().max(1000).optional(), goals: z.string().max(2000).optional(), problems: z.string().max(2000).optional(),
  apps: z.string().max(1000).optional(),
}).partial();

export async function updateProfile(db: Db, actor: Actor, input: unknown) {
  assertCan(actor, "company:manage");
  const profile = profileSchema.parse(input);
  await db.query("UPDATE companies SET profile=$1 WHERE id=$2", [JSON.stringify(profile), actor.companyId]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "company.profile", actor.companyId);
}

export async function ensureDepartment(db: Db, actor: Actor, key: string, customName?: string): Promise<string> {
  assertCan(actor, "employees:manage");
  const ex = await db.query<{ id: string }>("SELECT id FROM departments WHERE company_id=$1 AND key=$2", [actor.companyId, key]);
  if (ex.length) return ex[0].id;
  const tpl = getDepartment(key);
  if (!tpl && !customName) throw new Error("Departamento desconocido.");
  const id = newId();
  await db.query("INSERT INTO departments(id,company_id,key,name,custom) VALUES($1,$2,$3,$4,$5)", [id, actor.companyId, key, tpl?.name ?? customName!, !tpl]);
  return id;
}

export async function createCustomDepartment(db: Db, actor: Actor, name: string): Promise<string> {
  const clean = z.string().trim().min(1).max(80).parse(name);
  return ensureDepartment(db, actor, "custom-" + newId().slice(0, 8), clean);
}

/** Límite de empleados según el plan de la agencia dueña de la empresa. */
async function assertEmployeeCapacity(db: Db, companyId: string) {
  const r = (await db.query("SELECT a.plan, (SELECT count(*) FROM employees e JOIN companies c2 ON c2.id=e.company_id WHERE c2.agency_id=a.id) n FROM companies c JOIN agencies a ON a.id=c.agency_id WHERE c.id=$1", [companyId]))[0];
  if (r && Number(r.n) >= planOf(r.plan).maxEmployees) throw new Error(`Tu plan ${planOf(r.plan).label} permite hasta ${planOf(r.plan).maxEmployees} empleados de IA en total.`);
}

/** Contrata copiando la plantilla (inmutable) a la empresa: la edición posterior nunca toca la plantilla. */
export async function hireFromTemplate(db: Db, actor: Actor, templateKey: string, name?: string): Promise<string> {
  assertCan(actor, "employees:manage");
  const tpl = getTemplate(templateKey);
  if (!tpl) throw new Error("Plantilla de empleado desconocida.");
  await assertEmployeeCapacity(db, actor.companyId);
  const depId = await ensureDepartment(db, actor, tpl.department);
  const id = newId();
  const skill = (await skillForHire(db, actor.companyId, tpl.key)) ?? defaultSkill(tpl); // skill de la agencia si existe
  const perms: Record<string, string> = {};
  for (const c of tpl.connections) perms[c.toolkit] = "read"; // solo lectura al inicio
  await db.tx(async (t) => {
    await t.query(`INSERT INTO employees(id,company_id,department_id,template_key,name,role_title,description,permissions)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, actor.companyId, depId, tpl.key, name?.trim() || tpl.name, tpl.name, tpl.mission, JSON.stringify(perms)]);
    await t.query("INSERT INTO skill_versions(id,company_id,employee_id,version,spec,note,author) VALUES($1,$2,$3,1,$4,'Skill inicial de la plantilla',$5)",
      [newId(), actor.companyId, id, JSON.stringify(skill), actor.email]);
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.hire", id, { template: tpl.key });
  return id;
}

export async function createCustomEmployee(db: Db, actor: Actor, input: { departmentId: string; name: string; roleTitle: string; description: string }): Promise<string> {
  assertCan(actor, "employees:manage");
  const v = z.object({ departmentId: z.string(), name: z.string().trim().min(1).max(120), roleTitle: z.string().trim().min(1).max(120), description: z.string().max(1000) }).parse(input);
  const dep = await db.query("SELECT id FROM departments WHERE id=$1 AND company_id=$2", [v.departmentId, actor.companyId]);
  if (!dep.length) throw new Error("Departamento no encontrado.");
  const id = newId();
  await db.tx(async (t) => {
    await t.query("INSERT INTO employees(id,company_id,department_id,name,role_title,description) VALUES($1,$2,$3,$4,$5,$6)", [id, actor.companyId, v.departmentId, v.name, v.roleTitle, v.description]);
    await t.query("INSERT INTO skill_versions(id,company_id,employee_id,version,spec,note,author) VALUES($1,$2,$3,1,$4,'Skill inicial personalizada',$5)",
      [newId(), actor.companyId, id, JSON.stringify(defaultSkill({ key: "custom", department: "", name: v.roleTitle, mission: v.description || `Realiza las funciones de ${v.roleTitle}.`, responsibilities: [], connections: [], deliverables: [], skillName: v.roleTitle })), actor.email]);
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.create_custom", id);
  return id;
}

export async function duplicateEmployee(db: Db, actor: Actor, employeeId: string): Promise<string> {
  assertCan(actor, "employees:manage");
  const e = (await db.query("SELECT * FROM employees WHERE id=$1 AND company_id=$2", [employeeId, actor.companyId]))[0];
  if (!e) throw new Error("Empleado no encontrado.");
  const sv = (await db.query("SELECT spec FROM skill_versions WHERE employee_id=$1 AND version=$2", [employeeId, e.current_skill_version]))[0];
  const id = newId();
  await db.tx(async (t) => {
    await t.query(`INSERT INTO employees(id,company_id,department_id,template_key,name,role_title,description,permissions,max_output_tokens,max_runs_per_day)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, actor.companyId, e.department_id, e.template_key, e.name + " (copia)", e.role_title, e.description, JSON.stringify(e.permissions), e.max_output_tokens, e.max_runs_per_day]);
    await t.query("INSERT INTO skill_versions(id,company_id,employee_id,version,spec,note,author) VALUES($1,$2,$3,1,$4,$5,$6)",
      [newId(), actor.companyId, id, JSON.stringify(sv.spec), `Duplicado de ${e.name}`, actor.email]);
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.duplicate", id, { from: employeeId });
  return id;
}

export async function setEmployeeStatus(db: Db, actor: Actor, employeeId: string, status: "active" | "paused" | "inactive") {
  assertCan(actor, "employees:manage");
  const r = await db.query("UPDATE employees SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING id", [status, employeeId, actor.companyId]);
  if (!r.length) throw new Error("Empleado no encontrado.");
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.status", employeeId, { status });
}

export async function deleteEmployee(db: Db, actor: Actor, employeeId: string) {
  assertCan(actor, "employees:manage");
  const r = await db.query("DELETE FROM employees WHERE id=$1 AND company_id=$2 RETURNING id", [employeeId, actor.companyId]);
  if (!r.length) throw new Error("Empleado no encontrado.");
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.delete", employeeId);
}

const permSchema = z.record(z.string(), z.enum(["none", "read", "write"]));
export async function setPermissions(db: Db, actor: Actor, employeeId: string, perms: unknown, limits?: { maxOutputTokens?: number; maxRunsPerDay?: number }) {
  assertCan(actor, "employees:manage");
  const p = permSchema.parse(perms);
  const r = await db.query("UPDATE employees SET permissions=$1, max_output_tokens=coalesce($4,max_output_tokens), max_runs_per_day=coalesce($5,max_runs_per_day) WHERE id=$2 AND company_id=$3 RETURNING id",
    [JSON.stringify(p), employeeId, actor.companyId, limits?.maxOutputTokens ?? null, limits?.maxRunsPerDay ?? null]);
  if (!r.length) throw new Error("Empleado no encontrado.");
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.permissions", employeeId, { perms: p, limits });
}

export async function listOffice(db: Db, actor: Actor): Promise<Row[]> {
  assertCan(actor, "read");
  const deps = await db.query("SELECT id,key,name,custom FROM departments WHERE company_id=$1 ORDER BY name", [actor.companyId]);
  const emps = await db.query("SELECT id,department_id,template_key,name,role_title,description,status,permissions,max_output_tokens,max_runs_per_day,current_skill_version FROM employees WHERE company_id=$1 ORDER BY created_at", [actor.companyId]);
  return deps.map((d) => ({ ...d, employees: emps.filter((e) => e.department_id === d.id) }));
}

export { DEPARTMENTS, EMPLOYEES };
