import { z } from "zod";
import { Db, newId, Row } from "../db";
import { actAs, Actor, AgencyActor, assertAgencyCan, audit, AuthorizationError, hashPassword } from "../auth";
import { planOf } from "./plans";
import { getTemplate } from "../catalog/data";
import { defaultSkill, skillSpecSchema } from "../skills";
import { getIndustry } from "./industries";
import { costUsd } from "../usage";
import { pricingFromEnv } from "../models";

const who = (a: AgencyActor) => ({ userId: a.userId, companyId: null as string | null });
const aud = (db: Db, a: AgencyActor, action: string, target?: string, detail: Record<string, unknown> = {}) =>
  audit(db, { userId: a.userId }, action, target, { agencyId: a.agencyId, ...detail });

// ---------- Agencia e identidad ----------
export async function getAgency(db: Db, a: AgencyActor): Promise<Row> {
  assertAgencyCan(a, "agency:read");
  const r = (await db.query("SELECT id,name,specialty,brand,plan,business_type,monthly_budget_usd::float budget FROM agencies WHERE id=$1", [a.agencyId]))[0];
  return { ...r, planInfo: planOf(r.plan) };
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa #RRGGBB).");
const logo = z.string().max(220_000).refine((v) => /^https:\/\/[^\s"'<>]+$/.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), "El logo debe ser una URL https o una imagen PNG/JPG/WEBP.");
const brandSchema = z.object({
  name: z.string().trim().min(1).max(120), specialty: z.string().trim().max(200).default(""),
  tagline: z.string().trim().max(160).default(""), primaryColor: hex.default("#4f46e5"), logo: logo.nullable().default(null), style: z.enum(["moderno", "calido", "fresco"]).default("moderno"),
});
export async function updateBrand(db: Db, a: AgencyActor, input: unknown) {
  assertAgencyCan(a, "agency:brand");
  const v = brandSchema.parse(input);
  await db.query("UPDATE agencies SET name=$2, specialty=$3, brand=$4 WHERE id=$1", [a.agencyId, v.name, v.specialty, JSON.stringify({ tagline: v.tagline, primaryColor: v.primaryColor, logo: v.logo, style: v.style })]);
  await aud(db, a, "agency.brand", a.agencyId);
}

// ---------- Clientes ----------
const clientSchema = z.object({ name: z.string().trim().min(1).max(160), industry: z.string().trim().max(80).default(""), profile: z.record(z.string(), z.string().max(2000)).default({}), monthlyBudgetUsd: z.number().min(0).max(100000).default(10) });
export async function createClient(db: Db, a: AgencyActor, input: unknown): Promise<string> {
  assertAgencyCan(a, "agency:clients");
  const v = clientSchema.parse(input);
  const ag = (await db.query("SELECT plan FROM agencies WHERE id=$1", [a.agencyId]))[0];
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM companies WHERE agency_id=$1 AND is_demo=false", [a.agencyId]))[0].n);
  if (n >= planOf(ag.plan).maxClients) throw new Error(`Tu plan ${planOf(ag.plan).label} permite hasta ${planOf(ag.plan).maxClients} clientes.`);
  const id = newId();
  await db.query("INSERT INTO companies(id,name,agency_id,industry,profile,monthly_budget_usd) VALUES($1,$2,$3,$4,$5,$6)", [id, v.name, a.agencyId, v.industry, JSON.stringify(v.profile), v.monthlyBudgetUsd]);
  await aud(db, a, "client.create", id, { name: v.name });
  return id;
}
export async function listClients(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  return db.query(`SELECT c.id,c.name,c.industry,c.is_demo,c.monthly_budget_usd::float budget,c.created_at,
    (SELECT count(*)::int FROM employees e WHERE e.company_id=c.id) employees,
    (SELECT count(*)::int FROM tasks t WHERE t.company_id=c.id) tasks,
    (SELECT count(*)::int FROM approvals ap WHERE ap.company_id=c.id AND ap.status='pending') pending_approvals,
    (SELECT coalesce(sum(u.cost_usd),0)::float FROM usage_events u WHERE u.company_id=c.id AND u.created_at >= date_trunc('month', now())) month_cost
    FROM companies c WHERE c.agency_id=$1 ORDER BY c.created_at DESC`, [a.agencyId]);
}
export async function setClientLimits(db: Db, a: AgencyActor, companyId: string, l: { monthlyBudgetUsd?: number; maxRunsPerHour?: number }) {
  assertAgencyCan(a, "agency:clients");
  await actAs(db, a, companyId);
  await db.query("UPDATE companies SET monthly_budget_usd=coalesce($3,monthly_budget_usd), max_runs_per_hour=coalesce($4,max_runs_per_hour) WHERE id=$1 AND agency_id=$2", [companyId, a.agencyId, l.monthlyBudgetUsd ?? null, l.maxRunsPerHour ?? null]);
  await aud(db, a, "client.limits", companyId, l);
}
/** Crea un usuario de la empresa cliente (acceso restringido a SU empresa). La contraseña inicial la elige la agencia y debe cambiarse. */
export async function addClientUser(db: Db, a: AgencyActor, companyId: string, input: { email: string; name: string; password: string; role: "owner" | "admin" | "member" | "viewer" }) {
  assertAgencyCan(a, "agency:clients");
  await actAs(db, a, companyId);
  const v = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(1).max(120), password: z.string().min(10).max(200), role: z.enum(["owner", "admin", "member", "viewer"]) }).parse(input);
  const existing = await db.query("SELECT id FROM users WHERE email=$1", [v.email]);
  let uid: string;
  if (existing.length) uid = existing[0].id; else { uid = newId(); await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)", [uid, v.email, v.name, hashPassword(v.password)]); }
  await db.query("INSERT INTO memberships(company_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT (company_id,user_id) DO UPDATE SET role=$3", [companyId, uid, v.role]);
  await aud(db, a, "client.user_add", companyId, { email: v.email, role: v.role });
}

// ---------- Skills reutilizables de la agencia ----------
export async function saveAgencySkill(db: Db, a: AgencyActor, templateKey: string, specInput: unknown, note = "") {
  assertAgencyCan(a, "agency:catalog");
  if (!getTemplate(templateKey)) throw new Error("Plantilla desconocida.");
  const spec = skillSpecSchema.parse(specInput);
  await db.query(`INSERT INTO agency_skill_templates(agency_id,template_key,spec,note) VALUES($1,$2,$3,$4)
    ON CONFLICT (agency_id,template_key) DO UPDATE SET spec=$3, note=$4, updated_at=now()`, [a.agencyId, templateKey, JSON.stringify(spec), note]);
  await aud(db, a, "agency.skill", templateKey);
}
export async function getAgencySkill(db: Db, a: AgencyActor, templateKey: string) {
  assertAgencyCan(a, "agency:read");
  const tpl = getTemplate(templateKey); if (!tpl) throw new Error("Plantilla desconocida.");
  const r = (await db.query("SELECT spec FROM agency_skill_templates WHERE agency_id=$1 AND template_key=$2", [a.agencyId, templateKey]))[0];
  return { custom: !!r, spec: skillSpecSchema.parse(r?.spec ?? defaultSkill(tpl)) };
}
/** Skill con la que se contrata a un empleado en una empresa: la de la agencia si existe, si no la de plataforma. */
export async function skillForHire(db: Db, companyId: string, templateKey: string) {
  const r = (await db.query("SELECT s.spec FROM agency_skill_templates s JOIN companies c ON c.agency_id=s.agency_id WHERE c.id=$1 AND s.template_key=$2", [companyId, templateKey]))[0];
  return r ? skillSpecSchema.parse(r.spec) : null;
}

// ---------- Catálogo comercial ----------
const serviceSchema = z.object({
  name: z.string().trim().min(1).max(160), description: z.string().trim().max(2000).default(""), industry: z.string().max(80).default(""),
  templateKeys: z.array(z.string()).min(1).max(12), priceUsd: z.number().min(0).max(1_000_000), priceUnit: z.enum(["mes", "proyecto"]).default("mes"),
  estTasksPerMonth: z.number().int().min(1).max(5000).default(20),
});
export async function createService(db: Db, a: AgencyActor, input: unknown): Promise<string> {
  assertAgencyCan(a, "agency:catalog");
  const v = serviceSchema.parse(input);
  for (const k of v.templateKeys) if (!getTemplate(k)) throw new Error(`Plantilla desconocida: ${k}`);
  const id = newId();
  await db.query("INSERT INTO agency_services(id,agency_id,name,description,industry,template_keys,price_usd,price_unit,est_tasks_per_month) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id, a.agencyId, v.name, v.description, v.industry, JSON.stringify(v.templateKeys), v.priceUsd, v.priceUnit, v.estTasksPerMonth]);
  await aud(db, a, "service.create", id);
  return id;
}
export async function updateService(db: Db, a: AgencyActor, id: string, patch: { priceUsd?: number; status?: "borrador" | "publicado"; name?: string; description?: string }) {
  assertAgencyCan(a, "agency:catalog");
  const r = await db.query("UPDATE agency_services SET price_usd=coalesce($3,price_usd), status=coalesce($4,status), name=coalesce($5,name), description=coalesce($6,description) WHERE id=$1 AND agency_id=$2 RETURNING id",
    [id, a.agencyId, patch.priceUsd ?? null, patch.status ?? null, patch.name ?? null, patch.description ?? null]);
  if (!r.length) throw new Error("Servicio no encontrado.");
  await aud(db, a, "service.update", id, patch);
}
export async function listServices(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  return db.query(`SELECT s.*, s.price_usd::float price, (SELECT count(*)::int FROM client_services cs WHERE cs.service_id=s.id) deployments FROM agency_services s WHERE s.agency_id=$1 ORDER BY s.created_at DESC`, [a.agencyId]);
}
export async function applyIndustryTemplate(db: Db, a: AgencyActor, industryKey: string): Promise<string[]> {
  assertAgencyCan(a, "agency:catalog");
  const ind = getIndustry(industryKey); if (!ind) throw new Error("Industria desconocida.");
  const ids: string[] = [];
  for (const s of ind.services) ids.push(await createService(db, a, { name: s.name, description: s.description, industry: ind.key, templateKeys: s.templateKeys, priceUsd: s.suggestedPriceUsd, priceUnit: s.unit, estTasksPerMonth: s.tasksPerMonth }));
  return ids;
}

/** Estimación de costo de IA de un servicio: tareas/mes × tokens supuestos × tarifa configurada. SIEMPRE una estimación. */
export const ASSUMED_TOKENS = { input: 4000, output: 1200 };
export function estimateServiceCost(estTasksPerMonth: number, price?: { inUsd: number; outUsd: number } | null) {
  const p = price === undefined ? pricingFromEnv() : price;
  if (!p) return null;
  return { monthlyUsd: estTasksPerMonth * costUsd(p, ASSUMED_TOKENS.input, ASSUMED_TOKENS.output), assumptions: `${estTasksPerMonth} tareas/mes × ${ASSUMED_TOKENS.input} tokens de entrada y ${ASSUMED_TOKENS.output} de salida` };
}

// ---------- Despliegue en un cliente ----------
export async function deployService(db: Db, a: AgencyActor, serviceId: string, companyId: string, hire: (actor: Actor, templateKey: string) => Promise<string>): Promise<string[]> {
  assertAgencyCan(a, "agency:clients");
  const actor = await actAs(db, a, companyId);
  const s = (await db.query("SELECT template_keys FROM agency_services WHERE id=$1 AND agency_id=$2", [serviceId, a.agencyId]))[0];
  if (!s) throw new Error("Servicio no encontrado.");
  const dup = await db.query("SELECT 1 FROM client_services WHERE company_id=$1 AND service_id=$2", [companyId, serviceId]);
  if (dup.length) throw new Error("Este servicio ya está desplegado en ese cliente.");
  const ids: string[] = [];
  for (const k of s.template_keys as string[]) ids.push(await hire(actor, k));
  await db.query("INSERT INTO client_services(id,agency_id,company_id,service_id,employee_ids) VALUES($1,$2,$3,$4,$5)", [newId(), a.agencyId, companyId, serviceId, JSON.stringify(ids)]);
  await aud(db, a, "service.deploy", serviceId, { companyId, employees: ids });
  return ids;
}

// ---------- Propuestas ----------
const proposalSchema = z.object({ companyId: z.string().nullable().default(null), clientName: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(200), notes: z.string().max(4000).default(""),
  items: z.array(z.object({ serviceId: z.string(), quantity: z.number().int().min(1).max(100).default(1), priceUsd: z.number().min(0).max(1_000_000).optional() })).min(1).max(30) });
export async function createProposal(db: Db, a: AgencyActor, input: unknown): Promise<string> {
  assertAgencyCan(a, "agency:proposals");
  const v = proposalSchema.parse(input);
  if (v.companyId) await actAs(db, a, v.companyId);
  const items: Row[] = []; let total = 0;
  for (const it of v.items) {
    const s = (await db.query("SELECT id,name,description,price_usd::float price, price_unit FROM agency_services WHERE id=$1 AND agency_id=$2", [it.serviceId, a.agencyId]))[0];
    if (!s) throw new Error("Servicio no encontrado.");
    const price = it.priceUsd ?? s.price;
    items.push({ serviceId: s.id, name: s.name, description: s.description, unit: s.price_unit, quantity: it.quantity, priceUsd: price });
    total += price * it.quantity;
  }
  const id = newId();
  await db.query("INSERT INTO proposals(id,agency_id,company_id,client_name,title,items,notes,total_usd) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [id, a.agencyId, v.companyId, v.clientName, v.title, JSON.stringify(items), v.notes, total]);
  await aud(db, a, "proposal.create", id);
  return id;
}
export async function listProposals(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  return db.query("SELECT id,client_name,title,total_usd::float total,status,created_at FROM proposals WHERE agency_id=$1 ORDER BY created_at DESC", [a.agencyId]);
}
export async function setProposalStatus(db: Db, a: AgencyActor, id: string, status: "borrador" | "enviada" | "aceptada" | "rechazada") {
  assertAgencyCan(a, "agency:proposals");
  const r = await db.query("UPDATE proposals SET status=$3 WHERE id=$1 AND agency_id=$2 RETURNING id", [id, a.agencyId, status]);
  if (!r.length) throw new Error("Propuesta no encontrada.");
}
/** Texto de la propuesta para copiar/imprimir. NO se envía a nadie. */
export async function renderProposal(db: Db, a: AgencyActor, id: string): Promise<string> {
  assertAgencyCan(a, "agency:read");
  const p = (await db.query("SELECT * FROM proposals WHERE id=$1 AND agency_id=$2", [id, a.agencyId]))[0];
  if (!p) throw new Error("Propuesta no encontrada.");
  const ag = await getAgency(db, a);
  const lines = (p.items as Row[]).map((i) => `- ${i.name} × ${i.quantity}: US$ ${Number(i.priceUsd * i.quantity).toFixed(2)} (${i.unit})\n  ${i.description}`).join("\n");
  return `# ${p.title}\n${ag.name}${ag.brand?.tagline ? ` — ${ag.brand.tagline}` : ""}\nPreparada para: ${p.client_name}\n\n## Servicios\n${lines}\n\n**Total estimado: US$ ${Number(p.total_usd).toFixed(2)}**\n\n${p.notes ? `## Notas\n${p.notes}\n\n` : ""}_Esta propuesta no incluye resultados garantizados. Las integraciones con aplicaciones del cliente se activan solo tras su autorización y verificación._\n`;
}

// ---------- Métricas y soporte ----------
export async function agencyMetrics(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  const clients = await listClients(db, a);
  const services = await db.query(`SELECT s.id,s.name,s.price_usd::float price,s.est_tasks_per_month,
    (SELECT count(*)::int FROM client_services cs WHERE cs.service_id=s.id) deployments
    FROM agency_services s WHERE s.agency_id=$1 ORDER BY deployments DESC`, [a.agencyId]);
  const spend = Number((await db.query<{ s: string }>("SELECT coalesce(sum(u.cost_usd),0) s FROM usage_events u JOIN companies c ON c.id=u.company_id WHERE c.agency_id=$1 AND u.created_at >= date_trunc('month', now())", [a.agencyId]))[0].s);
  const ag = await getAgency(db, a);
  const status = await db.query<{ status: string; n: number }>("SELECT t.status, count(*)::int n FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=$1 GROUP BY t.status", [a.agencyId]);
  return { clients, services, spend, budget: ag.budget, tasksByStatus: Object.fromEntries(status.map((s) => [s.status, s.n])), pendingApprovals: clients.reduce((n: number, c: Row) => n + c.pending_approvals, 0) };
}
/** Panel de soporte: aprobaciones pendientes y tareas fallidas de TODOS los clientes de la agencia (y solo de ella). */
export async function supportQueue(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  const approvals = await db.query("SELECT ap.id,ap.summary,ap.created_at,c.id company_id,c.name company_name FROM approvals ap JOIN companies c ON c.id=ap.company_id WHERE c.agency_id=$1 AND ap.status='pending' ORDER BY ap.created_at", [a.agencyId]);
  const failed = await db.query("SELECT t.id,t.title,t.error,t.created_at,c.id company_id,c.name company_name FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=$1 AND t.status='failed' ORDER BY t.created_at DESC LIMIT 30", [a.agencyId]);
  return { approvals, failed };
}
export { AuthorizationError };
