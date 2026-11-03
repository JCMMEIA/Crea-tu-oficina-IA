import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Db, newId } from "../db";
import { can } from "../auth";
import { ConnectorAdapter } from "../connectors";
import { decideApproval } from "../tasks";
import { actorFor } from "./access";
import { Identity } from "./link";

/** Acciones que afectan a clientes, dinero o publicación: exigen DOS pasos (APROBAR y luego CONFIRMAR). */
export const HIGH_RISK = new Set(["publish_ad", "update_budget", "send_message", "update_price", "create_discount", "delete"]);
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TOKEN_TTL_MIN = 30, CONFIRM_TTL_MIN = 5, MAX_FAILS = 5;
const pepper = () => process.env.APP_SECRET ?? "solo-desarrollo";
const hashTok = (approvalId: string, identityId: string, code: string) => createHmac("sha256", pepper()).update(`${approvalId}|${identityId}|${code.toUpperCase()}`).digest("hex");
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Código corto, de un solo uso, ligado a UNA acción y a ESTA persona. Solo se guarda su hash. */
export async function issueApprovalToken(db: Db, identity: Identity, approval: { id: string; company_id: string; action: string }, now = new Date()): Promise<string | null> {
  const exists = await db.query("SELECT 1 FROM approval_tokens WHERE approval_id=$1 AND identity_id=$2", [approval.id, identity.id]);
  if (exists.length) return null; // ya se avisó a esta identidad
  const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  await db.query("INSERT INTO approval_tokens(id,approval_id,identity_id,company_id,token_hash,high_risk,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [newId(), approval.id, identity.id, approval.company_id, hashTok(approval.id, identity.id, code), HIGH_RISK.has(approval.action), new Date(now.getTime() + TOKEN_TTL_MIN * 60_000)]);
  return code;
}

export type Verb = "aprobar" | "rechazar" | "confirmar";
const short = (v: unknown) => { const s = JSON.stringify(v ?? {}); return s.length > 300 ? s.slice(0, 297) + "…" : s; };

/** Ejecuta APROBAR / CONFIRMAR / RECHAZAR <código>. Vuelve a comprobar identidad, permisos actuales, vigencia y estado de la acción. */
export async function handleApprovalCommand(db: Db, identity: Identity, verb: Verb, codeRaw: string, connector: ConnectorAdapter, now = new Date()): Promise<string> {
  const fails = Number((await db.query<{ n: string }>("SELECT count(*) n FROM link_attempts WHERE channel='approval' AND external_id=$1 AND ok=false AND at > $2", [identity.id, new Date(now.getTime() - 10 * 60_000)]))[0].n);
  if (fails >= MAX_FAILS) return "Demasiados códigos incorrectos. Espera unos minutos antes de intentarlo de nuevo.";
  const bad = async () => { await db.query("INSERT INTO link_attempts(channel,external_id,ok) VALUES('approval',$1,false)", [identity.id]); return "Ese código no es válido o ya venció. Revisa tus aprobaciones pendientes con «pendientes»."; };
  const cands = await db.query("SELECT t.*, a.status a_status, a.company_id a_company, a.summary, a.args, a.toolkit, a.action FROM approval_tokens t JOIN approvals a ON a.id=t.approval_id WHERE t.identity_id=$1 AND t.used_at IS NULL AND t.expires_at > $2", [identity.id, now]);
  const t = cands.find((c) => eq(c.token_hash, hashTok(c.approval_id, identity.id, codeRaw.trim())));
  if (!t || t.a_status !== "pending" || t.a_company !== t.company_id) return bad();
  const actor = await actorFor(db, identity.user_id, t.company_id);
  if (!actor) return "Ya no tienes acceso a esa empresa. No se ejecutó nada.";
  if (!can(actor, "approvals:decide")) return "Tu rol actual no permite aprobar acciones. No se ejecutó nada.";

  if (verb === "rechazar") {
    await db.query("UPDATE approval_tokens SET used_at=now() WHERE id=$1", [t.id]);
    await decideApproval(db, actor, t.approval_id, false, connector);
    return "Rechazada. No se ejecutó nada.";
  }
  if (t.high_risk && t.stage === 0) {
    if (verb === "confirmar") return "Primero responde APROBAR con el código para ver el detalle.";
    await db.query("UPDATE approval_tokens SET stage=1, expires_at=$2 WHERE id=$1", [t.id, new Date(now.getTime() + CONFIRM_TTL_MIN * 60_000)]);
    return `⚠️ Acción sensible: ${t.summary}\nDatos: ${short(t.args)}\nPara ejecutarla responde exactamente: CONFIRMAR ${codeRaw.toUpperCase()} (vence en ${CONFIRM_TTL_MIN} min). Para cancelar: RECHAZAR ${codeRaw.toUpperCase()}.`;
  }
  if (t.high_risk && verb === "aprobar") return `Esta acción requiere confirmación: responde CONFIRMAR ${codeRaw.toUpperCase()}.`;
  const used = await db.query("UPDATE approval_tokens SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id", [t.id]);
  if (!used.length) return bad(); // ya usado en paralelo
  try {
    const r = await decideApproval(db, actor, t.approval_id, true, connector);
    return r.executed ? `✅ Aprobada y ejecutada: ${t.summary}` : `Aprobada, pero la acción falló: ${r.error ?? "error desconocido"}.`;
  } catch (e: any) { return e.message; }
}
