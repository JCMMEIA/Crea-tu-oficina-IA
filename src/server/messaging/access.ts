import { Db, Row } from "../db";
import { Actor, AgencyActor, AgencyRole, actAs, Role } from "../auth";

export interface AccessibleCompany { id: string; name: string; agencyId: string; agencyName: string; via: "agencia" | "miembro"; role: Role }

/** Empresas a las que el usuario tiene acceso HOY (se recalcula en cada mensaje; nunca se confía en estado guardado). */
export async function accessibleCompanies(db: Db, userId: string): Promise<AccessibleCompany[]> {
  const out = new Map<string, AccessibleCompany>();
  const ag = await db.query("SELECT c.id,c.name,c.agency_id,a.name agency_name,m.role FROM agency_members m JOIN companies c ON c.agency_id=m.agency_id JOIN agencies a ON a.id=c.agency_id WHERE m.user_id=$1", [userId]);
  for (const r of ag) out.set(r.id, { id: r.id, name: r.name, agencyId: r.agency_id, agencyName: r.agency_name, via: "agencia", role: r.role === "agency_owner" ? "owner" : r.role === "agency_admin" ? "admin" : "member" });
  const mem = await db.query("SELECT c.id,c.name,c.agency_id,a.name agency_name,m.role FROM memberships m JOIN companies c ON c.id=m.company_id JOIN agencies a ON a.id=c.agency_id WHERE m.user_id=$1", [userId]);
  for (const r of mem) if (!out.has(r.id)) out.set(r.id, { id: r.id, name: r.name, agencyId: r.agency_id, agencyName: r.agency_name, via: "miembro", role: r.role });
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Actor de empresa para ese usuario, o null si ya no tiene acceso. Reutiliza `actAs` (puente de agencia) o la membresía directa. */
export async function actorFor(db: Db, userId: string, companyId: string): Promise<Actor | null> {
  const u = (await db.query("SELECT email FROM users WHERE id=$1", [userId]))[0]; if (!u) return null;
  const am = (await db.query("SELECT m.agency_id, m.role FROM agency_members m JOIN companies c ON c.agency_id=m.agency_id WHERE m.user_id=$1 AND c.id=$2", [userId, companyId]))[0];
  if (am) { const a: AgencyActor = { userId, email: u.email, agencyId: am.agency_id, agencyRole: am.role as AgencyRole }; try { return await actAs(db, a, companyId); } catch { return null; } }
  const m = (await db.query("SELECT m.role, c.agency_id FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.company_id=$2", [userId, companyId]))[0];
  return m ? { userId, email: u.email, companyId, role: m.role, agencyId: m.agency_id } : null;
}
export type { Row };
