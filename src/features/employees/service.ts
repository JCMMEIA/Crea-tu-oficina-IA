import type { Db } from "@/server/db";
import { type Actor, assertCan, audit } from "@/server/auth";
import { cleanName, isSafePhoto } from "./photo";

/** Personaliza SOLO nombre y foto de un empleado de la oficina del actor (aislado por company_id). No toca la ejecución de la IA. */
export async function personalizeEmployee(db: Db, actor: Actor, id: string, input: { name?: string; photo?: string | null; removePhoto?: boolean }) {
  assertCan(actor, "employees:manage");
  const e = (await db.query("SELECT id FROM employees WHERE id=$1 AND company_id=$2", [id, actor.companyId]))[0]; if (!e) throw new Error("Empleado no encontrado.");
  const sets: string[] = []; const p: unknown[] = [];
  if (input.name !== undefined) { p.push(cleanName(input.name)); sets.push(`name=$${p.length}`); }
  if (input.removePhoto) sets.push("photo=NULL"); else if (input.photo) { if (!isSafePhoto(input.photo)) throw new Error("La foto no es válida."); p.push(input.photo); sets.push(`photo=$${p.length}`); }
  if (!sets.length) return;
  p.push(id, actor.companyId);
  await db.query(`UPDATE employees SET ${sets.join(",")} WHERE id=$${p.length - 1} AND company_id=$${p.length}`, p);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "employee.personalize", id, { name: input.name !== undefined, photo: !!input.photo, removePhoto: !!input.removePhoto });
}
