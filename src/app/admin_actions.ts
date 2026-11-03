"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/session";
import { addNote, clearFollowup, deleteLead, setFollowup, setLeadStatus } from "@/server/commercial/crm";
import { cancelLicense, dismissPlanRequest, grantLicense } from "@/server/commercial/billing";
import { resolveSupport } from "@/server/commercial/support";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
async function run(back: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (e: any) { if (e?.digest) throw e; return redirect(back + (back.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa los datos." : e.message)); }
  revalidatePath("/admin", "layout"); redirect(back);
}
export async function leadStatusAction(f: FormData) { const { db, op } = await requireOperator(); await run(s(f, "back") || "/admin/prospectos", () => setLeadStatus(db, op, s(f, "id"), s(f, "status"))); }
export async function leadNoteAction(f: FormData) { const { db, op } = await requireOperator(); await run(`/admin/prospectos/${s(f, "id")}`, () => addNote(db, op, s(f, "id"), s(f, "body"))); }
export async function leadFollowupAction(f: FormData) {
  const { db, op } = await requireOperator(); const id = s(f, "id");
  await run(`/admin/prospectos/${id}`, () => s(f, "clear") ? clearFollowup(db, op, id) : setFollowup(db, op, id, s(f, "when"), s(f, "note")));
}
export async function grantLicenseAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/agencias", () => grantLicense(db, op, s(f, "agencyId"), s(f, "plan"), s(f, "note"))); }
export async function cancelLicenseAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/agencias", () => cancelLicense(db, op, s(f, "agencyId"), s(f, "note"))); }
export async function dismissRequestAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/agencias", () => dismissPlanRequest(db, op, s(f, "id"))); }
export async function resolveSupportAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/soporte", () => resolveSupport(db, op, s(f, "id"))); }
export async function leadDeleteAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/prospectos", () => deleteLead(db, op, s(f, "id"))); }
