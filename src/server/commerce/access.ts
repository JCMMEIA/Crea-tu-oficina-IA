import { createHash, randomBytes } from "node:crypto";
import { Db } from "../db";
import { startSession, createPasswordlessUser } from "../auth";
import { isPlatformAdmin } from "../commercial/admin";
import { queueEmail } from "./mail";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Genera un enlace de acceso (32 bytes aleatorios). Solo se guarda su hash. */
export async function issueAccessLink(db: Db, userId: string, purpose = "acceso", ttlMin = 30): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO access_links(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3, now() + ($4 || ' minutes')::interval)", [sha(token), userId, purpose, String(ttlMin)]);
  return token;
}
/** Canjea el enlace: ATÓMICO y de un solo uso (dos canjes simultáneos → solo uno gana). Devuelve el token de sesión o null. */
export async function consumeAccessLink(db: Db, token: string): Promise<{ session: string; userId: string; purpose: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const r = await db.query("UPDATE access_links SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING user_id, purpose", [sha(token)]);
  if (!r.length) return null;
  const session = await startSession(db, r[0].user_id);
  if (r[0].purpose === "acceso") { // aviso de seguridad: alguien inició sesión con un enlace (una vez cada 30 min; la primera entrada tras comprar no lo genera)
    const u = (await db.query("SELECT email FROM users WHERE id=$1", [r[0].user_id]))[0];
    if (u) await queueEmail(db, { to: u.email, kind: "seguridad", payload: { evento: "inicio_sesion", cuando: new Date().toISOString() }, dedupeKey: `seg:${r[0].user_id}:${Math.floor(Date.now() / 1_800_000)}` });
  }
  return { session, userId: r[0].user_id, purpose: r[0].purpose };
}
/**
 * «Recuperar acceso»: responde SIEMPRE lo mismo (no revela si el correo existe). Solo envía si la cuenta existe; tope 5 por hora y correo.
 * Devuelve si se puso un correo en cola (solo para pruebas; la pantalla no lo muestra).
 */
export async function requestAccess(db: Db, emailRaw: string): Promise<boolean> {
  const email = emailRaw.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return false;
  let u = (await db.query("SELECT id FROM users WHERE email=$1", [email]))[0];
  // Los correos de OPERADOR (PLATFORM_ADMIN_EMAILS, configurados en el servidor) pueden iniciar sesión por enlace aunque aún no tengan cuenta: el enlace solo llega a ese buzón. Nadie más se crea así.
  if (!u && isPlatformAdmin(email)) u = { id: await createPasswordlessUser(db, email, "Operador") } as any;
  if (!u) return false;
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM emails WHERE to_email=$1 AND kind='acceso' AND created_at > now() - interval '1 hour'", [email]))[0].n);
  if (n >= 5) return false;
  return queueEmail(db, { to: email, kind: "acceso", payload: { userId: u.id } });
}
