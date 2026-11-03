"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { actAs, login, signupAgency } from "@/server/auth";
import { COMPANY_COOKIE, requireAgency, setSessionCookie } from "@/lib/session";
import { addClientUser, applyIndustryTemplate, createClient, createProposal, createService, saveAgencySkill, getAgencySkill, setClientLimits, setProposalStatus, updateBrand, updateService } from "@/server/agency";
import { deployServiceToClient } from "@/server/agency/deploy";
import { skillSpecSchema } from "@/server/skills";

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
  const db = await getDb();
  try {
    await signupAgency(db, { email: s(f, "email"), name: s(f, "name"), password: s(f, "password"), agencyName: s(f, "agencyName"), specialty: s(f, "specialty") });
    await setSessionCookie(await login(db, s(f, "email"), s(f, "password")));
  } catch (e: any) { if (e?.digest) throw e; return redirect("/registro?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa los datos (contraseña de al menos 10 caracteres)." : e.message)); }
  redirect("/agencia");
}

export async function enterClientAction(f: FormData) {
  const { db, agency } = await requireAgency();
  try { await actAs(db, agency, s(f, "companyId")); } catch { return back("/agencia/clientes", "Cliente no encontrado."); }
  (await cookies()).set(COMPANY_COOKIE, s(f, "companyId"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(s(f, "to") === "construir" ? "/construir?paso=3" : "/oficina");
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
    await updateBrand(db, agency, { name: s(f, "name"), specialty: s(f, "specialty"), tagline: s(f, "tagline"), primaryColor: s(f, "primaryColor"), logo });
    return "Identidad guardada.";
  });
}
export async function clientCreateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  const id = await attempt("/agencia/clientes", () => createClient(db, agency, { name: s(f, "name"), industry: s(f, "industry"), monthlyBudgetUsd: Number(s(f, "budget")) || 10, profile: { sector: s(f, "industry"), goals: s(f, "goals") } }));
  revalidatePath("/", "layout"); redirect(`/agencia/clientes/${id}`);
}
export async function clientLimitsAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { await setClientLimits(db, agency, id, { monthlyBudgetUsd: Number(s(f, "budget")), maxRunsPerHour: Number(s(f, "perHour")) || undefined }); return "Límites guardados."; });
}
export async function clientUserAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { await addClientUser(db, agency, id, { email: s(f, "email"), name: s(f, "name"), password: s(f, "password"), role: s(f, "role") as any }); return "Usuario del cliente creado. Comparte la contraseña inicial por un canal seguro y pídele que la cambie."; });
}
export async function deployAction(f: FormData) {
  const { db, agency } = await requireAgency(); const id = s(f, "companyId");
  await safe(`/agencia/clientes/${id}`, async () => { const e = await deployServiceToClient(db, agency, s(f, "serviceId"), id); return `Servicio desplegado: ${e.length} empleados de IA contratados en la oficina del cliente.`; });
}
export async function serviceCreateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => {
    await createService(db, agency, { name: s(f, "name"), description: s(f, "description"), templateKeys: f.getAll("templateKeys").map(String), priceUsd: Number(s(f, "price")), priceUnit: s(f, "unit") || "mes", estTasksPerMonth: Number(s(f, "tasks")) || 20 }); return "Servicio creado.";
  });
}
export async function serviceUpdateAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => { await updateService(db, agency, s(f, "id"), { priceUsd: f.get("price") ? Number(s(f, "price")) : undefined, status: (s(f, "status") || undefined) as any }); return "Servicio actualizado."; });
}
export async function industryAction(f: FormData) {
  const { db, agency } = await requireAgency();
  await safe("/agencia/servicios", async () => `Se agregaron ${(await applyIndustryTemplate(db, agency, s(f, "industry"))).length} servicios como borrador. Ajusta los precios antes de publicar.`);
}
export async function agencySkillAction(f: FormData) {
  const { db, agency } = await requireAgency(); const k = s(f, "key");
  await safe(`/agencia/skills?plantilla=${k}`, async () => {
    const cur = (await getAgencySkill(db, agency, k)).spec; const lines = (x: string) => s(f, x).split("\n").map((l) => l.trim()).filter(Boolean);
    await saveAgencySkill(db, agency, k, skillSpecSchema.parse({ ...cur, systemPrompt: s(f, "systemPrompt"), procedures: lines("procedures"), outputFormat: s(f, "outputFormat") }), s(f, "note")); return "Skill de la agencia guardada. Se usará en las próximas contrataciones; los clientes ya creados no cambian.";
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
  await safe(`/agencia/propuestas/${id}`, async () => { await setProposalStatus(db, agency, id, s(f, "status") as any); return "Estado actualizado (no se envió nada a nadie)."; });
}
