import { z } from "zod";
import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";
import { createTask, DuplicateTaskError, retryTask, runWorkflow } from "../tasks";
import { ConnectorAdapter } from "../connectors";
import { ModelProvider } from "../models";

const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("interval"), everyMinutes: z.number().int().min(15).max(60 * 24 * 30) }),
  z.object({ type: z.literal("event"), event: z.string().min(1).max(80) }),
]);
const condSchema = z.object({ field: z.string(), op: z.enum(["eq", "lt", "gt"]), value: z.union([z.string(), z.number()]) });
const autoSchema = z.object({
  name: z.string().trim().min(1).max(160), trigger: triggerSchema, conditions: z.array(condSchema).max(10).default([]),
  employeeId: z.string(), instruction: z.string().trim().min(1).max(5000),
  maxRunsPerDay: z.number().int().min(1).max(50).default(5), maxRetries: z.number().int().min(0).max(3).default(1),
});

export async function createAutomation(db: Db, actor: Actor, input: unknown, now = new Date()): Promise<string> {
  assertCan(actor, "automations:manage");
  const v = autoSchema.parse(input);
  const emp = await db.query("SELECT 1 FROM employees WHERE id=$1 AND company_id=$2", [v.employeeId, actor.companyId]);
  if (!emp.length) throw new Error("Empleado no encontrado.");
  const id = newId();
  const next = v.trigger.type === "interval" ? new Date(now.getTime() + v.trigger.everyMinutes * 60000) : null;
  await db.query("INSERT INTO automations(id,company_id,name,trigger,conditions,employee_id,instruction,max_runs_per_day,max_retries,next_run_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [id, actor.companyId, v.name, JSON.stringify(v.trigger), JSON.stringify(v.conditions), v.employeeId, v.instruction, v.maxRunsPerDay, v.maxRetries, next]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "automation.create", id);
  return id;
}
export async function setAutomationEnabled(db: Db, actor: Actor, id: string, enabled: boolean) {
  assertCan(actor, "automations:manage");
  await db.query("UPDATE automations SET enabled=$3 WHERE id=$1 AND company_id=$2", [id, actor.companyId, enabled]);
}
export async function listAutomations(db: Db, actor: Actor) {
  assertCan(actor, "read");
  const autos = await db.query("SELECT a.*, e.name employee_name FROM automations a JOIN employees e ON e.id=a.employee_id WHERE a.company_id=$1 ORDER BY a.created_at DESC", [actor.companyId]);
  const runs = await db.query("SELECT automation_id,status,error,attempt,created_at,task_id FROM automation_runs WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200", [actor.companyId]);
  return autos.map((a) => ({ ...a, runs: runs.filter((r) => r.automation_id === a.id).slice(0, 10) }));
}

const check = (c: z.infer<typeof condSchema>, p: Record<string, unknown>) => {
  const x = p[c.field];
  return c.op === "eq" ? x === c.value : c.op === "lt" ? Number(x) < Number(c.value) : Number(x) > Number(c.value);
};

/** Actor con el que corre una automatización: el propietario de la empresa o, si la opera una agencia, el dueño de la agencia. */
async function ownerActor(db: Db, companyId: string): Promise<Actor> {
  const r = (await db.query("SELECT m.user_id, u.email, c.agency_id FROM memberships m JOIN users u ON u.id=m.user_id JOIN companies c ON c.id=m.company_id WHERE m.company_id=$1 AND m.role='owner' LIMIT 1", [companyId]))[0];
  if (r) return { userId: r.user_id, email: `automatización (${r.email})`, companyId, role: "owner", agencyId: r.agency_id };
  const g = (await db.query("SELECT m.user_id, u.email, c.agency_id FROM agency_members m JOIN companies c ON c.agency_id=m.agency_id JOIN users u ON u.id=m.user_id WHERE c.id=$1 AND m.role='agency_owner' LIMIT 1", [companyId]))[0];
  if (!g) throw new Error("La empresa no tiene un propietario que autorice esta automatización.");
  return { userId: g.user_id, email: `automatización (${g.email})`, companyId, role: "owner", agencyId: g.agency_id };
}

interface Deps { provider: ModelProvider | null; adapter?: ConnectorAdapter; retryDelayMs?: number }

async function execute(db: Db, a: any, payload: Record<string, unknown>, deps: Deps) {
  const log = (status: string, taskId: string | null, attempt = 1, error: string | null = null) =>
    db.query("INSERT INTO automation_runs(id,company_id,automation_id,status,task_id,attempt,error) VALUES($1,$2,$3,$4,$5,$6,$7)", [newId(), a.company_id, a.id, status, taskId, attempt, error]);
  const today = await db.query<{ n: string }>("SELECT count(*) n FROM automation_runs WHERE automation_id=$1 AND status IN ('completed','failed','awaiting_approval') AND created_at > now() - interval '1 day'", [a.id]);
  if (Number(today[0].n) >= a.max_runs_per_day) { await log("skipped_limit", null, 1, "Límite diario de ejecuciones alcanzado."); return; }
  const actor = await ownerActor(db, a.company_id);
  let taskId: string;
  try {
    taskId = await createTask(db, actor, { employeeId: a.employee_id, title: `[Auto] ${a.name}`, instruction: a.instruction, context: Object.keys(payload).length ? `Datos del evento: ${JSON.stringify(payload)}` : "" }, { createdBy: `automatización:${a.name}` });
  } catch (e: any) { await log(e instanceof DuplicateTaskError ? "skipped_duplicate" : "failed", null, 1, e.message); return; }
  for (let attempt = 1; attempt <= a.max_retries + 1; attempt++) {
    await runWorkflow(db, actor, taskId, deps); // la tarea Y las que se deleguen (cadena completa)
    const root = (await db.query("SELECT status,error FROM tasks WHERE id=$1", [taskId]))[0];
    if (root.status !== "failed") { await log(root.status, taskId, attempt); return; }
    const err = root.error;
    await log("failed", taskId, attempt, err);
    if (attempt <= a.max_retries) await retryTask(db, actor, taskId);
  }
  // Alerta: tras agotar reintentos, queda un registro auditable visible para el propietario.
  await audit(db, { companyId: a.company_id }, "automation.alert", a.id, { name: a.name, reason: "reintentos agotados" });
}

/** Lo llama un programador externo (cron) cada pocos minutos: `npm run automations:tick`. */
export async function runDueAutomations(db: Db, deps: Deps, now = new Date()) {
  const due = await db.query("SELECT * FROM automations WHERE enabled AND trigger->>'type'='interval' AND next_run_at <= $1", [now]);
  for (const a of due) {
    await db.query("UPDATE automations SET next_run_at=$2 WHERE id=$1", [a.id, new Date(now.getTime() + a.trigger.everyMinutes * 60000)]);
    await execute(db, a, {}, deps);
  }
  return { fired: due.length };
}

export async function fireEvent(db: Db, companyId: string, event: string, payload: Record<string, unknown>, deps: Deps) {
  const autos = await db.query("SELECT * FROM automations WHERE company_id=$1 AND enabled AND trigger->>'type'='event' AND trigger->>'event'=$2", [companyId, event]);
  let fired = 0;
  for (const a of autos) {
    if (!(a.conditions as z.infer<typeof condSchema>[]).every((c) => check(c, payload))) continue;
    fired++; await execute(db, a, payload, deps);
  }
  return { fired };
}
