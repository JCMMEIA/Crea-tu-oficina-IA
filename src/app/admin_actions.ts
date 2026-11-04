"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/session";
import { addNote, clearFollowup, deleteLead, setFollowup, setLeadStatus } from "@/server/commercial/crm";
import { cancelLicense, dismissPlanRequest, grantLicense } from "@/server/commercial/billing";
import { resolveSupport } from "@/server/commercial/support";
import { addAdSpend } from "@/server/commerce/funnel";
import { verifyAi } from "@/server/commerce/gate";
import { grantRight } from "@/server/commerce/offices";
import { processEmails, retryAllFailed, retryEmail } from "@/server/commerce/mail";
import { assertOperator } from "@/server/commercial/admin";
import { accrueCommissions, approveAffiliate, approveDueCommissions, buildPayouts, inviteAffiliate, markPayoutPaid, reverseCommission, setAffiliateStatus } from "@/server/affiliates";
import { setModelEnabled, updatePlanLimit, updateSettings, upsertModel } from "@/server/ai/config";

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
export async function adSpendAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/conversion", () => addAdSpend(db, op, { day: s(f, "day"), source: s(f, "source"), amountMxn: Number(s(f, "amount")), note: s(f, "note") })); }
export async function verifyAiAction() { const { db, op } = await requireOperator(); assertOperator(op); const r = await verifyAi(db); await run(`/admin/conversion?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.detail)}`, async () => {}); }
export async function grantRightAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/conversion", async () => { assertOperator(op); await grantRight(db, s(f, "email"), s(f, "plan") || "emprendedor"); }); }
export async function sendEmailsAction() { const { db, op } = await requireOperator(); await run("/admin/conversion", async () => { assertOperator(op); await processEmails(db); }); }
export async function retryEmailAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/correos", async () => { assertOperator(op); if (!(await retryEmail(db, s(f, "id")))) throw new Error("Ese correo ya no se puede reintentar (máximo 3 reintentos manuales)."); await processEmails(db); }); }
export async function retryFailedAction() { const { db, op } = await requireOperator(); await run("/admin/correos", async () => { assertOperator(op); await retryAllFailed(db); await processEmails(db); }); }
export async function processEmailsAction() { const { db, op } = await requireOperator(); await run("/admin/correos", async () => { assertOperator(op); await processEmails(db); }); }

const B = (f: FormData, k: string) => f.get(k) === "on";
export async function aiModelAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia", () => upsertModel(db, op, { id: s(f, "id"), provider: s(f, "provider"), model_id: s(f, "model_id"), label: s(f, "label"), tier: s(f, "tier"), max_level: s(f, "max_level"), price_in_usd_mtok: s(f, "price_in_usd_mtok"), price_out_usd_mtok: s(f, "price_out_usd_mtok"), context_window: s(f, "context_window"), supports_tools: B(f, "supports_tools"), supports_json: B(f, "supports_json"), data_policy: s(f, "data_policy"), credit_weight: s(f, "credit_weight") || "1", enabled: B(f, "enabled"), verified: B(f, "verified"), notes: s(f, "notes") })); }
export async function aiModelToggleAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia", () => setModelEnabled(db, op, s(f, "id"), s(f, "enable") === "1")); }
export async function aiSettingsAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia", () => updateSettings(db, op, { maxAttempts: Number(s(f, "maxAttempts")), maxCallUsd: Number(s(f, "maxCallUsd")), allowPaidFallback: B(f, "allowPaidFallback"), freeForInternal: B(f, "freeForInternal"), callTimeoutMs: Number(s(f, "callTimeoutMs")), alertThresholds: s(f, "alertThresholds").split(",").map((x) => Number(x.trim())).filter(Boolean) })); }
export async function aiPlanLimitAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia", () => updatePlanLimit(db, op, s(f, "plan"), { monthly_credits: s(f, "monthly_credits"), monthly_budget_usd: s(f, "monthly_budget_usd"), max_offices: s(f, "max_offices"), allowed_tiers: f.getAll("allowed_tiers").map(String), max_level: s(f, "max_level"), max_task_usd: s(f, "max_task_usd") })); }

export async function affInviteAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/afiliados", () => inviteAffiliate(db, op, s(f, "email"), s(f, "name"))); }
export async function affStatusAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/afiliados", () => s(f, "status") === "aprobada" ? approveAffiliate(db, op, s(f, "id")) : setAffiliateStatus(db, op, s(f, "id"), s(f, "status") as any, s(f, "note"))); }
export async function affAccrueAction() { const { db, op } = await requireOperator(); assertOperator(op); await run("/admin/afiliados", async () => { await accrueCommissions(db); await approveDueCommissions(db); }); }
export async function affPayoutBuildAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/afiliados", () => buildPayouts(db, op, s(f, "period"))); }
export async function affPayoutPaidAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/afiliados", () => markPayoutPaid(db, op, s(f, "id"), s(f, "reference"))); }
export async function affReverseAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/afiliados", () => reverseCommission(db, op, s(f, "invoice"), s(f, "reason"), s(f, "refunded") ? Math.round(Number(s(f, "refunded")) * 100) : undefined)); }
