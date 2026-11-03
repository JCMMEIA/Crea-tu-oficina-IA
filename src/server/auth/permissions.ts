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
export interface Actor { userId: string; companyId: string; role: Role; email: string }

export class AuthorizationError extends Error {
  constructor(msg = "No tienes permiso para esta acción.") { super(msg); this.name = "AuthorizationError"; }
}

export function can(actor: Actor | null | undefined, p: Permission): boolean {
  return !!actor && matrix[actor.role].includes(p);
}
export function assertCan(actor: Actor | null | undefined, p: Permission): asserts actor is Actor {
  if (!can(actor, p)) throw new AuthorizationError();
}
