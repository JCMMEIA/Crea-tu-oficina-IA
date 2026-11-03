import { Db, newId } from "../db";

export type JobKind = "run_task" | "send_outbox" | "scan_notifications" | "digest";
export interface Job { id: string; kind: JobKind; payload: any; attempts: number; max_attempts: number }

/** Cola de trabajos en la base de datos. `dedupeKey` garantiza que un mismo trabajo no se encole dos veces. */
export async function enqueue(db: Db, kind: JobKind, payload: Record<string, unknown>, opts: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {}): Promise<string | null> {
  const id = newId();
  const r = await db.query("INSERT INTO jobs(id,kind,payload,dedupe_key,run_at,max_attempts) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id",
    [id, kind, JSON.stringify(payload), opts.dedupeKey ?? null, opts.runAt ?? new Date(), opts.maxAttempts ?? 3]);
  return r.length ? id : null;
}

/** Toma un trabajo vencido (una sola instancia lo obtiene) y recupera los que quedaron bloqueados por una caída. */
export async function claim(db: Db, now = new Date(), kinds?: JobKind[]): Promise<Job | null> {
  await db.query("UPDATE jobs SET status='queued', locked_at=NULL WHERE status='running' AND locked_at < $1", [new Date(now.getTime() - 5 * 60_000)]);
  const r = await db.query<Job>(`UPDATE jobs SET status='running', locked_at=$1, attempts=attempts+1 WHERE id = (
      SELECT id FROM jobs WHERE status='queued' AND run_at <= $1 AND ($2::text[] IS NULL OR kind = ANY($2)) ORDER BY run_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,kind,payload,attempts,max_attempts`, [now, kinds ?? null]);
  return r[0] ?? null;
}
export async function complete(db: Db, id: string) { await db.query("UPDATE jobs SET status='done', finished_at=now(), last_error=NULL WHERE id=$1", [id]); }
/** Falla: reintenta con espera exponencial hasta `max_attempts`; después queda 'failed' (visible, no se pierde). */
export async function fail(db: Db, job: Job, error: string, now = new Date()) {
  const exhausted = job.attempts >= job.max_attempts;
  await db.query("UPDATE jobs SET status=$2, last_error=$3, locked_at=NULL, run_at=$4, finished_at=CASE WHEN $2='failed' THEN now() END WHERE id=$1",
    [job.id, exhausted ? "failed" : "queued", error.slice(0, 500), new Date(now.getTime() + 2 ** job.attempts * 1000)]);
}
