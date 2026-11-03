import { z } from "zod";
import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";

const docSchema = z.object({
  title: z.string().trim().min(1).max(200), kind: z.string().trim().max(60).default("documento"),
  content: z.string().min(1).max(200_000), allowedEmployeeIds: z.array(z.string()).nullable().default(null),
});

export async function addDoc(db: Db, actor: Actor, input: unknown): Promise<string> {
  assertCan(actor, "knowledge:manage");
  const v = docSchema.parse(input);
  const id = newId();
  await db.query("INSERT INTO knowledge_docs(id,company_id,title,kind,content,allowed_employee_ids) VALUES($1,$2,$3,$4,$5,$6)",
    [id, actor.companyId, v.title, v.kind, v.content, v.allowedEmployeeIds ? JSON.stringify(v.allowedEmployeeIds) : null]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "knowledge.add", id, { title: v.title });
  return id;
}
export async function updateDoc(db: Db, actor: Actor, id: string, input: unknown) {
  assertCan(actor, "knowledge:manage");
  const v = docSchema.parse(input);
  const r = await db.query("UPDATE knowledge_docs SET title=$3,kind=$4,content=$5,allowed_employee_ids=$6,updated_at=now() WHERE id=$1 AND company_id=$2 RETURNING id",
    [id, actor.companyId, v.title, v.kind, v.content, v.allowedEmployeeIds ? JSON.stringify(v.allowedEmployeeIds) : null]);
  if (!r.length) throw new Error("Documento no encontrado.");
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "knowledge.update", id);
}
export async function deleteDoc(db: Db, actor: Actor, id: string) {
  assertCan(actor, "knowledge:manage");
  await db.query("DELETE FROM knowledge_docs WHERE id=$1 AND company_id=$2", [id, actor.companyId]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "knowledge.delete", id);
}
export async function listDocs(db: Db, actor: Actor) {
  assertCan(actor, "read");
  return db.query("SELECT id,title,kind,allowed_employee_ids,updated_at, length(content)::int size FROM knowledge_docs WHERE company_id=$1 ORDER BY updated_at DESC", [actor.companyId]);
}

const tokens = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2);

/** Recuperación solo entre documentos que este empleado puede ver (null = todos los empleados de la empresa). */
export async function searchForEmployee(db: Db, companyId: string, employeeId: string, query: string, limit = 3) {
  const docs = await db.query("SELECT id,title,content,allowed_employee_ids FROM knowledge_docs WHERE company_id=$1", [companyId]);
  const q = new Set(tokens(query));
  return docs
    .filter((d) => d.allowed_employee_ids === null || (d.allowed_employee_ids as string[]).includes(employeeId))
    .map((d) => {
      const t = tokens(d.title + " " + d.content);
      const score = t.reduce((n, w) => n + (q.has(w) ? 1 : 0), 0) / Math.sqrt(t.length || 1);
      return { id: d.id as string, title: d.title as string, snippet: (d.content as string).slice(0, 1500), score };
    })
    .filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Contenido externo = DATOS, nunca instrucciones. Se delimita y se neutralizan los cierres falsos. */
export function wrapUntrusted(title: string, text: string): string {
  const safe = text.replace(/<\/?documento_no_confiable[^>]*>/gi, "[etiqueta eliminada]");
  return `<documento_no_confiable titulo="${title.replace(/"/g, "'")}">\n${safe}\n</documento_no_confiable>`;
}
