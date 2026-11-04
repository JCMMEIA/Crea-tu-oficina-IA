"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { COMPANY_COOKIE, OFFICE_COOKIE, requireUser, setSessionCookie } from "@/lib/session";
import { consumeAccessLink, requestAccess } from "@/server/commerce/access";
import { processEmails } from "@/server/commerce/mail";
import { createOfficeWithRight, isMember, listOffices, openBillingPortal, scheduleOfficeCancel, setOfficeStatus } from "@/server/commerce/offices";
import { createIntent, attachSession, reusableCheckoutUrl, OfficeConfig } from "@/server/commerce/orders";
import { newOfficePlan, purchasesOpen } from "@/server/commerce/gate";
import { getPaymentProvider } from "@/server/commercial/billing";
import { getIndustry } from "@/server/agency/industries";
import { getOnboarding } from "@/server/onboarding";
import { isPlatformAdmin } from "@/server/commercial/admin";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function consumeLinkAction(f: FormData) {
  const db = await getDb(); const r = await consumeAccessLink(db, s(f, "t"));
  if (!r) return redirect("/acceso?error=" + encodeURIComponent("El enlace caducó o ya se usó. Pide uno nuevo."));
  await setSessionCookie(r.session); const jar = await cookies(); jar.delete(COMPANY_COOKIE);
  const offices = await listOffices(db, r.userId);
  if (!offices.length) { const u = (await db.query("SELECT email FROM users WHERE id=$1", [r.userId]))[0]; return redirect(isPlatformAdmin(u?.email) ? "/admin/conversion" : "/"); }
  const newest = offices[offices.length - 1];
  if (r.purpose === "bienvenida" || offices.length === 1) {
    jar.set(OFFICE_COOKIE, newest.id, cookieOpts);
    const ob = await getOnboarding(db, { userId: r.userId, email: "", agencyId: newest.id, agencyRole: "agency_owner" });
    return redirect(ob.done ? "/agencia" : "/empezar");
  }
  redirect("/oficinas");
}
export async function recoverAction(f: FormData) {
  const db = await getDb(); await requestAccess(db, s(f, "email")); after(() => processEmails(db).catch(() => {}));
  redirect("/recuperar?ok=1");
}
/** ENTRAR a una oficina: la cookie es solo una preferencia; se valida que la persona sea miembro. */
export async function selectOfficeAction(f: FormData) {
  const { db, user } = await requireUser(); const id = s(f, "officeId");
  if (!(await isMember(db, user.userId, id))) return redirect("/oficinas?error=" + encodeURIComponent("Oficina no encontrada."));
  const jar = await cookies(); jar.set(OFFICE_COOKIE, id, cookieOpts); jar.delete(COMPANY_COOKIE);
  const ag = await getOnboarding(db, { userId: user.userId, email: user.email, agencyId: id, agencyRole: "agency_owner" }).catch(() => null);
  redirect(ag && !ag.done ? "/empezar" : "/agencia");
}
async function office(f: FormData, fn: (db: any, uid: string, id: string) => Promise<unknown>, okMsg: string) {
  const { db, user } = await requireUser();
  try { await fn(db, user.userId, s(f, "officeId")); } catch (e: any) { if (e?.digest) throw e; return redirect("/oficinas?error=" + encodeURIComponent(e.message)); }
  revalidatePath("/", "layout"); redirect("/oficinas?ok=" + encodeURIComponent(okMsg));
}
export async function pauseOfficeAction(f: FormData) { await office(f, (db, u, id) => setOfficeStatus(db, u, id, "pausada"), "Oficina pausada. Las demás siguen funcionando."); }
export async function resumeOfficeAction(f: FormData) { await office(f, (db, u, id) => setOfficeStatus(db, u, id, "activa"), "Oficina reanudada."); }
export async function cancelOfficeAction(f: FormData) { await office(f, (db, u, id) => scheduleOfficeCancel(db, u, id, true), "Cancelación programada: seguirá funcionando hasta el final del periodo pagado."); }
export async function keepOfficeAction(f: FormData) { await office(f, (db, u, id) => scheduleOfficeCancel(db, u, id, false), "Listo: se mantiene tu suscripción."); }
export async function portalAction(f: FormData) {
  const { db, user } = await requireUser(); const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""); let url = "";
  try { url = await openBillingPortal(db, user.userId, s(f, "officeId"), `${site}/oficinas`); } catch (e: any) { return redirect("/oficinas?error=" + encodeURIComponent(e.message)); }
  redirect(url);
}
const cfgOf = (f: FormData): OfficeConfig => ({ officeName: s(f, "nombre"), businessType: s(f, "negocio"), services: f.getAll("servicio").map(String), employees: f.getAll("empleado").map(String) });
/** NUEVA OFICINA con un derecho ya disponible (sin cobrar otra vez). */
export async function newOfficeWithRightAction(f: FormData) {
  const { db, user } = await requireUser(); let id = "";
  try { id = await createOfficeWithRight(db, { id: user.userId, email: user.email }, cfgOf(f)); } catch (e: any) { return redirect("/oficinas/nueva?paso=4&error=" + encodeURIComponent(e.message)); }
  (await cookies()).set(OFFICE_COOKIE, id, cookieOpts); redirect("/empezar");
}
/** NUEVA OFICINA con pago: guarda lo elegido y manda al pago. La oficina se crea SOLO cuando el webhook confirme el pago. */
export async function newOfficeCheckoutAction(f: FormData) {
  const { db, user } = await requireUser(); const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""); let url = "";
  try {
    if (!(await purchasesOpen(db)).open) throw new Error("Las compras todavía no están abiertas.");
    const p = getPaymentProvider(); if (!p?.createPublicCheckout) throw new Error("El pago no está disponible.");
    const cfg = cfgOf(f); if (cfg.businessType && !getIndustry(cfg.businessType)) throw new Error("Tipo de negocio no válido.");
    const prev = await reusableCheckoutUrl(db, user.userId, cfg);
    if (prev) url = prev; // el mismo pago ya estaba abierto: se reutiliza (no se abre otro)
    else {
      const intentId = await createIntent(db, { plan: newOfficePlan(), kind: "adicional", userId: user.userId, email: user.email, config: cfg, source: "oficina-adicional" });
      const c = await p.createPublicCheckout({ intentId, plan: newOfficePlan(), email: user.email, successUrl: `${site}/oficinas?ok=${encodeURIComponent("Pago recibido: estamos creando tu nueva oficina (unos segundos). Recarga esta página.")}`, cancelUrl: `${site}/oficinas/nueva?paso=4` });
      await attachSession(db, intentId, c.sessionId, c.url); url = c.url;
    }
  } catch (e: any) { if (e?.digest) throw e; return redirect("/oficinas/nueva?paso=4&error=" + encodeURIComponent(e.message)); }
  redirect(url);
}
