"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAgency } from "@/lib/session";
import { chooseServices, finish, hireInDemo, runPractice, saveBusinessType, saveIdentity, saveName, setStep, ensureDemoOffice } from "@/server/onboarding";
import { getProvider } from "@/server/models";
import { getAdapter } from "@/server/connectors";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const go = (n: number, extra = "") => redirect(`/empezar?paso=${n}${extra}`);
const stay = (n: number, msg: string) => redirect(`/empezar?paso=${n}&error=${encodeURIComponent(msg)}`);
async function step<T>(n: number, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; return stay(n, e?.name === "ZodError" ? "Revisa lo que escribiste." : e?.message ?? "Algo salió mal."); }
}

export async function nameStep(f: FormData) { const { db, agency } = await requireAgency(); await step(1, async () => { await saveName(db, agency, s(f, "name")); await saveBusinessType(db, agency, s(f, "negocio")); }); revalidatePath("/", "layout"); go(2); }
export async function servicesStep(f: FormData) { const { db, agency } = await requireAgency(); await step(2, () => chooseServices(db, agency, f.getAll("servicio").map(String))); go(3); }
export async function employeesStep(f: FormData) {
  const { db, agency } = await requireAgency();
  await step(3, async () => {
    const keys = f.getAll("empleado").map(String);
    const have = Number((await db.query<{ n: string }>("SELECT count(*) n FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 AND c.is_demo", [agency.agencyId]))[0].n);
    if (!keys.length && !have) throw new Error("Elige al menos un empleado para continuar.");
    await hireInDemo(db, agency, keys);
  });
  revalidatePath("/", "layout"); go(4);
}
export async function identityStep(f: FormData) {
  const { db, agency } = await requireAgency();
  await step(4, async () => {
    let logo: string | null = s(f, "currentLogo") || null;
    const file = f.get("logoFile");
    if (file instanceof File && file.size > 0) {
      if (file.size > 150_000) throw new Error("El logo pesa demasiado (máximo 150 KB). Prueba con una imagen más pequeña.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("El logo debe ser una imagen PNG, JPG o WEBP.");
      logo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    if (s(f, "sinLogo") === "on") logo = null;
    const color = /^#[0-9a-fA-F]{6}$/.test(s(f, "colorCustom")) && s(f, "color") === "custom" ? s(f, "colorCustom") : s(f, "color");
    await saveIdentity(db, agency, { name: s(f, "name"), color, style: s(f, "estilo") || "moderno", logo });
  });
  revalidatePath("/", "layout"); go(5);
}
export async function officeStep() { const { db, agency } = await requireAgency(); await ensureDemoOffice(db, agency); await setStep(db, agency, 6); go(6); }
export async function practiceStep(f: FormData) {
  const { db, agency } = await requireAgency(); const emp = s(f, "empleado");
  if (!emp) return stay(6, "Elige un empleado para probar.");
  const r = await step(6, () => runPractice(db, agency, emp, { provider: getProvider(), connector: getAdapter() }));
  revalidatePath("/", "layout");
  go(6, `&emp=${encodeURIComponent(emp)}${r.kind === "real" ? `&tarea=${r.taskId}` : "&ejemplo=1"}`);
}
export async function finishStep(f: FormData) { const { db, agency } = await requireAgency(); await finish(db, agency); revalidatePath("/", "layout"); redirect(s(f, "next") === "cliente" ? "/agencia/clientes?ok=" + encodeURIComponent("¡Tu oficina de práctica está lista! Ahora agrega a tu primer cliente.") : "/agencia?ok=" + encodeURIComponent("¡Listo! Tu primera oficina está armada.")); }
