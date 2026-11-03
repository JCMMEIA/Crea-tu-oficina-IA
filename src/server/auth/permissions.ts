export type Role = "owner" | "admin" | "member" | "viewer";
export type Permission =
  | "read" | "tasks:create" | "approvals:decide" | "employees:manage" | "skills:edit"
  | "connections:manage" | "knowledge:manage" | "automations:manage" | "company:manage";

const matrix: Record<Role, Permission[]> = {
  owner: ["read", "tasks:create", "approvals:decide", "employees:manage", "skills:edit", "connections:manage", "knowledge:manage", "automations:manage", "company:manage"],
  admin: ["read", "tasks:create", "approvals:decide", "employees:manage", "skills:edit", "connections:manage", "knowledge:manage", "automations:manage"],
  member: ["read", "tasks:create"],
  viewer: ["read"],
};

/** Quien actúa: siempre pertenece a UNA empresa. Todo servicio privado lo recibe. */
export interface Actor { userId: string; companyId: string; role: Role; email: string; agencyId?: string }

export type AgencyRole = "agency_owner" | "agency_admin" | "agency_member";
export type AgencyPermission = "agency:read" | "agency:clients" | "agency:catalog" | "agency:brand" | "agency:proposals" | "agency:manage";
const agencyMatrix: Record<AgencyRole, AgencyPermission[]> = {
  agency_owner: ["agency:read", "agency:clients", "agency:catalog", "agency:brand", "agency:proposals", "agency:manage"],
  agency_admin: ["agency:read", "agency:clients", "agency:catalog", "agency:brand", "agency:proposals"],
  agency_member: ["agency:read"],
};
/** Quien actúa a nivel agencia. Nunca implica acceso a otra agencia. */
export interface AgencyActor { userId: string; email: string; agencyId: string; agencyRole: AgencyRole }
export const agencyCan = (a: AgencyActor | null | undefined, p: AgencyPermission) => !!a && agencyMatrix[a.agencyRole].includes(p);
export function assertAgencyCan(a: AgencyActor | null | undefined, p: AgencyPermission): asserts a is AgencyActor {
  if (!agencyCan(a, p)) throw new AuthorizationError();
}
/** Rol efectivo dentro de la oficina de un cliente cuando opera la agencia. */
export const clientRoleFor = (r: AgencyRole): Role => (r === "agency_owner" ? "owner" : r === "agency_admin" ? "admin" : "member");

export class AuthorizationError extends Error {
  constructor(msg = "No tienes permiso para esta acción.") { super(msg); this.name = "AuthorizationError"; }
}

export function can(actor: Actor | null | undefined, p: Permission): boolean {
  return !!actor && matrix[actor.role].includes(p);
}
export function assertCan(actor: Actor | null | undefined, p: Permission): asserts actor is Actor {
  if (!can(actor, p)) throw new AuthorizationError();
}
