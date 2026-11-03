import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, Db } from "@/server/db";
import { actorFromToken, Actor } from "@/server/auth";

export const COOKIE = "cto_session";

export async function currentActor(): Promise<{ db: Db; actor: Actor | null }> {
  const db = await getDb();
  const token = (await cookies()).get(COOKIE)?.value;
  return { db, actor: await actorFromToken(db, token) };
}
export async function requireActor(): Promise<{ db: Db; actor: Actor }> {
  const r = await currentActor();
  if (!r.actor) redirect("/login");
  return { db: r.db, actor: r.actor };
}
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}
export const money = (n: number) => `US$ ${Number(n).toFixed(4)}`;
export const when = (d: unknown) => (d ? new Date(d as any).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—");
export const STATUS_LABEL: Record<string, [string, string]> = {
  requested: ["Solicitado", ""], in_progress: ["En progreso", "warn"], completed: ["Completado", "ok"],
  failed: ["Fallido", "bad"], awaiting_approval: ["Esperando autorización", "warn"], rejected: ["Rechazado", "bad"],
};
