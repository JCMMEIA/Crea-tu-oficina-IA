"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { login, logout, signup } from "@/server/auth";
import { COOKIE, requireActor, setSessionCookie } from "@/lib/session";
import { createCustomDepartment, createCustomEmployee, deleteEmployee, duplicateEmployee, hireFromTemplate, setEmployeeStatus, setPermissions, updateProfile } from "@/server/catalog/office";
import { beginnerToSpec, getCurrentSkill, importSkill, restoreVersion, saveSkillVersion, skillSpecSchema } from "@/server/skills";
import { createTask, decideApproval, DuplicateTaskError, retryTask, runWorkflow } from "@/server/tasks";
import { disconnect, startConnection, testConnection } from "@/server/connectors";
import { addDoc, deleteDoc } from "@/server/knowledge";
import { createAutomation, setAutomationEnabled } from "@/server/automations";
import { getProvider } from "@/server/models";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const back = (path: string, msg?: string, kind: "ok" | "bad" = "bad") => redirect(msg ? `${path}${path.includes("?") ? "&" : "?"}${kind === "ok" ? "ok" : "error"}=${encodeURIComponent(msg)}` : path);
/** Ejecuta una acción de servidor mostrando los errores de negocio al usuario sin filtrar detalles internos. */
async function safe(path: string, fn: () => Promise<string | void>) {
  let msg: string | void;
  try { msg = await fn(); } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    const m = e?.name === "ZodError" ? "Revisa los datos del formulario." : e?.message ?? "Error inesperado.";
    return back(path, m);
  }
  revalidatePath("/", "layout");
  return msg ? back(path, msg, "ok") : redirect(path);
}

export async function signupAction(f: FormData) {
  const db = await getDb();
  try {
    await signup(db, { email: s(f, "email"), name: s(f, "name"), password: s(f, "password"), companyName: s(f, "companyName") });
    await setSessionCookie(await login(db, s(f, "email"), s(f, "password")));
  } catch (e: any) { if (e?.digest) throw e; return redirect("/registro?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa los datos (contraseña de al menos 10 caracteres)." : e.message)); }
  redirect("/construir?paso=1");
}
export async function loginAction(f: FormData) {
  const db = await getDb();
  try { await setSessionCookie(await login(db, s(f, "email"), s(f, "password"))); }
  catch (e: any) { if (e?.digest) throw e; return redirect("/login?error=" + encodeURIComponent(e.message)); }
  redirect("/oficina");
}
export async function logoutAction() {
  const db = await getDb(); const jar = await cookies(); const t = jar.get(COOKIE)?.value;
  if (t) await logout(db, t); jar.delete(COOKIE); redirect("/login");
}

export async function profileAction(f: FormData) {
  const { db, actor } = await requireActor();
  const keys = ["sector", "products", "clients", "country", "website", "social", "competitors", "goals", "problems", "apps"];
  await safe("/construir?paso=2", async () => { await updateProfile(db, actor, Object.fromEntries(keys.map((k) => [k, s(f, k)]).filter(([, v]) => v))); });
}
export async function hireAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe(s(f, "next") || "/construir?paso=3", async () => { await hireFromTemplate(db, actor, s(f, "template")); return "Empleado agregado a tu oficina."; });
}
export async function customDepartmentAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe("/construir?paso=2", async () => { await createCustomDepartment(db, actor, s(f, "name")); return "Departamento creado."; });
}
export async function customEmployeeAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe("/departamentos", async () => { await createCustomEmployee(db, actor, { departmentId: s(f, "departmentId"), name: s(f, "name"), roleTitle: s(f, "roleTitle"), description: s(f, "description") }); return "Puesto personalizado creado."; });
}
export async function employeeOpAction(f: FormData) {
  const { db, actor } = await requireActor();
  const id = s(f, "id"), op = s(f, "op");
  await safe(op === "delete" ? "/departamentos" : `/empleados/${id}`, async () => {
    if (op === "duplicate") { const n = await duplicateEmployee(db, actor, id); return redirect(`/empleados/${n}`); }
    if (op === "pause") await setEmployeeStatus(db, actor, id, "paused");
    if (op === "activate") await setEmployeeStatus(db, actor, id, "active");
    if (op === "delete") await deleteEmployee(db, actor, id);
    return "Listo.";
  });
}
export async function permissionsAction(f: FormData) {
  const { db, actor } = await requireActor();
  const id = s(f, "id");
  const perms: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("perm_")) perms[k.slice(5)] = String(v);
  await safe(`/empleados/${id}`, async () => { await setPermissions(db, actor, id, perms, { maxOutputTokens: Number(s(f, "maxOutputTokens")) || undefined, maxRunsPerDay: Number(s(f, "maxRunsPerDay")) || undefined }); return "Permisos y límites guardados."; });
}

export async function assignTaskAction(f: FormData) {
  const { db, actor } = await requireActor();
  const employeeId = s(f, "employeeId");
  let target = `/empleados/${employeeId}`;
  try {
    const id = await createTask(db, actor, { employeeId, title: s(f, "title") || s(f, "instruction").slice(0, 80), instruction: s(f, "instruction") });
    target = `/actividad/${id}`;
    await runWorkflow(db, actor, id, { provider: getProvider() });
  } catch (e: any) {
    if (e instanceof DuplicateTaskError) return redirect(`/actividad/${e.existingId}?error=${encodeURIComponent(e.message)}`);
    if (e?.digest) throw e;
    return back(target, e?.name === "ZodError" ? "Escribe una instrucción." : e.message);
  }
  revalidatePath("/", "layout"); redirect(target);
}
export async function retryTaskAction(f: FormData) {
  const { db, actor } = await requireActor(); const id = s(f, "id");
  await safe(`/actividad/${id}`, async () => { await retryTask(db, actor, id); await runWorkflow(db, actor, id, { provider: getProvider() }); return "Reintento ejecutado."; });
}
export async function approvalAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe("/aprobaciones", async () => { const r = await decideApproval(db, actor, s(f, "id"), s(f, "decision") === "approve"); return s(f, "decision") !== "approve" ? "Solicitud rechazada; no se ejecutó nada." : r.executed ? "Aprobada y ejecutada (ver evidencia en la tarea)." : `Aprobada, pero la acción falló: ${r.error}`; });
}

export async function skillSaveAction(f: FormData) {
  const { db, actor } = await requireActor(); const id = s(f, "id"); const path = `/empleados/${id}/skill`;
  await safe(path, async () => {
    const cur = (await getCurrentSkill(db, actor, id)).spec;
    const lines = (k: string) => s(f, k).split("\n").map((x) => x.trim()).filter(Boolean);
    const mode = s(f, "mode");
    const spec = mode === "beginner"
      ? beginnerToSpec(cur, Object.fromEntries(["sells", "idealClient", "difference", "competitors", "tone", "expected", "never", "consult"].map((k) => [k, s(f, k)])))
      : skillSpecSchema.parse({ ...cur, systemPrompt: s(f, "systemPrompt"), procedures: lines("procedures"), authorizedTools: lines("authorizedTools"), knowledgeSources: lines("knowledgeSources"), outputFormat: s(f, "outputFormat"), goals: lines("goals"), metrics: lines("metrics"), actionConditions: lines("actionConditions"), collaborationRules: lines("collaborationRules"), autonomy: { requireApprovalForWrites: f.get("requireApproval") === "on", maxTaskSeconds: Number(s(f, "maxTaskSeconds")) || 120 } });
    const v = await saveSkillVersion(db, actor, id, spec, s(f, "note") || (mode === "beginner" ? "Modo principiante" : "Edición avanzada"));
    return `Guardada como versión ${v}.`;
  });
}
export async function skillRestoreAction(f: FormData) {
  const { db, actor } = await requireActor(); const id = s(f, "id");
  await safe(`/empleados/${id}/skill`, async () => `Restaurada como versión ${await restoreVersion(db, actor, id, Number(s(f, "version")))}.`);
}
export async function skillImportAction(f: FormData) {
  const { db, actor } = await requireActor(); const id = s(f, "id");
  await safe(`/empleados/${id}/skill`, async () => `Importada como versión ${await importSkill(db, actor, id, s(f, "json"))}.`);
}

export async function connectAction(f: FormData) {
  const { db, actor } = await requireActor(); const k = s(f, "toolkit"); const op = s(f, "op");
  let url: string | undefined;
  await safe("/conexiones", async () => {
    if (op === "connect") { url = (await startConnection(db, actor, k)).redirectUrl; return url ? `Abre este enlace para autorizar: ${url}` : "Conexión iniciada. Pulsa «Probar»."; }
    if (op === "test") { const r = await testConnection(db, actor, k); return r.message; }
    if (op === "disconnect") { await disconnect(db, actor, k); return "Desconectada."; }
  });
}
export async function docAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe("/conocimiento", async () => {
    if (s(f, "op") === "delete") { await deleteDoc(db, actor, s(f, "id")); return "Documento eliminado."; }
    const allowed = f.getAll("allowed").map(String);
    await addDoc(db, actor, { title: s(f, "title"), kind: s(f, "kind") || "documento", content: s(f, "content"), allowedEmployeeIds: allowed.length ? allowed : null }); return "Documento agregado.";
  });
}
export async function automationAction(f: FormData) {
  const { db, actor } = await requireActor();
  await safe("/automatizaciones", async () => {
    if (s(f, "op") === "toggle") { await setAutomationEnabled(db, actor, s(f, "id"), s(f, "enabled") === "true"); return "Actualizada."; }
    const type = s(f, "type");
    const trigger = type === "event" ? { type: "event", event: s(f, "event") } : { type: "interval", everyMinutes: Number(s(f, "everyMinutes")) };
    const cond = s(f, "condField") ? [{ field: s(f, "condField"), op: s(f, "condOp"), value: isNaN(Number(s(f, "condValue"))) ? s(f, "condValue") : Number(s(f, "condValue")) }] : [];
    await createAutomation(db, actor, { name: s(f, "name"), trigger, conditions: cond, employeeId: s(f, "employeeId"), instruction: s(f, "instruction"), maxRunsPerDay: Number(s(f, "maxRunsPerDay")) || 5, maxRetries: Number(s(f, "maxRetries")) || 0 });
    return "Automatización creada.";
  });
}
