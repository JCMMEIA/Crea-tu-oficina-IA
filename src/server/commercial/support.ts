import { z } from "zod";
import { Db, newId } from "../db";
import { assertOperator, Operator } from "./admin";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(200), subject: z.string().trim().min(3, "Escribe un asunto.").max(140), body: z.string().trim().min(10, "Cuéntanos un poco más (al menos 10 letras).").max(2000) });
/** Pedir ayuda a una persona. Funciona con o sin cuenta. Solo se guarda: nadie recibe aviso automático (no hay correo conectado). */
export async function createSupportRequest(db: Db, input: unknown, who: { agencyId?: string | null; userId?: string | null } = {}, honeypot = ""): Promise<"ok" | "ignored"> {
  if (honeypot) return "ignored";
  const v = schema.parse(input);
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM support_requests WHERE created_at > now() - interval '1 hour'"))[0].n);
  if (n >= 100) throw new Error("Hay demasiadas solicitudes ahora mismo. Inténtalo más tarde.");
  await db.query("INSERT INTO support_requests(id,agency_id,user_id,email,subject,body) VALUES($1,$2,$3,$4,$5,$6)", [newId(), who.agencyId ?? null, who.userId ?? null, v.email, v.subject, v.body]);
  return "ok";
}
export async function listSupport(db: Db, op: Operator | null) { assertOperator(op); return db.query("SELECT id,agency_id,email,subject,body,status,created_at FROM support_requests ORDER BY (status='abierta') DESC, created_at DESC LIMIT 200"); }
export async function resolveSupport(db: Db, op: Operator | null, id: string) { assertOperator(op); await db.query("UPDATE support_requests SET status='resuelta' WHERE id=$1", [id]); }
