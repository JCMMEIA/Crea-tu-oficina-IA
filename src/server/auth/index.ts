import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { Db, newId } from "../db";
import { Actor, Role } from "./permissions";
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

export async function signup(db: Db, input: unknown): Promise<{ userId: string; companyId: string }> {
  const v = signupSchema.parse(input);
  const exists = await db.query("SELECT 1 FROM users WHERE email=$1", [v.email]);
  if (exists.length) throw new Error("Ya existe una cuenta con ese correo.");
  const userId = newId(), companyId = newId();
  await db.tx(async (t) => {
    await t.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)", [userId, v.email, v.name, hashPassword(v.password)]);
    await t.query("INSERT INTO companies(id,name) VALUES($1,$2)", [companyId, v.companyName]);
    await t.query("INSERT INTO memberships(company_id,user_id,role) VALUES($1,$2,'owner')", [companyId, userId]);
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

/** Resuelve la sesión a un Actor. companyId opcional si el usuario pertenece a varias. */
export async function actorFromToken(db: Db, token: string | undefined, companyId?: string): Promise<Actor | null> {
  if (!token) return null;
  const rows = await db.query<{ user_id: string; email: string; company_id: string; role: Role }>(
    `SELECT s.user_id, u.email, m.company_id, m.role FROM sessions s
       JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id
      WHERE s.token_hash=$1 AND s.expires_at > now() AND ($2::text IS NULL OR m.company_id=$2)
      ORDER BY m.company_id LIMIT 1`, [sha(token), companyId ?? null]);
  if (!rows.length) return null;
  return { userId: rows[0].user_id, companyId: rows[0].company_id, role: rows[0].role, email: rows[0].email };
}
