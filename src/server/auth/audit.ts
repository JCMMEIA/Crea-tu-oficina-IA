import { Db } from "../db";

/** Registro auditable. Nunca incluyas secretos ni contraseñas en `detail`. */
export async function audit(db: Db, who: { companyId?: string | null; userId?: string | null }, action: string, target?: string, detail: Record<string, unknown> = {}) {
  await db.query("INSERT INTO audit_log(company_id,actor_user_id,action,target,detail) VALUES($1,$2,$3,$4,$5)",
    [who.companyId ?? null, who.userId ?? null, action, target ?? null, JSON.stringify(detail)]);
}
