import { Db } from "../db";
import { AgencyActor } from "../auth";

/** Tareas iniciadas por mensaje: las de la persona y, si es de agencia, las de toda su agencia (solo su alcance). */
export async function listMessagingTasks(db: Db, userId: string, agency: AgencyActor | null, limit = 30) {
  return db.query(`SELECT t.id,t.title,t.status,t.error,t.created_at,ct.channel,c.name company_name,u.email who
    FROM channel_tasks ct JOIN tasks t ON t.id=ct.task_id JOIN companies c ON c.id=ct.company_id JOIN users u ON u.id=ct.user_id
    WHERE ct.user_id=$1 OR ($2::text IS NOT NULL AND c.agency_id=$2) ORDER BY t.created_at DESC LIMIT $3`, [userId, agency?.agencyId ?? null, limit]);
}
