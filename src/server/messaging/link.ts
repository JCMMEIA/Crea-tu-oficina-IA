import { createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import { Db, newId } from "../db";
import { audit, AgencyActor, assertAgencyCan } from "../auth";
import { Channel } from "./types";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin O, I, L, 0, 1
const TTL_MIN = 10, MAX_FAILS = 5, FAIL_WINDOW_MIN = 15, GLOBAL_FAILS_PER_HOUR = 60;
export const CODE_RE = /\b([A-HJKMNP-Z2-9]{4})-?([A-HJKMNP-Z2-9]{4})\b/i;

function pepper() {
  const s = process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("Falta APP_SECRET.");
  return s ?? "solo-desarrollo";
}
const hashCode = (code: string) => createHmac("sha256", pepper()).update(code.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
export const extractCode = (text: string): string | null => { const m = text.match(CODE_RE); return m ? `${m[1]}-${m[2]}`.toUpperCase() : null; };
/** Quita códigos de vinculación de cualquier texto que se vaya a guardar o registrar. */
export const redactCodes = (text: string) => text.replace(new RegExp(CODE_RE.source, "gi"), "[código]");

export const maskId = (channel: Channel, id: string, name = "") => `${name ? name + " " : ""}(${channel === "whatsapp" ? "+" : "id "}••••${id.slice(-4)})`;

/** Inicia la vinculación desde una sesión autenticada: código temporal, un solo uso. Se muestra UNA vez y solo se guarda su hash. */
export async function createLinkCode(db: Db, userId: string, channel: Channel, consent: boolean): Promise<{ code: string; expiresAt: Date }> {
  if (!consent) throw new Error("Debes aceptar recibir mensajes por este canal para vincularlo.");
  await db.query("UPDATE link_codes SET used_at=now() WHERE user_id=$1 AND channel=$2 AND used_at IS NULL", [userId, channel]); // invalida los anteriores
  const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);
  await db.query("INSERT INTO link_codes(id,user_id,channel,code_hash,expires_at,consent) VALUES($1,$2,$3,$4,$5,true)", [newId(), userId, channel, hashCode(raw), expiresAt]);
  await audit(db, { userId }, "channel.link_code_created", channel); // sin el código
  return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt };
}

export type LinkResult = { ok: true; identityId: string; userId: string } | { ok: false; reason: "locked" | "invalid" | "conflict" | "busy" };

/** El usuario confirma el código DESDE el canal. La identidad verificada es la que firma el proveedor (adaptador). */
export async function confirmLink(db: Db, a: { channel: Channel; externalId: string; display: string; code: string }): Promise<LinkResult> {
  const fails = Number((await db.query<{ n: string }>("SELECT count(*) n FROM link_attempts WHERE channel=$1 AND external_id=$2 AND ok=false AND at > now() - ($3 || ' minutes')::interval", [a.channel, a.externalId, String(FAIL_WINDOW_MIN)]))[0].n);
  if (fails >= MAX_FAILS) return { ok: false, reason: "locked" };
  const globalFails = Number((await db.query<{ n: string }>("SELECT count(*) n FROM link_attempts WHERE ok=false AND at > now() - interval '1 hour'"))[0].n);
  if (globalFails >= GLOBAL_FAILS_PER_HOUR) return { ok: false, reason: "busy" };
  const rec = async (ok: boolean) => { await db.query("INSERT INTO link_attempts(channel,external_id,ok) VALUES($1,$2,$3)", [a.channel, a.externalId, ok]); };
  const row = (await db.query("SELECT id,user_id,consent FROM link_codes WHERE code_hash=$1 AND channel=$2 AND used_at IS NULL AND expires_at > now()", [hashCode(a.code), a.channel]))[0];
  if (!row) { await rec(false); return { ok: false, reason: "invalid" }; }
  const other = (await db.query("SELECT id,user_id FROM channel_identities WHERE channel=$1 AND external_id=$2 AND status='active'", [a.channel, a.externalId]))[0];
  if (other && other.user_id !== row.user_id) { await rec(false); return { ok: false, reason: "conflict" }; } // cuenta del canal ya vinculada a otra persona
  const used = await db.query("UPDATE link_codes SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id", [row.id]);
  if (!used.length) { await rec(false); return { ok: false, reason: "invalid" }; } // carrera: otro lo usó primero
  await rec(true);
  let identityId = other?.id as string | undefined;
  if (!identityId) {
    identityId = newId();
    await db.query("INSERT INTO channel_identities(id,user_id,channel,external_id,display,consent_at,last_inbound_at) VALUES($1,$2,$3,$4,$5,now(),now())", [identityId, row.user_id, a.channel, a.externalId, a.display]);
  }
  await audit(db, { userId: row.user_id }, "channel.linked", identityId, { channel: a.channel, display: a.display });
  return { ok: true, identityId, userId: row.user_id };
}

export interface Identity { id: string; user_id: string; channel: Channel; external_id: string; display: string; status: string; active_company_id: string | null; state: any; prefs: Prefs; consent_at: Date | null; last_inbound_at: Date | null }
export const getActiveIdentity = async (db: Db, channel: Channel, externalId: string): Promise<Identity | undefined> =>
  (await db.query<Identity>("SELECT * FROM channel_identities WHERE channel=$1 AND external_id=$2 AND status='active'", [channel, externalId]))[0];

export async function revokeIdentity(db: Db, identityId: string, by: { userId?: string; reason?: string }) {
  const r = await db.query("UPDATE channel_identities SET status='revoked', revoked_at=now(), revoked_by=$2, state='{}'::jsonb, active_company_id=NULL WHERE id=$1 AND status='active' RETURNING user_id", [identityId, by.userId ?? null]);
  if (!r.length) return false;
  await db.query("DELETE FROM approval_tokens WHERE identity_id=$1", [identityId]);
  await db.query("UPDATE outbox SET status='skipped', last_error='canal revocado' WHERE identity_id=$1 AND status='pending'", [identityId]);
  await audit(db, { userId: by.userId ?? r[0].user_id }, "channel.revoked", identityId, { reason: by.reason ?? "usuario" });
  return true;
}
export async function revokeOwn(db: Db, userId: string, identityId: string) {
  const own = await db.query("SELECT 1 FROM channel_identities WHERE id=$1 AND user_id=$2", [identityId, userId]);
  if (!own.length) throw new Error("Vinculación no encontrada.");
  await revokeIdentity(db, identityId, { userId });
}

export const prefsSchema = z.object({ task_done: z.boolean(), errors: z.boolean(), approvals: z.boolean(), alerts: z.boolean(), digest: z.enum(["off", "daily"]) });
export type Prefs = z.infer<typeof prefsSchema>;
export async function setPrefs(db: Db, userId: string, identityId: string, prefs: unknown) {
  const p = prefsSchema.parse(prefs);
  const r = await db.query("UPDATE channel_identities SET prefs=$3 WHERE id=$1 AND user_id=$2 AND status='active' RETURNING id", [identityId, userId, JSON.stringify(p)]);
  if (!r.length) throw new Error("Vinculación no encontrada.");
}
export async function listOwnIdentities(db: Db, userId: string) {
  return db.query<Identity>("SELECT * FROM channel_identities WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
}

/** Personas de la agencia (miembros y usuarios de sus clientes) con canal vinculado. Solo dentro del alcance de ESTA agencia. */
export async function listAgencyIdentities(db: Db, a: AgencyActor) {
  assertAgencyCan(a, "agency:read");
  return db.query(`SELECT i.id,i.channel,i.display,i.status,i.last_inbound_at,u.email,i.active_company_id
    FROM channel_identities i JOIN users u ON u.id=i.user_id
    WHERE i.user_id IN (SELECT user_id FROM agency_members WHERE agency_id=$1
       UNION SELECT m.user_id FROM memberships m JOIN companies c ON c.id=m.company_id WHERE c.agency_id=$1) ORDER BY i.created_at DESC`, [a.agencyId]);
}
/** Un administrador de agencia puede revocar el canal de su gente, salvo que la persona también pertenezca a otra organización. */
export async function revokeByAgency(db: Db, a: AgencyActor, identityId: string) {
  assertAgencyCan(a, "agency:clients");
  const i = (await db.query("SELECT user_id FROM channel_identities WHERE id=$1", [identityId]))[0];
  if (!i) throw new Error("Vinculación no encontrada.");
  const inScope = (await db.query(`SELECT 1 WHERE $2 IN (SELECT user_id FROM agency_members WHERE agency_id=$1 UNION SELECT m.user_id FROM memberships m JOIN companies c ON c.id=m.company_id WHERE c.agency_id=$1)`, [a.agencyId, i.user_id])).length > 0;
  if (!inScope) throw new Error("Vinculación no encontrada."); // no revela existencia
  const outside = await db.query(`SELECT 1 FROM agency_members WHERE user_id=$2 AND agency_id<>$1 UNION SELECT 1 FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$2 AND c.agency_id<>$1`, [a.agencyId, i.user_id]);
  if (outside.length) throw new Error("Esta persona también pertenece a otra organización: pídele que revoque su propio canal.");
  await revokeIdentity(db, identityId, { userId: a.userId, reason: "agencia" });
}
