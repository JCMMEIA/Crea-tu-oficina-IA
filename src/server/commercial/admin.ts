import { Db } from "../db";

/** Operadores de la plataforma (José y su equipo): solo los correos de PLATFORM_ADMIN_EMAILS. Sin la variable, NADIE es operador. */
export const platformAdmins = () => (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isPlatformAdmin = (email: string | undefined | null) => !!email && platformAdmins().includes(email.toLowerCase());
export interface Operator { userId: string; email: string }
export function assertOperator(o: Operator | null | undefined): asserts o is Operator {
  if (!o || !isPlatformAdmin(o.email)) throw new Error("No tienes permiso para esta sección.");
}
export async function operatorFromUser(db: Db, user: { id: string; email: string } | null): Promise<Operator | null> {
  void db; return user && isPlatformAdmin(user.email) ? { userId: user.id, email: user.email } : null;
}
