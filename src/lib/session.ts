import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, Db } from "@/server/db";
import { actorFromToken, agencyActorFromToken, sessionUser, Actor, AgencyActor } from "@/server/auth";

export const COOKIE = "cto_session";
export const COMPANY_COOKIE = "cto_company";

export async function currentActor(): Promise<{ db: Db; actor: Actor | null; agency: AgencyActor | null }> {
  const db = await getDb();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const agency = await agencyActorFromToken(db, token);
  // La empresa elegida viene en una cookie, pero SIEMPRE se revalida en backend (membresía directa o pertenencia a la agencia).
  const actor = await actorFromToken(db, token, jar.get(COMPANY_COOKIE)?.value) ?? (jar.get(COMPANY_COOKIE) ? await actorFromToken(db, token) : null);
  return { db, actor, agency };
}
export async function requireActor(): Promise<{ db: Db; actor: Actor; agency: AgencyActor | null }> {
  const r = await currentActor();
  if (!r.actor) redirect(r.agency ? "/agencia" : "/login");
  return { db: r.db, actor: r.actor, agency: r.agency };
}
export async function requireAgency(): Promise<{ db: Db; agency: AgencyActor }> {
  const r = await currentActor();
  if (!r.agency) redirect(r.actor ? "/oficina" : "/login");
  return { db: r.db, agency: r.agency };
}
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}
export const money = (n: number) => (Number(n) > 0 && Number(n) < 0.01 ? "menos de US$ 0.01" : `US$ ${Number(n).toFixed(2)}`);
export const when = (d: unknown) => (d ? new Date(d as any).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—");
export const STATUS_LABEL: Record<string, [string, string]> = {
  requested: ["Solicitado", ""], in_progress: ["En progreso", "warn"], completed: ["Completado", "ok"],
  failed: ["Fallido", "bad"], awaiting_approval: ["Esperando autorización", "warn"], rejected: ["Rechazado", "bad"],
};

/** Usuario autenticado (agencia o cliente), sin necesidad de empresa activa. */
export async function requireUser() {
  const db = await getDb();
  const token = (await cookies()).get(COOKIE)?.value;
  const user = await sessionUser(db, token);
  if (!user) redirect("/login");
  return { db, user, agency: await agencyActorFromToken(db, token) };
}
