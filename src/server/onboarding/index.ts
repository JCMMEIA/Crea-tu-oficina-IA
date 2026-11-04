import { z } from "zod";
import { Db, newId } from "../db";
import { actAs, AgencyActor, assertAgencyCan, audit } from "../auth";
import { createService, getAgency, updateBrand } from "../agency";
import { hireFromTemplate } from "../catalog/office";
import { getTemplate } from "../catalog/data";
import { getIndustry } from "../agency/industries";
import { SERVICE_CARDS, getCard } from "../guide/services";
import { practiceExample, practiceInstruction, DEMO_LABEL } from "../guide/practice";
import { createTask, runWorkflow } from "../tasks";
import { ConnectorAdapter } from "../connectors";
import { ModelProvider } from "../models";

/** «Vamos a crear tu negocio»: 6 pasos. Cada paso hace algo REAL en la base; la oficina de práctica es un cliente de demostración. */
export const STEPS = ["Tu negocio", "Qué ofreces", "Tus empleados", "Tu marca", "Tu oficina", "Primera prueba"] as const;
export interface Onboarding { done: boolean; services: string[]; demoCompanyId?: string; step: number }
const MAX_DEMO_EMPLOYEES = 12;

export async function getOnboarding(db: Db, a: AgencyActor): Promise<Onboarding> {
  assertAgencyCan(a, "agency:read");
  const r = (await db.query("SELECT onboarding FROM agencies WHERE id=$1", [a.agencyId]))[0]?.onboarding ?? {};
  return { done: !!r.done, services: Array.isArray(r.services) ? r.services : [], demoCompanyId: r.demoCompanyId, step: Number(r.step) || 1 };
}
async function patch(db: Db, a: AgencyActor, p: Partial<Onboarding>) {
  await db.query("UPDATE agencies SET onboarding = onboarding || $2::jsonb WHERE id=$1", [a.agencyId, JSON.stringify(p)]);
}
export async function setStep(db: Db, a: AgencyActor, step: number) { assertAgencyCan(a, "agency:read"); await patch(db, a, { step: Math.min(6, Math.max(1, step)) }); }
export async function finish(db: Db, a: AgencyActor) { assertAgencyCan(a, "agency:read"); await patch(db, a, { done: true }); await audit(db, { userId: a.userId }, "onboarding.done", a.agencyId); }

/** Paso 1: nombre (se puede cambiar después). */
export async function saveBusinessType(db: Db, a: AgencyActor, type: string) {
  assertAgencyCan(a, "agency:brand");
  const t = getIndustry(type) ? type : ""; await db.query("UPDATE agencies SET business_type=$2 WHERE id=$1", [a.agencyId, t]);
}
export async function saveName(db: Db, a: AgencyActor, name: string) {
  assertAgencyCan(a, "agency:brand");
  const n = z.string().trim().min(1, "Escribe un nombre para tu negocio.").max(120).parse(name);
  const ag = await getAgency(db, a); const b = ag.brand ?? {};
  await updateBrand(db, a, { name: n, specialty: ag.specialty, tagline: b.tagline ?? "", primaryColor: b.primaryColor ?? "#4f46e5", logo: b.logo ?? null, style: b.style ?? "moderno" });
  await setStep(db, a, 2);
}

/** La oficina de práctica: un cliente de demostración que NO cuenta para los límites del plan. Idempotente. */
export async function ensureDemoOffice(db: Db, a: AgencyActor): Promise<string> {
  assertAgencyCan(a, "agency:clients");
  const ex = (await db.query("SELECT id FROM companies WHERE agency_id=$1 AND is_demo=true LIMIT 1", [a.agencyId]))[0];
  if (ex) return ex.id;
  const id = newId();
  await db.query("INSERT INTO companies(id,name,agency_id,industry,is_demo,monthly_budget_usd) VALUES($1,'Oficina de práctica',$2,'práctica',true,2)", [id, a.agencyId]);
  await patch(db, a, { demoCompanyId: id });
  await audit(db, { userId: a.userId }, "onboarding.demo_office", id);
  return id;
}

/** Paso 2: guarda lo que ofrecerá y crea esos servicios en su catálogo (sin duplicar). */
export async function chooseServices(db: Db, a: AgencyActor, ids: string[]): Promise<string[]> {
  assertAgencyCan(a, "agency:catalog");
  const valid = [...new Set(ids)].filter((i) => getCard(i));
  if (!valid.length) throw new Error("Elige al menos una cosa que quieras ofrecer.");
  const have = new Set((await db.query("SELECT name FROM agency_services WHERE agency_id=$1", [a.agencyId])).map((r) => r.name as string));
  for (const id of valid) { const c = getCard(id)!; if (!have.has(c.title)) await createService(db, a, { name: c.title, description: c.plain, templateKeys: c.employees, priceUsd: c.suggestedPriceUsd, priceUnit: "mes", estTasksPerMonth: 20 }); }
  await patch(db, a, { services: valid, step: 3 });
  return valid;
}

/** Paso 3 (y «Agregar empleado»): contrata en la oficina de práctica solo los que faltan. */
export async function hireInDemo(db: Db, a: AgencyActor, keys: string[]): Promise<string[]> {
  assertAgencyCan(a, "agency:clients");
  const company = await ensureDemoOffice(db, a); const actor = await actAs(db, a, company);
  const have = (await db.query("SELECT template_key FROM employees WHERE company_id=$1", [company])).map((r) => r.template_key as string);
  const total = have.length; const out: string[] = [];
  for (const k of [...new Set(keys)]) {
    if (!getTemplate(k) || have.includes(k)) continue;
    if (total + out.length >= MAX_DEMO_EMPLOYEES) throw new Error(`La oficina de práctica admite hasta ${MAX_DEMO_EMPLOYEES} empleados.`);
    out.push(await hireFromTemplate(db, actor, k));
  }
  await patch(db, a, { step: 4 });
  return out;
}

/** Paso 4: nombre, color, estilo y logo (misma validación que «Mi marca»). */
export async function saveIdentity(db: Db, a: AgencyActor, i: { name: string; color: string; style: string; logo: string | null; tagline?: string }) {
  assertAgencyCan(a, "agency:brand");
  const ag = await getAgency(db, a);
  await updateBrand(db, a, { name: i.name, specialty: ag.specialty, tagline: i.tagline ?? ag.brand?.tagline ?? "", primaryColor: i.color, logo: i.logo, style: i.style });
  await setStep(db, a, 5);
}

export type PracticeResult =
  | { kind: "demo"; label: string; negocio: string; pedido: string; entrega: string }
  | { kind: "real"; label: string; negocio: string; pedido: string; taskId: string; status: string; result: string | null; error: string | null };

/**
 * Paso 6. Con inteligencia artificial conectada: tarea REAL con datos inventados (etiquetada). Sin ella: ejemplo ilustrativo
 * claramente rotulado, que NO crea tareas ni se mezcla con el trabajo real.
 */
export async function runPractice(db: Db, a: AgencyActor, employeeId: string, deps: { provider: ModelProvider | null; connector: ConnectorAdapter }): Promise<PracticeResult> {
  assertAgencyCan(a, "agency:clients");
  const company = await ensureDemoOffice(db, a); const actor = await actAs(db, a, company);
  const e = (await db.query("SELECT id,template_key FROM employees WHERE id=$1 AND company_id=$2", [employeeId, company]))[0];
  if (!e) throw new Error("Ese empleado no está en tu oficina de práctica.");
  const ex = practiceExample(e.template_key ?? "");
  if (!deps.provider) return { kind: "demo", label: DEMO_LABEL, negocio: ex.negocio, pedido: ex.pedido, entrega: ex.entrega };
  const taskId = await createTask(db, actor, { employeeId, title: `Práctica: ${ex.pedido}`.slice(0, 80), instruction: practiceInstruction(e.template_key ?? "") }, { createdBy: "práctica" });
  await runWorkflow(db, actor, taskId, { provider: deps.provider, adapter: deps.connector });
  const t = (await db.query("SELECT status,result,error FROM tasks WHERE id=$1", [taskId]))[0];
  return { kind: "real", label: "Resultado real de la inteligencia artificial, con datos inventados de práctica.", negocio: ex.negocio, pedido: ex.pedido, taskId, status: t.status, result: t.result, error: t.error };
}
export { SERVICE_CARDS };
