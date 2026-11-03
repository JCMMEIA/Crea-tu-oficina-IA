"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { createLinkCode, prefsSchema, revokeByAgency, revokeOwn, setPrefs } from "@/server/messaging/link";
import { saveSettings } from "@/server/messaging/settings";
import { Channel } from "@/server/messaging/types";

export type CodeState = { code?: string; expiresAt?: string; channel?: Channel; error?: string } | null;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

/** El código se devuelve SOLO al navegador de quien lo pidió (estado de la acción): no va en la URL, ni en cookies, ni en registros. */
export async function createCodeAction(_prev: CodeState, f: FormData): Promise<CodeState> {
  const { db, user } = await requireUser(); const channel = s(f, "channel") as Channel;
  if (channel !== "telegram" && channel !== "whatsapp") return { error: "Canal no válido." };
  try { const r = await createLinkCode(db, user.userId, channel, f.get("consent") === "on"); return { code: r.code, expiresAt: r.expiresAt.toISOString(), channel }; }
  catch (e: any) { return { error: e.message }; }
}
const back = (m: string, kind: "ok" | "error" = "ok") => redirect(`/celular?${kind}=${encodeURIComponent(m)}`);
export async function prefsAction(f: FormData) {
  const { db, user } = await requireUser();
  try { await setPrefs(db, user.userId, s(f, "id"), prefsSchema.parse({ task_done: f.get("task_done") === "on", errors: f.get("errors") === "on", approvals: f.get("approvals") === "on", alerts: f.get("alerts") === "on", digest: s(f, "digest") === "daily" ? "daily" : "off" })); }
  catch (e: any) { return back(e.message, "error"); }
  revalidatePath("/celular"); back("Preferencias guardadas.");
}
export async function revokeAction(f: FormData) {
  const { db, user, agency } = await requireUser();
  try { if (s(f, "scope") === "agency" && agency) await revokeByAgency(db, agency, s(f, "id")); else await revokeOwn(db, user.userId, s(f, "id")); }
  catch (e: any) { return back(e.message, "error"); }
  revalidatePath("/celular"); back("Acceso revocado: ese chat ya no puede dar órdenes ni recibir avisos.");
}
export async function settingsAction(f: FormData) {
  const { db, agency } = await requireUser();
  if (!agency) return back("Solo la agencia configura esto.", "error");
  try { await saveSettings(db, agency, { assistantName: s(f, "assistantName"), welcome: s(f, "welcome"), tone: s(f, "tone") === "formal" ? "formal" : "cercano", allowedTemplateKeys: f.getAll("allowed").map(String), allowDigest: f.get("allowDigest") === "on", maxNotificationsPerDay: Number(s(f, "maxPerDay")) || 30 }); }
  catch (e: any) { return back(e?.name === "ZodError" ? "Revisa los datos." : e.message, "error"); }
  revalidatePath("/celular"); back("Configuración del asistente guardada.");
}
