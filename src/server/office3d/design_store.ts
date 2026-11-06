import { Db } from "../db";
import { AgencyActor, assertAgencyCan, audit } from "../auth";
import { OfficeDesign, sanitizeDesign } from "./design";
import { agencyScene, companyScene } from "./index";
import { OfficeScene } from "./types";

/** Diseño guardado de la oficina del actor. Siempre de SU agencia: el identificador sale de la sesión, nunca de la entrada. */
export async function getOfficeDesign(db: Db, a: AgencyActor): Promise<OfficeDesign> {
  assertAgencyCan(a, "agency:read");
  const r = (await db.query("SELECT office_design FROM agencies WHERE id=$1", [a.agencyId]))[0];
  return sanitizeDesign(r?.office_design);
}

/**
 * Guarda el diseño de ESTA oficina. Solo escribe `agencies.office_design` de la agencia del actor: no toca marca,
 * empleados, departamentos, permisos, tareas, planes, suscripciones ni presupuestos (ni otras oficinas).
 */
export async function saveOfficeDesign(db: Db, a: AgencyActor, input: unknown): Promise<OfficeDesign> {
  assertAgencyCan(a, "agency:brand");
  const v = sanitizeDesign(input);
  await db.query("UPDATE agencies SET office_design=$2::jsonb WHERE id=$1", [a.agencyId, JSON.stringify({ v: 1, ...v })]);
  await audit(db, { userId: a.userId }, "agency.design", a.agencyId);
  return v;
}

/** Escena para la vista previa: la oficina (cliente) con más empleados de ESTA agencia; si no hay ninguna, la vista de la agencia. Solo lectura. */
export async function previewScene(db: Db, a: AgencyActor): Promise<OfficeScene> {
  assertAgencyCan(a, "agency:read");
  const best = (await db.query("SELECT c.id FROM companies c LEFT JOIN employees e ON e.company_id=c.id WHERE c.agency_id=$1 GROUP BY c.id, c.is_demo ORDER BY count(e.id) DESC, c.is_demo DESC, c.id LIMIT 1", [a.agencyId]))[0];
  return best ? companyScene(db, await (await import("../auth")).actAs(db, a, best.id)) : agencyScene(db, a);
}
