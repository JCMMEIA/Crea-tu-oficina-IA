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
import { explainError, modelInputFromForm, saveModel, setModelEnabled, updatePlanLimit, updateSettings, type SaveModelResult } from "@/server/ai/config";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
/** Ejecuta una acción del panel. Éxito: redirige con `ok=` si se da un mensaje (la persona SIEMPRE debe ver el resultado). Error: `error=` con TODOS los problemas de validación, en español. `extra` agrega parámetros a la URL (p. ej. para rellenar el formulario). */
async function run(back: string, fn: () => Promise<unknown>, okMsg?: string | ((r: any) => string), extra: (ok: boolean, r?: any) => Record<string, string> = () => ({})) {
  const [path, hash] = back.split("#"); const url = (k: string, v: string, ok: boolean, r?: unknown) => { const q = new URLSearchParams(extra(ok, r)); q.set(k, v); return path + (path.includes("?") ? "&" : "?") + q.toString() + (hash ? "#" + hash : ""); };
  let r: unknown;
  try { r = await fn(); } catch (e: any) { if (e?.digest) throw e; return redirect(url("error", explainError(e), false)); }
  revalidatePath("/admin", "layout"); if (okMsg) redirect(url("ok", typeof okMsg === "function" ? okMsg(r) : okMsg, true, r)); redirect(back);
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
const MODEL_FIELDS = ["id", "provider", "model_id", "label", "tier", "max_level", "price_in_usd_mtok", "price_out_usd_mtok", "context_window", "credit_weight", "data_policy", "notes", "allowed_providers", "supports_tools", "supports_json", "verified", "enabled"];
export async function aiModelAction(f: FormData) {
  const { db, op } = await requireOperator();
  // Si falla, se devuelve el formulario con lo que escribió la persona (v_*) y abierto, para corregir sin volver a empezar.
  const echo = (ok: boolean, r?: SaveModelResult) => (ok ? { modelo: r?.id ?? "" } : Object.fromEntries([["abrir", "1"], ...MODEL_FIELDS.filter((k) => f.get(k) !== null).map((k) => [`v_${k}`, s(f, k)])]));
  await run("/admin/ia#modelos", () => saveModel(db, op, modelInputFromForm((k) => f.get(k) as string | null)), (r: SaveModelResult) => `${r.action === "creado" ? "Modelo guardado" : r.action === "actualizado" ? "Modelo actualizado" : "Sin cambios (el modelo ya estaba así)"}: ${r.model.label} [${r.id}] · ${r.model.enabled ? "activo" : "inactivo"} · ${r.model.verified ? "verificado" : "sin verificar"}${r.matchedBy === "proveedor+modelo" ? " · ya existía con ese proveedor y modelo: se actualizó, no se duplicó" : ""}.`, echo);
}
export async function aiModelToggleAction(f: FormData) { const { db, op } = await requireOperator(); const on = s(f, "enable") === "1"; await run("/admin/ia#modelos", () => setModelEnabled(db, op, s(f, "id"), on), `Modelo ${s(f, "id")}: ${on ? "activado" : "desactivado"}.`); }
export async function aiSettingsAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia#reglas", () => updateSettings(db, op, { maxAttempts: s(f, "maxAttempts"), maxCallUsd: s(f, "maxCallUsd"), allowPaidFallback: B(f, "allowPaidFallback"), freeForInternal: B(f, "freeForInternal"), callTimeoutMs: s(f, "callTimeoutMs"), alertThresholds: s(f, "alertThresholds") }), "Reglas de enrutamiento guardadas."); }
/** Configuración inicial CONSERVADORA para pruebas controladas: tope de US$0.05 por llamada y 2 intentos. NO toca precios ni cuotas de los planes ni enciende el router. */
export async function aiPresetPruebaAction() { const { db, op } = await requireOperator(); await run("/admin/ia#reglas", () => updateSettings(db, op, { maxCallUsd: 0.05, maxAttempts: 2 }), "Configuración de prueba controlada aplicada: máximo US$ 0.05 por llamada y 2 intentos. Las cuotas de los planes y el interruptor del router no cambiaron."); }
export async function aiPlanLimitAction(f: FormData) { const { db, op } = await requireOperator(); await run("/admin/ia#planes", () => updatePlanLimit(db, op, s(f, "plan"), { monthly_credits: s(f, "monthly_credits"), monthly_budget_usd: s(f, "monthly_budget_usd"), max_offices: s(f, "max_offices"), allowed_tiers: f.getAll("allowed_tiers").map(String), max_level: s(f, "max_level"), max_task_usd: s(f, "max_task_usd") }), `Cuota del plan ${s(f, "plan")} guardada.`); }
