"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { updateProfile } from "@/server/catalog/office";
import { BRAIN_KEYS } from "@/server/brain";
import { getProvider } from "@/server/models";
import { GuidedError, runGuidedTask, saveEdit } from "@/features/tasks/service";
import { getGuided } from "@/features/tasks/catalog";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const go = (path: string, msg: string, kind: "ok" | "error") => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

/** Guarda la ficha del negocio (Cerebro Empresarial). Solo los campos conocidos; vacío = se borra ese dato. */
export async function brainSaveAction(f: FormData) {
  const { db, actor } = await requireActor();
  try { await updateProfile(db, actor, Object.fromEntries(BRAIN_KEYS.map((k) => [k, s(f, k).trim()]).filter(([, v]) => v))); }
  catch (e: any) { if (e?.digest) throw e; return go("/cerebro", e?.name === "ZodError" ? "Revisa el largo de los textos." : e.message, "error"); }
  revalidatePath("/", "layout"); go("/cerebro", "Listo: tus empleados ya usarán esta información en cada tarea.", "ok");
}
export async function guidedRunAction(f: FormData) {
  const { db, actor } = await requireActor(); const key = s(f, "key"); const t = getGuided(key); const path = `/tareas/${key}`;
  if (!t) return go("/tareas", "Esa tarea no existe.", "error");
  const answers: Record<string, string> = {}; for (const qu of t.questions) answers[qu.id] = s(f, `a_${qu.id}`);
  let id: string;
  try { id = await runGuidedTask(db, actor, key, answers, { provider: getProvider() }); }
  catch (e: any) {
    if (e?.digest) throw e;
    if (e instanceof GuidedError) { if (e.code === "duplicada" && e.extra?.existingRunId) return go(`/resultados/${e.extra.existingRunId}`, e.message, "ok"); return go(path, e.message, "error"); }
    return go(path, e?.name === "ZodError" ? "Revisa tus respuestas." : e.message ?? "No se pudo ejecutar.", "error");
  }
  revalidatePath("/", "layout"); redirect(`/resultados/${id}`);
}
export async function editResultAction(f: FormData) {
  const { db, actor } = await requireActor(); const id = s(f, "id"); const path = `/resultados/${id}`;
  try { await saveEdit(db, actor, id, s(f, "op") === "restore" ? null : s(f, "text")); }
  catch (e: any) { if (e?.digest) throw e; return go(path, e.message, "error"); }
  revalidatePath(path); go(path, s(f, "op") === "restore" ? "Restauramos el texto original de la IA." : "Guardamos tus cambios. El original sigue disponible.", "ok");
}
