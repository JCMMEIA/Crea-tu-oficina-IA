"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { actAs, audit, login, signupAgency } from "@/server/auth";
import { prepareDemo } from "@/server/commercial/activation";
import { startCheckout } from "@/server/commercial/billing";
import { createSupportRequest } from "@/server/commercial/support";
import { currentActor } from "@/lib/session";
import { COMPANY_COOKIE, requireAgency, setSessionCookie } from "@/lib/session";
import { addClientUser, applyIndustryTemplate, createClient, createProposal, createService, saveAgencySkill, getAgencySkill, setClientLimits, setProposalStatus, updateBrand, updateService } from "@/server/agency";
import { deployServiceToClient } from "@/server/agency/deploy";
import { skillSpecSchema } from "@/server/skills";
import { buildTaughtSkill } from "@/lib/teach";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const back = (path: string, msg: string, kind: "ok" | "bad" = "bad") => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind === "ok" ? "ok" : "error"}=${encodeURIComponent(msg)}`);
async function safe(path: string, fn: () => Promise<string | void>, after?: string) {
  let msg: string | void;
  try { msg = await fn(); } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    return back(path, e?.name === "ZodError" ? "Revisa los datos del formulario." : e?.message ?? "Error inesperado.");
  }
  revalidatePath("/", "layout");
  return msg ? back(after ?? path, msg, "ok") : redirect(after ?? path);
}

/** Ejecuta fn y devuelve su valor; si falla, redirige a `path` con el error (los redirects de Next se propagan). */
async function attempt<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    return back(path, e?.name === "ZodError" ? "Revisa los datos del formulario." : e?.message ?? "Error inesperado.");
  }
}

export async function agencySignupAction(f: FormData) {
  if (process.env.PUBLIC_SIGNUP !== "true") return redirect("/registro");
  const db = await getDb();
  try {
    await signupAgency(db, { email: s(f, "email"), name: s(f, "name"), password: s(f, "password"), agencyName: s(f, "agencyName"), specialty: s(f, "specialty"), source: s(f, "source"), planInterest: s(f, "plan") });
    await setSessionCookie(await login(db, s(f, "email"), s(f, "password")));
  } catch (e: any) { if (e?.digest) throw e; return redirect("/registro?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa los datos (contraseña de al menos 10 caracteres)." : e.message)); }
  redirect("/empezar");
}

export async function enterClientAction(f: FormData) {
  const { db, agency } = await requireAgency();
  try { await actAs(db, agency, s(f, "companyId")); } catch { return back("/agencia/clientes", "Cliente no encontrado."); }
  (await cookies()).set(COMPANY_COOKIE, s(f, "companyId"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  const next = s(f, "next");
  if (next.startsWith("/") && !next.startsWith("//") && !next.includes("://")) redirect(next); // solo rutas internas
  redirect(s(f, "to") === "construir" ? "/agregar-empleado" : s(f, "to") === "oficina3d" ? "/oficina-3d" : "/oficina");
}
export async function leaveClientAction() { (await cookies()).delete(COMPANY_COOKIE); redirect("/agencia/clientes"); }

export async function brandAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/identidad", async () => {
    let logo: string | null = s(f, "logoUrl") || s(f, "currentLogo") || null;
    const file = f.get("logoFile");
    if (file instanceof File && file.size > 0) {
      if (file.size > 150_000) throw new Error("El logo pesa más de 150 KB.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
      logo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    if (s(f, "removeLogo") === "on") logo = null;
    const swatch = s(f, "swatch"); const custom = s(f, "primaryColor"); const colorChosen = /^#[0-9a-fA-F]{6}$/.test(swatch) && custom.toLowerCase() === (s(f, "currentColor") || custom).toLowerCase() ? swatch : custom;
    await updateBrand(db, agency, { name: s(f, "name"), specialty: s(f, "specialty"), tagline: s(f, "tagline"), primaryColor: colorChosen, logo, style: s(f, "style") || "moderno" });
    return "Tu marca quedó guardada.";
  });
}
export async function clientCreateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  const id = await attempt("/agencia/clientes", () => createClient(db, agency, { name: s(f, "name"), industry: s(f, "industry"), monthlyBudgetUsd: Number(s(f, "budget")) || 10, profile: { sector: s(f, "industry"), goals: s(f, "goals") } }));
  revalidatePath("/", "layout"); redirect(`/agencia/clientes/${id}`);
}
export async function clientLimitsAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { await setClientLimits(db, agency, id, { monthlyBudgetUsd: Number(s(f, "budget")), maxRunsPerHour: Number(s(f, "perHour")) || undefined }); return "Listo: guardamos el presupuesto."; });
}
export async function clientUserAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { await addClientUser(db, agency, id, { email: s(f, "email"), name: s(f, "name"), password: s(f, "password"), role: s(f, "role") as any }); return "Listo: esa persona ya puede entrar. Pásale la contraseña por un medio seguro y pídele que la cambie."; });
}
export async function deployAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { const e = await deployServiceToClient(db, agency, s(f, "serviceId"), id); return `Listo: ${e.length} empleado(s) agregado(s) a la oficina del cliente.`; });
}
export async function serviceCreateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => {
    await createService(db, agency, { name: s(f, "name"), description: s(f, "description"), templateKeys: f.getAll("templateKeys").map(String), priceUsd: Number(s(f, "price")), priceUnit: s(f, "unit") || "mes", estTasksPerMonth: Number(s(f, "tasks")) || 20 }); return "Listo: creaste el servicio.";
  });
}
export async function serviceUpdateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => { await updateService(db, agency, s(f, "id"), { priceUsd: f.get("price") ? Number(s(f, "price")) : undefined, status: (s(f, "status") || undefined) as any }); return "Listo: guardamos el cambio."; });
}
export async function industryAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => `Listo: agregamos ${(await applyIndustryTemplate(db, agency, s(f, "industry"))).length} servicios de ejemplo. Cambia los precios antes de ofrecerlos.`);
}
export async function agencySkillAction(f: FormData) {
  const { db, agency } = await requireAgency(); const k = s(f, "key");
  await safe(`/agencia/skills?plantilla=${k}`, async () => {
    const cur = (await getAgencySkill(db, agency, k)).spec; const lines = (x: string) => s(f, x).split("\n").map((l) => l.trim()).filter(Boolean);
    await saveAgencySkill(db, agency, k, skillSpecSchema.parse({ ...cur, systemPrompt: s(f, "systemPrompt"), procedures: lines("procedures"), outputFormat: s(f, "outputFormat") }), s(f, "note")); return "Guardado. Los clientes nuevos tendrán a este empleado ya enseñado; los actuales no cambian.";
  });
}
export async function proposalCreateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  const items = f.getAll("serviceId").map(String).map((sid) => ({ serviceId: sid, quantity: Number(s(f, `qty_${sid}`)) || 1 }));
  const id = await attempt("/agencia/propuestas", () => createProposal(db, agency, { companyId: s(f, "companyId") || null, clientName: s(f, "clientName"), title: s(f, "title"), notes: s(f, "notes"), items }));
  revalidatePath("/", "layout"); redirect(`/agencia/propuestas/${id}`);
}
export async function proposalStatusAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "id");
  await safe(`/agencia/propuestas/${id}`, async () => { await setProposalStatus(db, agency, id, s(f, "status") as any); return "Listo. Ojo: solo es una nota para ti, no se envió nada a nadie."; });
}

/** «Agregar empleado» desde la agencia: contrata en la oficina elegida (la agencia solo puede elegir las suyas). */
export async function agencyHireAction(f: FormData) {
  const { db, agency } = await requireAgency(); const company = s(f, "companyId"); const back = s(f, "back") || "/agencia/contratar";
  await safe(back, async () => {
    const actor = await actAs(db, agency, company); const keys = f.getAll("empleado").map(String);
    if (!keys.length) throw new Error("Elige al menos un empleado.");
    const { hireFromTemplate } = await import("@/server/catalog/office");
    for (const k of keys) await hireFromTemplate(db, actor, k);
    return keys.length === 1 ? "Empleado agregado a la oficina." : `${keys.length} empleados agregados a la oficina.`;
  });
}
/** «Crear tarea» desde la agencia: crea la tarea en el motor existente y lleva a ver su seguimiento. */
export async function agencyTaskAction(f: FormData) {
  const { db, agency } = await requireAgency(); const [company, employeeId] = s(f, "target").split(":"); let target = "/agencia/tarea";
  try {
    const actor = await actAs(db, agency, company);
    const { createTask, runWorkflow, DuplicateTaskError } = await import("@/server/tasks"); const { getProvider } = await import("@/server/models"); const { getAdapter } = await import("@/server/connectors");
    try {
      const id = await createTask(db, actor, { employeeId, title: s(f, "instruction").slice(0, 80), instruction: s(f, "instruction") });
      (await cookies()).set(COMPANY_COOKIE, company, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      target = `/actividad/${id}`; await runWorkflow(db, actor, id, { provider: getProvider(), adapter: getAdapter() });
    } catch (e: any) { if (e instanceof DuplicateTaskError) { target = `/actividad/${e.existingId}`; } else throw e; }
  } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; return back("/agencia/tarea", e?.name === "ZodError" ? "Escribe qué necesitas que haga." : e?.message ?? "No se pudo crear la tarea."); }
  revalidatePath("/", "layout"); redirect(target);
}

/** El asistente guiado solo PROPONE: esto se ejecuta únicamente cuando la persona pulsa el botón. */
export async function assistantHireAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/asistente", async () => { const { hireInDemo } = await import("@/server/onboarding"); const ids = await hireInDemo(db, agency, f.getAll("empleado").map(String)); return ids.length ? `Listo: ${ids.length} empleado(s) agregado(s) a tu oficina de práctica.` : "Esos empleados ya estaban en tu oficina de práctica."; });
}
/** «Avísame cuando esté»: se registra el interés (real, auditable); no se simula una conexión. */
export async function appInterestAction(f: FormData) {
  const { requireUser } = await import("@/lib/session"); const { db, user } = await requireUser();
  await audit(db, { userId: user.userId }, "app.interest", s(f, "app").slice(0, 40));
  const to = s(f, "back"); const path = to.startsWith("/") && !to.startsWith("//") ? to : "/conexiones";
  return back(path, `Anotado: te avisaremos cuando ${s(f, "title") || "esa aplicación"} esté disponible.`, "ok");
}

/** Enseñar UNA vez: lo que aprende un empleado de la agencia lo sabrán todos los clientes nuevos (los actuales no cambian). */
export async function teachAgencyAction(f: FormData) {
  const { db, agency } = await requireAgency(); const k = s(f, "key");
  await safe(`/agencia/skills?plantilla=${k}`, async () => {
    const cur = (await getAgencySkill(db, agency, k)).spec;
    await saveAgencySkill(db, agency, k, buildTaughtSkill(cur, { quiere: s(f, "quiere"), como: s(f, "como"), sabe: s(f, "sabe"), nunca: s(f, "nunca"), resultado: s(f, "resultado") }), "Lo que le enseñé");
    return "Guardado. Los clientes nuevos tendrán a este empleado ya enseñado; los actuales no cambian.";
  });
}

export async function requestPlanAction(f: FormData) {
  const { db, agency } = await requireAgency();
  try {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const r = await startCheckout(db, agency, s(f, "plan"), { success: `${site}/agencia/plan?ok=${encodeURIComponent("Gracias. Estamos confirmando tu pago; tu plan se activa en unos segundos.")}`, cancel: `${site}/agencia/plan` });
    if (r.mode === "pago") return redirect(r.url);
  } catch (e: any) { if (e?.digest) throw e; return redirect("/agencia/plan?error=" + encodeURIComponent(e.message)); }
  redirect("/agencia/plan?ok=" + encodeURIComponent("Listo, recibimos tu solicitud. No se cobró nada."));
}
export async function supportAction(f: FormData) {
  const { db, actor, agency } = await currentActor();
  try { await createSupportRequest(db, { email: s(f, "email"), subject: s(f, "subject"), body: s(f, "body") }, { agencyId: agency?.agencyId ?? null, userId: agency?.userId ?? actor?.userId ?? null }, s(f, "website")); }
  catch (e: any) { return redirect("/ayuda/tutoriales?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa tu correo, el asunto y el mensaje." : e.message) + "#soporte"); }
  redirect("/ayuda/tutoriales?ok=" + encodeURIComponent("Recibimos tu mensaje. Una persona te responderá por correo.") + "#soporte");
}
export async function prepareDemoAction(f: FormData) {
  const { db, agency } = await requireAgency();
  try { const r = await prepareDemo(db, agency, f.getAll("servicio").map(String)); revalidatePath("/", "layout"); return redirect("/agencia/activacion?ok=" + encodeURIComponent(`Demostración lista: ${r.services} servicio(s) y ${r.hired} empleado(s) nuevos en tu oficina de práctica.`) + "#demo"); }
  catch (e: any) { if (e?.digest) throw e; return redirect("/agencia/activacion?error=" + encodeURIComponent(e.message) + "#demo"); }
}
