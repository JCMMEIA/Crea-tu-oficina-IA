import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { Db, newId } from "../db";
import { Actor, AgencyActor, AgencyRole, Role, assertAgencyCan, clientRoleFor } from "./permissions";
import { audit } from "./audit";

export * from "./permissions";
export { audit } from "./audit";

const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const h = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return timingSafeEqual(h, expected);
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(200),
  companyName: z.string().trim().min(1).max(160),
});

async function createUser(t: Db, v: { email: string; name: string; password: string }) {
  const exists = await t.query("SELECT 1 FROM users WHERE email=$1", [v.email]);
  if (exists.length) throw new Error("Ya existe una cuenta con ese correo.");
  const userId = newId();
  await t.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)", [userId, v.email, v.name, hashPassword(v.password)]);
  return userId;
}

const agencySignupSchema = z.object({
  email: signupSchema.shape.email, name: signupSchema.shape.name, password: signupSchema.shape.password,
  agencyName: z.string().trim().min(1).max(120), specialty: z.string().trim().max(200).default(""),
});
/** Registro principal del producto: crea la AGENCIA y a su propietario. */
export async function signupAgency(db: Db, input: unknown): Promise<{ userId: string; agencyId: string }> {
  const v = agencySignupSchema.parse(input);
  const agencyId = newId();
  const userId = await db.tx(async (t) => {
    const uid = await createUser(t, v);
    await t.query("INSERT INTO agencies(id,name,specialty) VALUES($1,$2,$3)", [agencyId, v.agencyName, v.specialty]);
    await t.query("INSERT INTO agency_members(agency_id,user_id,role) VALUES($1,$2,'agency_owner')", [agencyId, uid]);
    return uid;
  });
  await audit(db, { userId }, "agency.signup", agencyId);
  return { userId, agencyId };
}

/** Compatibilidad con el MVP: empresa directa = agencia propia + empresa + ambas membresías. */
export async function signup(db: Db, input: unknown): Promise<{ userId: string; companyId: string }> {
  const v = signupSchema.parse(input);
  const companyId = newId(), agencyId = newId();
  const userId = await db.tx(async (t) => {
    const uid = await createUser(t, v);
    await t.query("INSERT INTO agencies(id,name) VALUES($1,$2)", [agencyId, v.companyName]);
    await t.query("INSERT INTO agency_members(agency_id,user_id,role) VALUES($1,$2,'agency_owner')", [agencyId, uid]);
    await t.query("INSERT INTO companies(id,name,agency_id) VALUES($1,$2,$3)", [companyId, v.companyName, agencyId]);
    await t.query("INSERT INTO memberships(company_id,user_id,role) VALUES($1,$2,'owner')", [companyId, uid]);
    return uid;
  });
  await audit(db, { companyId, userId }, "signup", userId);
  return { userId, companyId };
}

/** Devuelve un token de sesión (se guarda solo su hash). Mensaje igual para correo inexistente o clave mala. */
export async function login(db: Db, emailRaw: string, password: string): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  const fails = await db.query<{ n: string }>(
    `SELECT count(*) n FROM login_attempts WHERE email=$1 AND ok=false AND at > now() - ($2 || ' minutes')::interval`, [email, String(WINDOW_MIN)]);
  if (Number(fails[0].n) >= MAX_FAILS) throw new Error("Demasiados intentos. Espera unos minutos.");
  const rows = await db.query<{ id: string; password_hash: string }>("SELECT id,password_hash FROM users WHERE email=$1", [email]);
  const ok = rows.length ? verifyPassword(password, rows[0].password_hash)
    : (verifyPassword(password, "scrypt$00$00"), false); // trabajo equivalente
  await db.query("INSERT INTO login_attempts(email,ok) VALUES($1,$2)", [email, ok]);
  if (!ok) throw new Error("Correo o contraseña incorrectos.");
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2, now() + ($3 || ' days')::interval)", [sha(token), rows[0].id, String(SESSION_DAYS)]);
  return token;
}

export async function logout(db: Db, token: string) { await db.query("DELETE FROM sessions WHERE token_hash=$1", [sha(token)]); }

async function sessionUser(db: Db, token: string | undefined) {
  if (!token) return null;
  const r = await db.query<{ user_id: string; email: string }>(
    "SELECT s.user_id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()", [sha(token)]);
  return r[0] ? { userId: r[0].user_id, email: r[0].email } : null;
}

/** Actor a nivel agencia (o null). */
export async function agencyActorFromToken(db: Db, token: string | undefined): Promise<AgencyActor | null> {
  const u = await sessionUser(db, token);
  if (!u) return null;
  const r = await db.query<{ agency_id: string; role: AgencyRole }>("SELECT agency_id, role FROM agency_members WHERE user_id=$1 ORDER BY agency_id LIMIT 1", [u.userId]);
  return r[0] ? { ...u, agencyId: r[0].agency_id, agencyRole: r[0].role } : null;
}

/**
 * Puente ÚNICO agencia → empresa cliente. Verifica en el backend que la empresa pertenece a la agencia
 * del actor; si no, responde "no encontrada" (sin revelar existencia).
 */
export async function actAs(db: Db, a: AgencyActor, companyId: string): Promise<Actor> {
  assertAgencyCan(a, "agency:read");
  const r = await db.query("SELECT 1 FROM companies WHERE id=$1 AND agency_id=$2", [companyId, a.agencyId]);
  if (!r.length) throw new Error("Empresa no encontrada.");
  return { userId: a.userId, email: a.email, companyId, agencyId: a.agencyId, role: clientRoleFor(a.agencyRole) };
}

/** Resuelve la sesión a un Actor de EMPRESA: por membresía directa o, con companyId, por pertenencia a su agencia. */
export async function actorFromToken(db: Db, token: string | undefined, companyId?: string): Promise<Actor | null> {
  const u = await sessionUser(db, token);
  if (!u) return null;
  const direct = await db.query<{ company_id: string; role: Role; agency_id: string }>(
    `SELECT m.company_id, m.role, c.agency_id FROM memberships m JOIN companies c ON c.id=m.company_id
      WHERE m.user_id=$1 AND ($2::text IS NULL OR m.company_id=$2) ORDER BY m.company_id LIMIT 1`, [u.userId, companyId ?? null]);
  if (direct[0]) return { ...u, companyId: direct[0].company_id, role: direct[0].role, agencyId: direct[0].agency_id };
  if (!companyId) return null;
  const ag = await agencyActorFromToken(db, token);
  if (!ag) return null;
  try { return await actAs(db, ag, companyId); } catch { return null; }
}
