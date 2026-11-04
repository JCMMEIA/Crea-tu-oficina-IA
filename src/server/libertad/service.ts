import { Db, newId } from "../db";
import { Actor, audit } from "../auth";
import { decryptJson, encryptJson } from "./crypto";
import { QBY, buildInputs, nextQuestion, parseAnswer, progress, type Answers } from "@/features/libertad/cuestionario";
import { compute, type Assumptions, type Results } from "@/features/libertad/engine";
import { GUIDED_TASKS } from "@/features/tasks/catalog";

/**
 * Servicio de Mi Plan de Libertad. REGLAS: todo se consulta por (company_id, user_id) del actor; el contenido va cifrado; la bitácora solo guarda el TIPO de evento, nunca cifras ni textos;
 * no está disponible cuando una agencia opera la cuenta de un cliente (datos personales de otra persona).
 */
export class LibertadError extends Error { constructor(msg: string, public code = "error") { super(msg); this.name = "LibertadError"; } }
interface PlanData { answers: Answers; skipped: string[]; conf: Record<string, string>; assumptions: Partial<Assumptions>; notes?: Record<string, string> }
export interface Plan { id: string; depth: "corto" | "profundo"; data: PlanData; updatedAt: string }
/** Solo quien es MIEMBRO directo de la oficina tiene plan. Una agencia que opera la cuenta de un cliente (sin membresía) queda fuera. */
const guard = async (db: Db, a: Actor) => { if (!(await db.query("SELECT 1 FROM memberships WHERE user_id=$1 AND company_id=$2", [a.userId, a.companyId])).length) throw new LibertadError("Mi Plan de Libertad es personal: no está disponible mientras operas la cuenta de un cliente.", "agencia"); };
const empty = (): PlanData => ({ answers: {}, skipped: [], conf: {}, assumptions: {} });

export async function getConsent(db: Db, a: Actor, kind: "guardar" | "ia_externa") { await guard(db, a); const r = (await db.query("SELECT revoked_at FROM libertad_consents WHERE user_id=$1 AND company_id=$2 AND kind=$3", [a.userId, a.companyId, kind]))[0]; return !!r && !r.revoked_at; }
export async function setConsent(db: Db, a: Actor, kind: "guardar" | "ia_externa", on: boolean) {
  await guard(db, a); await db.query("INSERT INTO libertad_consents(user_id,company_id,kind,granted_at,revoked_at) VALUES($1,$2,$3,now(),$4) ON CONFLICT (user_id,company_id,kind) DO UPDATE SET granted_at=CASE WHEN $4::timestamptz IS NULL THEN now() ELSE libertad_consents.granted_at END, revoked_at=$4", [a.userId, a.companyId, kind, on ? null : new Date().toISOString()]);
  await audit(db, a, on ? "libertad.consentimiento" : "libertad.consentimiento_retirado", kind);
}
async function row(db: Db, a: Actor) { return (await db.query("SELECT id, depth, data_enc, updated_at FROM libertad_plans WHERE company_id=$1 AND user_id=$2", [a.companyId, a.userId]))[0]; }
export async function getPlan(db: Db, a: Actor): Promise<Plan | null> {
  await guard(db, a); const r = await row(db, a); if (!r) return null;
  return { id: r.id as string, depth: r.depth as "corto" | "profundo", data: { ...empty(), ...decryptJson<PlanData>(a.companyId, a.userId, r.data_enc as string) }, updatedAt: String(r.updated_at) };
}
/** Crea el plan SOLO si la persona dio su consentimiento para guardar. */
export async function startPlan(db: Db, a: Actor, depth: "corto" | "profundo" = "corto"): Promise<Plan> {
  await guard(db, a); if (!(await getConsent(db, a, "guardar"))) throw new LibertadError("Antes de guardar tus datos necesitamos tu consentimiento.", "consentimiento");
  const ex = await getPlan(db, a); if (ex) return ex;
  await db.query("INSERT INTO libertad_plans(id,company_id,user_id,depth,data_enc) VALUES($1,$2,$3,$4,$5)", [newId(), a.companyId, a.userId, depth, encryptJson(a.companyId, a.userId, empty())]);
  await audit(db, a, "libertad.plan_creado", undefined, {}); return (await getPlan(db, a))!;
}
async function save(db: Db, a: Actor, p: Plan) { await db.query("UPDATE libertad_plans SET data_enc=$1, depth=$2, updated_at=now() WHERE id=$3 AND company_id=$4 AND user_id=$5", [encryptJson(a.companyId, a.userId, p.data), p.depth, p.id, a.companyId, a.userId]); }
export async function setDepth(db: Db, a: Actor, depth: "corto" | "profundo") { const p = await need(db, a); p.depth = depth; await save(db, a, p); }
const need = async (db: Db, a: Actor) => { const p = await getPlan(db, a); if (!p) throw new LibertadError("Aún no has empezado tu plan.", "sin_plan"); return p; };

export async function answer(db: Db, a: Actor, qid: string, raw: string, opts: { aprox?: boolean } = {}) {
  const q = QBY.get(qid); if (!q) throw new LibertadError("Esa pregunta no existe."); const p = await need(db, a);
  const v = parseAnswer(q, raw); p.data.answers[qid] = v; p.data.skipped = p.data.skipped.filter((x) => x !== qid);
  if (opts.aprox && q.allowApprox) p.data.conf[qid] = "aprox"; else delete p.data.conf[qid];
  await save(db, a, p); await audit(db, a, "libertad.respuesta", qid, {});
}
export async function skip(db: Db, a: Actor, qid: string) { if (!QBY.has(qid)) throw new LibertadError("Esa pregunta no existe."); const p = await need(db, a); delete p.data.answers[qid]; if (!p.data.skipped.includes(qid)) p.data.skipped.push(qid); await save(db, a, p); }
export async function clearAnswer(db: Db, a: Actor, qid: string) { const p = await need(db, a); delete p.data.answers[qid]; p.data.skipped = p.data.skipped.filter((x) => x !== qid); await save(db, a, p); }
export async function setAssumptions(db: Db, a: Actor, s: Partial<Assumptions>) {
  const p = await need(db, a); const o: Partial<Assumptions> = {}; const f = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined);
  const inf = f(s.inflation, 0, 0.5); if (inf !== undefined) o.inflation = inf; const g = f(s.growthPct, 0, 2); if (g !== undefined) o.growthPct = g; const rd = f(s.reductionPct, 0, 1); if (rd !== undefined) o.reductionPct = rd; const st = f(s.stressPct, 0, 1); if (st !== undefined) o.stressPct = st;
  if (Array.isArray(s.withdrawalRates)) { const l = s.withdrawalRates.filter((x) => typeof x === "number" && x >= 0.01 && x <= 0.15).slice(0, 6); if (l.length) o.withdrawalRates = [...new Set(l)].sort((x, y) => x - y); }
  const hc = f(s.highCostDebtRate, 0.05, 2); if (hc !== undefined) o.highCostDebtRate = hc;
  p.data.assumptions = { ...p.data.assumptions, ...o }; await save(db, a, p);
}
export const resultsOf = (p: Plan): Results => compute(buildInputs(p.data.answers, p.data.conf, p.data.assumptions));
export const stateOf = (p: Plan) => ({ next: nextQuestion(p.data.answers, p.data.skipped, p.depth), progress: progress(p.data.answers, p.data.skipped, p.depth) });

// ── Versiones y comparación ──
export async function snapshot(db: Db, a: Actor, label = "") {
  const p = await need(db, a); const n = Number((await db.query("SELECT COALESCE(MAX(n),0)+1 n FROM libertad_versions WHERE plan_id=$1", [p.id]))[0].n);
  await db.query("INSERT INTO libertad_versions(id,plan_id,n,label,data_enc) VALUES($1,$2,$3,$4,$5)", [newId(), p.id, n, label.slice(0, 80), encryptJson(a.companyId, a.userId, { data: p.data, results: resultsOf(p) })]);
  await audit(db, a, "libertad.version", String(n), {}); return n;
}
export async function listVersions(db: Db, a: Actor) { const p = await need(db, a); return (await db.query("SELECT n,label,created_at FROM libertad_versions WHERE plan_id=$1 ORDER BY n DESC", [p.id])).map((r) => ({ n: Number(r.n), label: r.label as string, createdAt: String(r.created_at) })); }
export async function getVersion(db: Db, a: Actor, n: number) { const p = await need(db, a); const r = (await db.query("SELECT data_enc FROM libertad_versions WHERE plan_id=$1 AND n=$2", [p.id, n]))[0]; if (!r) throw new LibertadError("Esa versión no existe."); return decryptJson<{ data: PlanData; results: Results }>(a.companyId, a.userId, r.data_enc as string); }
/** Indicadores comparables entre dos resultados. Un indicador sin dato queda como null. */
export const keyIndicators = (r: Results) => ({ gastoActual: r.currentMonthly.value, gastoDeseado: r.desiredMonthly.value, ingresoNeto: r.incomeMonthly.value, flujoLibre: r.freeCashFlow.value, brechaIngreso: r.incomeGap.value, mesesFondo: r.emergency.fundMonths.value, ingresoSostenible: r.incomeSustainable.value, horasActuales: r.time.hoursNow.value, horasPorRecuperar: r.time.hoursToRecover.value, patrimonioNeto: r.netWorth.value, avance4: r.withdrawal.find((w) => w.rate === 0.04)?.progress.value ?? null });
export function compare(before: Results, after: Results) { const b = keyIndicators(before), c = keyIndicators(after); return Object.keys(b).map((k) => { const x = (b as any)[k] as number | null, y = (c as any)[k] as number | null; return { key: k, before: x, after: y, delta: x !== null && y !== null ? Math.round((y - x) * 100) / 100 : null }; }); }

// ── Seguimiento mensual ──
export async function checkin(db: Db, a: Actor, month: string, d: { ingresoNeto?: number; gasto?: number; horas?: number; ahorro?: number; nota?: string }) {
  const p = await need(db, a); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new LibertadError("El mes debe tener formato AAAA-MM.");
  const clean = { ingresoNeto: num(d.ingresoNeto), gasto: num(d.gasto), horas: num(d.horas, 168 * 5), ahorro: num(d.ahorro), nota: (d.nota ?? "").slice(0, 300) };
  await db.query("INSERT INTO libertad_checkins(id,plan_id,month,data_enc) VALUES($1,$2,$3,$4) ON CONFLICT (plan_id,month) DO UPDATE SET data_enc=EXCLUDED.data_enc", [newId(), p.id, month, encryptJson(a.companyId, a.userId, clean)]);
  await audit(db, a, "libertad.seguimiento", month, {});
}
const num = (x: unknown, max = 1e9) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : undefined);
export async function listCheckins(db: Db, a: Actor) { const p = await need(db, a); return (await db.query("SELECT month,data_enc FROM libertad_checkins WHERE plan_id=$1 ORDER BY month", [p.id])).map((r) => ({ month: r.month as string, ...decryptJson<{ ingresoNeto?: number; gasto?: number; horas?: number; ahorro?: number; nota?: string }>(a.companyId, a.userId, r.data_enc as string) })); }

// ── Exportación y borrado ──
export async function exportAll(db: Db, a: Actor) {
  const p = await need(db, a); const versions = await Promise.all((await listVersions(db, a)).map(async (v) => ({ ...v, ...(await getVersion(db, a, v.n)) })));
  await audit(db, a, "libertad.exportado", undefined, {});
  return { exportado: new Date().toISOString(), aviso: "Datos personales. Guárdalos en un lugar seguro.", respuestas: p.data.answers, omitidas: p.data.skipped, supuestos: p.data.assumptions, resultados: resultsOf(p), versiones: versions, seguimiento: await listCheckins(db, a), objetivosCompartidos: await listShared(db, a) };
}
/** Borrado definitivo de TODO lo de esta persona en esta oficina (plan, versiones, seguimiento, objetivos compartidos). No se puede deshacer. */
export async function deleteAll(db: Db, a: Actor) {
  await guard(db, a); await db.query("DELETE FROM libertad_shared_goals WHERE company_id=$1 AND user_id=$2", [a.companyId, a.userId]);
  await db.query("DELETE FROM libertad_plans WHERE company_id=$1 AND user_id=$2", [a.companyId, a.userId]); // versiones y seguimiento caen en cascada
  await db.query("DELETE FROM libertad_consents WHERE company_id=$1 AND user_id=$2", [a.companyId, a.userId]); await audit(db, a, "libertad.borrado_total", undefined, {});
}

// ── Cerebro Empresarial: SOLO objetivos operativos que la persona autoriza compartir ──
export async function shareGoal(db: Db, a: Actor, text: string) {
  await guard(db, a); const t = text.replace(/\s+/g, " ").trim(); if (t.length < 3 || t.length > 300) throw new LibertadError("El objetivo debe tener entre 3 y 300 caracteres.");
  if (/\$\s?\d|\b\d{4,}\b|mxn|pesos/i.test(t)) throw new LibertadError("Por privacidad, no compartas cifras de dinero con tu oficina: escribe solo el objetivo operativo (por ejemplo, «recuperar 10 horas semanales de atención a clientes»).", "cifras");
  const n = Number((await db.query("SELECT count(*) n FROM libertad_shared_goals WHERE company_id=$1 AND user_id=$2", [a.companyId, a.userId]))[0].n); if (n >= 5) throw new LibertadError("Puedes compartir hasta 5 objetivos.");
  await db.query("INSERT INTO libertad_shared_goals(id,company_id,user_id,text) VALUES($1,$2,$3,$4)", [newId(), a.companyId, a.userId, t]); await audit(db, a, "libertad.objetivo_compartido", undefined, {});
}
export async function unshareGoal(db: Db, a: Actor, id: string) { await guard(db, a); await db.query("DELETE FROM libertad_shared_goals WHERE id=$1 AND company_id=$2 AND user_id=$3", [id, a.companyId, a.userId]); await audit(db, a, "libertad.objetivo_retirado", undefined, {}); }
export async function listShared(db: Db, a: Actor) { await guard(db, a); return (await db.query("SELECT id,text,approved_at FROM libertad_shared_goals WHERE company_id=$1 AND user_id=$2 ORDER BY approved_at", [a.companyId, a.userId])).map((r) => ({ id: r.id as string, text: r.text as string })); }

// ── «Convertir mi plan en tareas para mi Oficina IA» ──
const TASKS_BY_AREA: Record<string, string[]> = { atencion: ["responder-cliente", "queja-resena", "seguimiento-posventa"], ventas: ["respuesta-prospecto", "propuesta-comercial"], marketing: ["anuncios-3-variantes", "contenido-semanal", "guion-video-corto"] };
export interface TaskProposal { area: string; label: string; hoursWeek: number; disposition: string; tasks: { key: string; title: string }[]; covered: boolean; note: string }
/** Propone qué tareas guiadas existentes podrían ayudar. NO ejecuta nada ni mide ahorros: las horas son las que declaraste, no resultados. */
export function planToTasks(r: Results, p: Plan): { proposals: TaskProposal[]; hoursToRecover: number | null; honest: string } {
  const acts = (p.data.answers ? buildInputs(p.data.answers, p.data.conf).time?.activities : undefined) ?? [];
  const proposals = acts.filter((x) => x.disposition && x.disposition !== "conservar").map((x) => {
    const keys = TASKS_BY_AREA[x.area] ?? []; const tasks = keys.map((k) => GUIDED_TASKS.find((t) => t.key === k)).filter(Boolean).map((t) => ({ key: t!.key, title: t!.title }));
    const covered = tasks.length > 0 && (x.disposition === "asistir_ia" || x.disposition === "automatizar");
    return { area: x.area, label: x.label, hoursWeek: x.hoursWeek, disposition: x.disposition!, tasks: covered ? tasks : [], covered,
      note: covered ? "Estas tareas guiadas generan borradores que tú revisas antes de usarlos. Nada se envía ni se publica solo." : x.disposition === "delegar_persona" ? "Esto lo pensaste para una persona: hoy ningún empleado IA lo sustituye." : x.disposition === "eliminar" ? "Pensaste eliminarlo: no necesita tarea." : "Hoy no hay una tarea guiada para esta área; queda como pendiente de la lista de funciones en revisión." };
  });
  return { proposals, hoursToRecover: r.time.hoursToRecover.value, honest: "Las horas son las que tú declaraste y lo que podría liberarse es una estimación. Un ahorro de tiempo o de dinero solo se considera real cuando lo mides después de usar las tareas." };
}
