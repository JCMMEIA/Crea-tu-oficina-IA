import { z } from "zod";
import { Db, newId } from "../db";
import { audit } from "../auth";
import { assertOperator, Operator } from "./admin";
import { STATUS_KEYS } from "../leads";

export interface LeadFilter { status?: string; kind?: string; due?: boolean; q?: string }
export async function listLeads(db: Db, op: Operator | null, f: LeadFilter = {}) {
  assertOperator(op);
  const w: string[] = [], p: unknown[] = [];
  if (f.status && STATUS_KEYS.includes(f.status)) { p.push(f.status); w.push(`status=$${p.length}`); }
  if (f.kind === "demo" || f.kind === "acceso") { p.push(f.kind); w.push(`kind=$${p.length}`); }
  if (f.due) w.push("next_followup_at IS NOT NULL AND next_followup_at <= now() AND status NOT IN ('ganado','perdido')");
  if (f.q) { p.push("%" + f.q.toLowerCase().slice(0, 80) + "%"); w.push(`(lower(email) LIKE $${p.length} OR lower(name) LIKE $${p.length} OR lower(company) LIKE $${p.length})`); }
  return db.query(`SELECT id,email,name,company,phone,kind,status,interests,preferred_time,source,stage,message,utm,created_at,demo_requested_at,next_followup_at,followup_note
    FROM leads ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY (kind='demo' AND status='nuevo') DESC, created_at DESC LIMIT 300`, p);
}
export async function getLead(db: Db, op: Operator | null, id: string) {
  assertOperator(op);
  const l = (await db.query("SELECT * FROM leads WHERE id=$1", [id]))[0]; if (!l) throw new Error("No encontramos ese prospecto.");
  const notes = await db.query("SELECT id,body,created_at FROM lead_notes WHERE lead_id=$1 ORDER BY created_at DESC", [id]);
  return { ...l, notes };
}
export async function setLeadStatus(db: Db, op: Operator | null, id: string, status: string) {
  assertOperator(op);
  if (!STATUS_KEYS.includes(status)) throw new Error("Estado desconocido.");
  const r = await db.query("UPDATE leads SET status=$2, updated_at=now() WHERE id=$1 RETURNING id", [id, status]);
  if (!r.length) throw new Error("No encontramos ese prospecto.");
  if (status === "ganado" || status === "perdido") await db.query("UPDATE leads SET next_followup_at=NULL WHERE id=$1", [id]);
  await audit(db, { userId: op.userId }, "lead.status", id, { status });
}
export async function setFollowup(db: Db, op: Operator | null, id: string, whenIso: string, note = "") {
  assertOperator(op);
  const d = z.coerce.date().parse(whenIso);
  const r = await db.query("UPDATE leads SET next_followup_at=$2, followup_note=$3, updated_at=now() WHERE id=$1 RETURNING id", [id, d.toISOString(), note.slice(0, 300)]);
  if (!r.length) throw new Error("No encontramos ese prospecto.");
}
export async function clearFollowup(db: Db, op: Operator | null, id: string) { assertOperator(op); await db.query("UPDATE leads SET next_followup_at=NULL, followup_note='' WHERE id=$1", [id]); }
export async function addNote(db: Db, op: Operator | null, id: string, body: string) {
  assertOperator(op);
  const b = z.string().trim().min(1, "Escribe la nota.").max(1000).parse(body);
  if (!(await db.query("SELECT 1 FROM leads WHERE id=$1", [id])).length) throw new Error("No encontramos ese prospecto.");
  await db.query("INSERT INTO lead_notes(id,lead_id,body,author_user_id) VALUES($1,$2,$3,$4)", [newId(), id, b, op.userId]);
}
/** Derecho de cancelación (ARCO): borra al prospecto y sus notas a petición suya. Queda constancia en la auditoría SIN el correo. */
export async function deleteLead(db: Db, op: Operator | null, id: string) {
  assertOperator(op);
  const r = await db.query("DELETE FROM leads WHERE id=$1 RETURNING id", [id]);
  if (!r.length) throw new Error("No encontramos ese prospecto.");
  await audit(db, { userId: op.userId }, "lead.deleted", id);
}
export async function crmSummary(db: Db, op: Operator | null) {
  assertOperator(op);
  const by = await db.query("SELECT status, count(*)::int n FROM leads GROUP BY status");
  const q = async (sql: string) => Number((await db.query<{ n: string }>(sql))[0].n);
  return {
    byStatus: Object.fromEntries(by.map((r) => [r.status, r.n])) as Record<string, number>,
    demosPorAtender: await q("SELECT count(*) n FROM leads WHERE kind='demo' AND status='nuevo'"),
    recordatoriosVencidos: await q("SELECT count(*) n FROM leads WHERE next_followup_at <= now() AND status NOT IN ('ganado','perdido')"),
    total: await q("SELECT count(*) n FROM leads"),
  };
}
