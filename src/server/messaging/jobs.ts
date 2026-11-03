import { Db } from "../db";
import { ConnectorAdapter } from "../connectors";
import { ModelProvider } from "../models";
import { getTask, listApprovals, runWorkflow } from "../tasks";
import { actorFor, accessibleCompanies } from "./access";
import { claim, complete, enqueue, fail } from "./queue";
import { deliverOutbox, dayKey, notifyIdentity } from "./notify";
import { issueApprovalToken } from "./approvals";
import { Identity } from "./link";
import { Adapters } from "./types";
import { monthSpend } from "../usage";
import { can } from "../auth";
import { shortId } from "./coordinator";

export interface JobDeps { provider: ModelProvider | null; connector: ConnectorAdapter; adapters: Adapters; retryDelayMs?: number; now?: Date }

const getIdentity = async (db: Db, id: string) => (await db.query<Identity>("SELECT * FROM channel_identities WHERE id=$1", [id]))[0];
const fmtArgs = (a: unknown) => { const s = JSON.stringify(a ?? {}); return s.length > 240 ? s.slice(0, 237) + "…" : s; };

/** Texto de aviso de aprobación (incluye el código ligado a ESA acción). */
async function approvalNotice(db: Db, identity: Identity, a: any): Promise<string | null> {
  const code = await issueApprovalToken(db, identity, a);
  if (!code) return null;
  return `🔐 Aprobación pendiente: ${a.summary}\nDatos: ${fmtArgs(a.args)}\nPara aprobar responde: APROBAR ${code}\nPara rechazar: RECHAZAR ${code}\n(El código vence en 30 min y sirve solo para esta acción.)`;
}

/** Ejecuta una tarea iniciada por mensaje con el MOTOR EXISTENTE y avisa el resultado. Revalida el acceso de la persona al ejecutar. */
async function runTaskJob(db: Db, p: { taskId: string; identityId: string }, deps: JobDeps) {
  const identity = await getIdentity(db, p.identityId);
  const ct = (await db.query("SELECT company_id FROM channel_tasks WHERE task_id=$1", [p.taskId]))[0];
  if (!ct) return;
  const t0 = await db.query("SELECT status FROM tasks WHERE id=$1", [p.taskId]);
  if (!t0.length || t0[0].status !== "requested") return; // ya ejecutada (idempotencia)
  const actor = identity?.status === "active" ? await actorFor(db, identity.user_id, ct.company_id) : null;
  if (!actor || !can(actor, "tasks:create")) {
    await db.query("UPDATE tasks SET status='failed', error='Canal revocado o sin acceso: la tarea no se ejecutó.', finished_at=now() WHERE id=$1 AND status='requested'", [p.taskId]);
    return;
  }
  await runWorkflow(db, actor, p.taskId, { provider: deps.provider, adapter: deps.connector, retryDelayMs: deps.retryDelayMs });
  const g = await getTask(db, actor, p.taskId); if (!g) return;
  const t = g.task, tag = `#${shortId(t.id)}`;
  if (t.status === "completed") await notifyIdentity(db, identity!, "task_done", `✅ Tarea ${tag} lista: ${t.title}\n\n${t.result ?? "(sin texto)"}`, `task:${t.id}:done`);
  else if (t.status === "failed") await notifyIdentity(db, identity!, "error", `⚠️ La tarea ${tag} (${t.title}) no se pudo completar: ${String(t.error ?? "error").slice(0, 300)}\nPuedes reintentarla desde la aplicación.`, `task:${t.id}:failed`);
  else if (t.status === "awaiting_approval") {
    for (const a of await listApprovals(db, actor, "pending")) {
      if (a.task_id !== t.id) continue;
      const msg = await approvalNotice(db, identity!, a);
      if (msg) await notifyIdentity(db, identity!, "approval", msg, `approval:${a.id}:${identity!.id}`);
    }
  }
}

/** Avisos que no nacen de una tarea del chat: aprobaciones pendientes en empresas accesibles y consumo cercano al límite. Idempotente. */
export async function scanNotifications(db: Db, now = new Date()) {
  const ids = await db.query<Identity>("SELECT * FROM channel_identities WHERE status='active' AND consent_at IS NOT NULL");
  for (const identity of ids) {
    const companies = await accessibleCompanies(db, identity.user_id);
    for (const c of companies) {
      const actor = await actorFor(db, identity.user_id, c.id); if (!actor) continue;
      if (identity.prefs.approvals && can(actor, "approvals:decide")) {
        const pend = await db.query("SELECT * FROM approvals WHERE company_id=$1 AND status='pending' AND expires_at > $2", [c.id, now]);
        for (const a of pend) { const msg = await approvalNotice(db, identity, a); if (msg) await notifyIdentity(db, identity, "approval", `${c.name}\n${msg}`, `approval:${a.id}:${identity.id}`); }
      }
      if (identity.prefs.alerts && can(actor, "company:manage") || identity.prefs.alerts && actor.role === "admin") {
        const b = Number((await db.query("SELECT monthly_budget_usd FROM companies WHERE id=$1", [c.id]))[0].monthly_budget_usd);
        const spent = await monthSpend(db, c.id);
        if (b > 0 && spent / b >= 0.8) await notifyIdentity(db, identity, "alert", `⚠️ ${c.name}: el consumo de IA del mes llegó al ${Math.round((spent / b) * 100)}% de su presupuesto (US$ ${spent.toFixed(2)} de ${b.toFixed(2)}).`, `alert:budget:${c.id}:${identity.id}:${now.toISOString().slice(0, 7)}`);
      }
    }
    if (identity.prefs.digest === "daily") await enqueue(db, "digest", { identityId: identity.id, date: dayKey(now) }, { dedupeKey: `digest-job:${identity.id}:${dayKey(now)}` });
  }
}

async function digestJob(db: Db, p: { identityId: string; date: string }) {
  const identity = await getIdentity(db, p.identityId); if (!identity || identity.status !== "active") return;
  const lines: string[] = [];
  for (const c of (await accessibleCompanies(db, identity.user_id)).slice(0, 5)) {
    const r = await db.query("SELECT status, count(*)::int n FROM tasks WHERE company_id=$1 AND created_at > now() - interval '24 hours' GROUP BY status", [c.id]);
    const get = (s: string) => r.find((x) => x.status === s)?.n ?? 0;
    lines.push(`• ${c.name}: ${get("completed")} completadas, ${get("failed")} fallidas, ${get("awaiting_approval")} por aprobar, ${get("requested") + get("in_progress")} en curso`);
  }
  if (lines.length) await notifyIdentity(db, identity, "digest", `📋 Resumen de las últimas 24 h\n${lines.join("\n")}`, `digest:${identity.id}:${p.date}`);
}

/** Procesa trabajos vencidos. Los fallos se reintentan con espera y, al agotarse, quedan en 'failed' (visibles). */
export async function processJobs(db: Db, deps: JobDeps, opts: { limit?: number; kinds?: ("run_task" | "send_outbox" | "scan_notifications" | "digest")[] } = {}): Promise<{ done: number; failed: number }> {
  let done = 0, failed = 0;
  for (let i = 0; i < (opts.limit ?? 50); i++) {
    const job = await claim(db, deps.now, opts.kinds);
    if (!job) break;
    try {
      if (job.kind === "run_task") await runTaskJob(db, job.payload, deps);
      else if (job.kind === "send_outbox") await deliverOutbox(db, job.payload.outboxId, { adapters: deps.adapters, now: deps.now });
      else if (job.kind === "scan_notifications") await scanNotifications(db, deps.now);
      else if (job.kind === "digest") await digestJob(db, job.payload);
      await complete(db, job.id); done++;
    } catch (e: any) { await fail(db, job, e?.message ?? "error", deps.now); failed++; }
  }
  return { done, failed };
}
