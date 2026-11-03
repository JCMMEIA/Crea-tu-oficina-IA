import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";
import { BeginnerAnswers, BEGINNER_QUESTIONS, SkillSpec, skillSpecSchema } from "./spec";
import { EmployeeTemplate } from "../catalog/data";

export * from "./spec";

export function defaultSkill(t: EmployeeTemplate): SkillSpec {
  const tools = t.connections.map((c) => c.toolkit);
  return skillSpecSchema.parse({
    systemPrompt: `Eres ${t.name}. ${t.mission}\nTrabajas únicamente con la información que te dan la empresa, el conocimiento autorizado y los resultados de las herramientas.\nNunca inventes datos, cifras ni resultados. Si falta información, dilo y pide lo necesario.\nNunca afirmes que ejecutaste una acción si no hay evidencia de la herramienta correspondiente.`,
    procedures: t.responsibilities,
    authorizedTools: tools,
    knowledgeSources: [],
    outputFormat: `Entrega: ${t.deliverables.join("; ")}. Separa hechos verificados, hipótesis y pendientes.`,
    goals: t.deliverables,
    metrics: [],
    actionConditions: ["Toda acción que modifique datos externos requiere aprobación del propietario."],
    collaborationRules: ["Solo delegas tareas a otros empleados mediante el sistema de tareas, con contexto y evidencia."],
    autonomy: { requireApprovalForWrites: true, maxTaskSeconds: 120 },
  });
}

/** Modo principiante: convierte respuestas en instrucciones estructuradas (determinista, sin llamar a IA). */
export function beginnerToSpec(base: SkillSpec, a: BeginnerAnswers): SkillSpec {
  const v = (k: keyof BeginnerAnswers) => (a[k] ?? "").trim();
  const ctx = [
    v("sells") && `La empresa vende: ${v("sells")}.`,
    v("idealClient") && `Cliente ideal: ${v("idealClient")}.`,
    v("difference") && `Lo que nos diferencia: ${v("difference")}.`,
    v("competitors") && `Competidores: ${v("competitors")}.`,
    v("tone") && `Tono de comunicación: ${v("tone")}.`,
  ].filter(Boolean).join("\n");
  const never = v("never").split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  return skillSpecSchema.parse({
    ...base,
    systemPrompt: `${base.systemPrompt.split("\n\n## Contexto del negocio")[0]}${ctx ? `\n\n## Contexto del negocio\n${ctx}` : ""}${never.length ? `\n\n## Prohibiciones\n${never.map((n) => `- Nunca: ${n}`).join("\n")}` : ""}`,
    goals: v("expected") ? [v("expected"), ...base.goals.filter((g) => g !== v("expected"))].slice(0, 20) : base.goals,
    knowledgeSources: v("consult") ? v("consult").split(/\n|,|;/).map((s) => s.trim()).filter(Boolean).slice(0, 30) : base.knowledgeSources,
  });
}

export function diffSpecs(a: SkillSpec, b: SkillSpec): { field: string; before: unknown; after: unknown }[] {
  return (Object.keys(b) as (keyof SkillSpec)[])
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ field: k, before: a[k], after: b[k] }));
}

async function ownEmployee(db: Db, actor: Actor, employeeId: string) {
  const r = await db.query("SELECT id,current_skill_version FROM employees WHERE id=$1 AND company_id=$2", [employeeId, actor.companyId]);
  if (!r.length) throw new Error("Empleado no encontrado.");
  return r[0];
}

export async function getCurrentSkill(db: Db, actor: Actor, employeeId: string): Promise<{ version: number; spec: SkillSpec }> {
  assertCan(actor, "read");
  const e = await ownEmployee(db, actor, employeeId);
  const r = await db.query("SELECT spec FROM skill_versions WHERE employee_id=$1 AND company_id=$2 AND version=$3", [employeeId, actor.companyId, e.current_skill_version]);
  return { version: e.current_skill_version, spec: skillSpecSchema.parse(r[0].spec) };
}

export async function listVersions(db: Db, actor: Actor, employeeId: string) {
  assertCan(actor, "read");
  await ownEmployee(db, actor, employeeId);
  return db.query("SELECT version,note,author,created_at FROM skill_versions WHERE employee_id=$1 AND company_id=$2 ORDER BY version DESC", [employeeId, actor.companyId]);
}

export async function getVersion(db: Db, actor: Actor, employeeId: string, version: number): Promise<SkillSpec> {
  assertCan(actor, "read");
  await ownEmployee(db, actor, employeeId);
  const r = await db.query("SELECT spec FROM skill_versions WHERE employee_id=$1 AND company_id=$2 AND version=$3", [employeeId, actor.companyId, version]);
  if (!r.length) throw new Error("Versión no encontrada.");
  return skillSpecSchema.parse(r[0].spec);
}

export async function saveSkillVersion(db: Db, actor: Actor, employeeId: string, specInput: unknown, note = ""): Promise<number> {
  assertCan(actor, "skills:edit");
  const spec = skillSpecSchema.parse(specInput);
  await ownEmployee(db, actor, employeeId);
  const version = await db.tx(async (t) => {
    const m = await t.query<{ v: number }>("SELECT coalesce(max(version),0)+1 v FROM skill_versions WHERE employee_id=$1", [employeeId]);
    const v = Number(m[0].v);
    await t.query("INSERT INTO skill_versions(id,company_id,employee_id,version,spec,note,author) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [newId(), actor.companyId, employeeId, v, JSON.stringify(spec), note, actor.email]);
    await t.query("UPDATE employees SET current_skill_version=$1 WHERE id=$2 AND company_id=$3", [v, employeeId, actor.companyId]);
    return v;
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "skill.save", employeeId, { version, note });
  return version;
}

/** Restaurar = crear una versión nueva copiando una anterior (el historial nunca se reescribe). */
export async function restoreVersion(db: Db, actor: Actor, employeeId: string, version: number): Promise<number> {
  const spec = await getVersion(db, actor, employeeId, version);
  return saveSkillVersion(db, actor, employeeId, spec, `Restaurada desde la versión ${version}`);
}

export async function exportSkill(db: Db, actor: Actor, employeeId: string): Promise<string> {
  const cur = await getCurrentSkill(db, actor, employeeId);
  return JSON.stringify({ format: "crea-tu-oficina-ia/skill@1", spec: cur.spec }, null, 2);
}

export async function importSkill(db: Db, actor: Actor, employeeId: string, json: string): Promise<number> {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch { throw new Error("El archivo no es un JSON válido."); }
  if (parsed?.format !== "crea-tu-oficina-ia/skill@1") throw new Error("Formato de skill no reconocido.");
  return saveSkillVersion(db, actor, employeeId, parsed.spec, "Importada desde archivo");
}

export { BEGINNER_QUESTIONS };
