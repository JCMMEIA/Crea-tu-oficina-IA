import { Db } from "../db";
import { deriveSource } from "../leads";

/** Eventos que el NAVEGADOR puede reportar (anónimos). Las compras/cancelaciones NUNCA se aceptan desde afuera: salen de licencias reales. */
export const PUBLIC_EVENTS = ["visita", "cta_click", "plan_visto"] as const;
const PATH = /^\/[a-z0-9\-_/]{0,80}$/i;
export async function trackPublic(db: Db, input: { name?: unknown; path?: unknown; utm?: Record<string, string | undefined>; referrer?: unknown; cta?: unknown }): Promise<boolean> {
  const name = String(input.name ?? ""); const path = String(input.path ?? "");
  if (!(PUBLIC_EVENTS as readonly string[]).includes(name) || !PATH.test(path)) return false;
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM events WHERE created_at > now() - interval '1 hour'"))[0].n);
  if (n >= 20_000) return false; // tope global contra inundación
  const cta = typeof input.cta === "string" ? input.cta.slice(0, 40) : "";
  await db.query("INSERT INTO events(name,path,source,props) VALUES($1,$2,$3,$4)", [name, path, deriveSource(input.utm ?? {}, String(input.referrer ?? "")), JSON.stringify(cta ? { cta } : {})]);
  return true;
}
