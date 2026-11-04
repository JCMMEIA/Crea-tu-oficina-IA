"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { LibertadError, answer, checkin, clearAnswer, deleteAll, setAssumptions, setConsent, setDepth, shareGoal, skip, snapshot, startPlan, unshareGoal } from "@/server/libertad/service";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const go = (path: string, msg: string, kind: "ok" | "error") => { const [base, hash] = path.split("#"); redirect(`${base}${base.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}${hash ? "#" + hash : ""}`); };
/** Ejecuta una acción del módulo y convierte los errores en mensajes claros (nunca expone detalles internos ni datos). */
async function run(path: string, fn: () => Promise<void>, okMsg?: string) {
  try { await fn(); } catch (e: any) { if (e?.digest) throw e; return go(path, e instanceof LibertadError || e?.message ? String(e.message).slice(0, 300) : "No se pudo completar.", "error"); }
  revalidatePath("/libertad"); if (okMsg) go(path, okMsg, "ok"); redirect(path);
}
export async function libertadStartAction(f: FormData) {
  const { db, actor } = await requireActor(); const depth = s(f, "depth") === "profundo" ? "profundo" : "corto";
  if (s(f, "consent") !== "si") return go("/libertad", "Para guardar tus datos necesitamos que aceptes el aviso de privacidad.", "error");
  await run("/libertad/diagnostico", async () => { await setConsent(db, actor, "guardar", true); await startPlan(db, actor, depth); });
}
export async function libertadAnswerAction(f: FormData) {
  const { db, actor } = await requireActor(); const q = s(f, "qid"); const back = s(f, "leave") === "1" ? "/libertad" : "/libertad/diagnostico";
  await run(back, async () => { await answer(db, actor, q, s(f, "value"), { aprox: s(f, "aprox") === "1" }); });
}
export async function libertadSkipAction(f: FormData) { const { db, actor } = await requireActor(); await run("/libertad/diagnostico", () => skip(db, actor, s(f, "qid"))); }
export async function libertadBackAction(f: FormData) { const { db, actor } = await requireActor(); await run(`/libertad/diagnostico?editar=${encodeURIComponent(s(f, "qid"))}`, () => clearAnswer(db, actor, s(f, "qid"))); }
export async function libertadDepthAction(f: FormData) { const { db, actor } = await requireActor(); await run("/libertad/diagnostico", () => setDepth(db, actor, s(f, "depth") === "profundo" ? "profundo" : "corto")); }
export async function libertadAssumptionsAction(f: FormData) {
  const { db, actor } = await requireActor(); const n = (k: string) => (s(f, k).trim() === "" ? undefined : Number(s(f, k).replace(",", ".")) / 100);
  const rates = s(f, "rates").split(/[,;\s]+/).filter(Boolean).map((x) => Number(x.replace(",", ".")) / 100);
  await run("/libertad#supuestos", () => setAssumptions(db, actor, { inflation: n("inflation"), growthPct: n("growth"), reductionPct: n("reduction"), stressPct: n("stress"), withdrawalRates: rates }), "Actualizamos tus supuestos y recalculamos.");
}
export async function libertadSnapshotAction(f: FormData) { const { db, actor } = await requireActor(); await run("/libertad#versiones", async () => { await snapshot(db, actor, s(f, "label")); }, "Guardamos esta versión de tu plan."); }
export async function libertadCheckinAction(f: FormData) {
  const { db, actor } = await requireActor(); const n = (k: string) => (s(f, k).trim() === "" ? undefined : Number(s(f, k).replace(/[$,\s]/g, "")));
  await run("/libertad#seguimiento", () => checkin(db, actor, s(f, "month"), { ingresoNeto: n("ingreso"), gasto: n("gasto"), horas: n("horas"), ahorro: n("ahorro"), nota: s(f, "nota") }), "Guardamos tu seguimiento del mes.");
}
export async function libertadShareAction(f: FormData) { const { db, actor } = await requireActor(); await run("/libertad#oficina", () => shareGoal(db, actor, s(f, "text")), "Compartimos ese objetivo con tu Oficina IA."); }
export async function libertadUnshareAction(f: FormData) { const { db, actor } = await requireActor(); await run("/libertad#oficina", () => unshareGoal(db, actor, s(f, "id")), "Dejamos de compartir ese objetivo."); }
export async function libertadDeleteAction(f: FormData) {
  const { db, actor } = await requireActor(); if (s(f, "confirm").trim().toUpperCase() !== "BORRAR") return go("/libertad#privacidad", "Para borrar todo escribe BORRAR.", "error");
  await run("/libertad", () => deleteAll(db, actor), "Borramos todo tu plan y tus datos. Esta acción no se puede deshacer.");
}
