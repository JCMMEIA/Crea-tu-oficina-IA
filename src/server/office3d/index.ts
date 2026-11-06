import { Db } from "../db";
import { Actor, AgencyActor, actAs, assertAgencyCan, assertCan } from "../auth";
import { EMPLOYEES, getTemplate } from "../catalog/data";
import { getToolkit } from "../connectors/catalog";
import { buildScene, InZone } from "./layout";
import { OfficeScene, SceneBrand } from "./types";
import { workingEmployeeIds } from "../tasks/working";

const hexOk = (c: unknown) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#4f46e5");
const styleOf = (b: Record<string, any> | null) => (typeof b?.style === "string" ? b.style : "moderno");
const brandOf = (name: string, b: Record<string, any> | null): SceneBrand => ({
  name, color: hexOk(b?.primaryColor), tagline: typeof b?.tagline === "string" ? b.tagline : "",
  logo: typeof b?.logo === "string" && (b.logo.startsWith("data:image/") || b.logo.startsWith("https://")) ? b.logo : null,
});

/** Escena de la oficina de UNA empresa cliente (datos reales, filtrados por empresa del actor). */
export async function companyScene(db: Db, actor: Actor): Promise<OfficeScene> {
  assertCan(actor, "read");
  const c = (await db.query("SELECT c.name, a.name agency_name, a.brand FROM companies c JOIN agencies a ON a.id=c.agency_id WHERE c.id=$1", [actor.companyId]))[0];
  const deps = await db.query("SELECT id,key,name,custom FROM departments WHERE company_id=$1", [actor.companyId]);
  const emps = await db.query("SELECT id,department_id,template_key,name,role_title,status,current_skill_version FROM employees WHERE company_id=$1 ORDER BY created_at", [actor.companyId]);
  const working = await workingEmployeeIds(db, actor.companyId);
  const connected = new Set((await db.query("SELECT toolkit FROM connections WHERE company_id=$1 AND status='conectado'", [actor.companyId])).map((r) => r.toolkit as string));
  const svc = await db.query("SELECT s.name, s.template_keys FROM client_services cs JOIN agency_services s ON s.id=cs.service_id WHERE cs.company_id=$1", [actor.companyId]);
  const autos = await db.query("SELECT id,name,enabled FROM automations WHERE company_id=$1 ORDER BY created_at", [actor.companyId]);
  const zones: InZone[] = deps.map((d) => {
    const mine = emps.filter((e) => e.department_id === d.id);
    const keys = new Set(EMPLOYEES.filter((t) => t.department === d.key).map((t) => t.key));
    return {
      id: d.id, key: d.key, kind: "department", name: d.name, custom: d.custom,
      services: svc.filter((s) => (s.template_keys as string[]).some((k) => keys.has(k) || mine.some((e) => e.template_key === k))).map((s) => s.name as string),
      employees: mine.map((e) => {
        const t = e.template_key ? getTemplate(e.template_key) : undefined;
        return { id: e.id, name: e.name, roleTitle: e.role_title, status: e.status, skillName: t?.skillName ?? "Skill personalizada", skillVersion: e.current_skill_version, working: working.has(e.id),
          missingConnections: (t?.connections ?? []).filter((x) => x.required && !connected.has(x.toolkit)).map((x) => getToolkit(x.toolkit)?.label ?? x.toolkit) };
      }),
    };
  });
  // Zona de automatizaciones: solo si existen (nodos reales, no empleados).
  if (autos.length) zones.push({ id: "automatizaciones", key: "automatizaciones", kind: "automation", name: "Tareas automáticas", services: [], extraNotes: autos.map((a) => `${a.name}${a.enabled ? "" : " (pausada)"}`),
    employees: autos.map((a) => ({ id: a.id, name: a.name, roleTitle: "Automatización", status: a.enabled ? "active" : "paused", skillName: "Regla programada", skillVersion: 1, missingConnections: [] })) });
  return buildScene({ kind: "company", title: c.name, subtitle: `Oficina de IA · ${c.agency_name}`, brand: brandOf(c.agency_name, c.brand), zones, themeKey: styleOf(c.brand) });
}

/** Escena de la agencia: cada módulo es un cliente propio (nunca de otra agencia) con sus empleados reales. */
export async function agencyScene(db: Db, a: AgencyActor): Promise<OfficeScene> {
  assertAgencyCan(a, "agency:read");
  const ag = (await db.query("SELECT name, specialty, brand FROM agencies WHERE id=$1", [a.agencyId]))[0];
  const clients = await db.query("SELECT id,name FROM companies WHERE agency_id=$1 ORDER BY created_at", [a.agencyId]);
  const emps = await db.query("SELECT e.id,e.company_id,e.template_key,e.name,e.role_title,e.status,e.current_skill_version FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 ORDER BY e.created_at", [a.agencyId]);
  const attn = await db.query(`SELECT c.id, (SELECT count(*) FROM approvals ap WHERE ap.company_id=c.id AND ap.status='pending') + (SELECT count(*) FROM tasks t WHERE t.company_id=c.id AND t.status='failed') n FROM companies c WHERE c.agency_id=$1`, [a.agencyId]);
  const zones: InZone[] = clients.map((c) => ({
    id: c.id, key: "client", kind: "client", name: c.name, companyId: c.id, services: [], attention: Number(attn.find((x) => x.id === c.id)?.n ?? 0), href: `/oficina-3d`,
    employees: emps.filter((e) => e.company_id === c.id).map((e) => ({ id: e.id, name: e.name, roleTitle: e.role_title, status: e.status, skillName: (e.template_key && getTemplate(e.template_key)?.skillName) || "Skill personalizada", skillVersion: e.current_skill_version, missingConnections: [] })),
  }));
  return buildScene({ kind: "agency", title: ag.name, subtitle: ag.specialty || "Agencia de IA", brand: brandOf(ag.name, ag.brand), zones, themeKey: styleOf(ag.brand) });
}

/** Escena de un cliente visto por su agencia (pasa por el puente actAs: otra agencia ⇒ «no encontrada»). */
export async function clientSceneForAgency(db: Db, a: AgencyActor, companyId: string): Promise<OfficeScene> {
  return companyScene(db, await actAs(db, a, companyId));
}
