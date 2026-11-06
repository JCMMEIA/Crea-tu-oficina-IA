import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";
import { GitHubClient, GitHubConfig, GitHubError, GitHubLimitError, githubConfig } from "./client";
import { DEFAULT_FILTERS, chunkText, detectSecret, looksBinary, normalizeFilters, normalizeSearch, queryTerms, skipByPath, Skip } from "./filters";

export { githubConfig, GitHubClient } from "./client";
export const TOOLKIT = "github";
/** Límites de la primera versión: acotan costo, almacenamiento y uso de la API de GitHub. */
export const LIMITS = { maxRepos: 10, maxFilesPerRepo: 300, maxFileBytes: 100_000, maxBytesPerSync: 5_000_000, minSyncIntervalMs: 5 * 60_000 };

export const getClient = (cfg: GitHubConfig | null = githubConfig()) => (cfg ? new GitHubClient(cfg) : null);
const need = <T>(x: T | null | undefined, msg: string): T => { if (!x) throw new Error(msg); return x; };
const NOT_CONFIGURED = "GitHub todavía no está activado en esta plataforma. Quien la instaló debe crear la GitHub App y guardar sus claves (ver docs/GITHUB_CONEXION.md).";

// ---- Estado firmado: amarra el flujo de instalación a ESTA empresa y a ESTA persona, con caducidad ----
const stateKey = () => createHash("sha256").update("github-state:" + need(process.env.APP_SECRET, "Falta APP_SECRET.")).digest();
const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
export function signState(a: { companyId: string; userId: string }, now = Date.now()): string {
  const payload = b64u(JSON.stringify({ c: a.companyId, u: a.userId, e: now + 15 * 60_000, n: randomBytes(8).toString("hex") }));
  return `${payload}.${createHmac("sha256", stateKey()).update(payload).digest("base64url")}`;
}
export function verifyState(state: string, a: { companyId: string; userId: string }, now = Date.now()): boolean {
  const [payload, sig] = String(state ?? "").split("."); if (!payload || !sig) return false;
  const good = createHmac("sha256", stateKey()).update(payload).digest(); let got: Buffer; try { got = Buffer.from(sig, "base64url"); } catch { return false; }
  if (got.length !== good.length || !timingSafeEqual(got, good)) return false;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString()); return p.c === a.companyId && p.u === a.userId && p.e > now; } catch { return false; }
}

const connRow = async (db: Db, companyId: string) => (await db.query("SELECT id,status,external_id,account_label,last_sync,last_error FROM connections WHERE company_id=$1 AND toolkit=$2", [companyId, TOOLKIT]))[0];

// ---- Conectar ----
export async function startGithub(db: Db, actor: Actor, cfg: GitHubConfig | null = githubConfig()): Promise<{ url: string }> {
  assertCan(actor, "connections:manage");
  const c = need(cfg, NOT_CONFIGURED);
  await db.query(`INSERT INTO connections(id,company_id,toolkit,status) VALUES($1,$2,$3,'pendiente') ON CONFLICT (company_id,toolkit) DO UPDATE SET status=CASE WHEN connections.status='conectado' THEN connections.status ELSE 'pendiente' END`, [newId(), actor.companyId, TOOLKIT]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.start", TOOLKIT);
  return { url: `${c.webUrl}/apps/${encodeURIComponent(c.slug)}/installations/new?state=${encodeURIComponent(signState(actor))}` };
}

/** Vuelta desde GitHub. Exige: estado firmado de esta empresa y persona, y que la persona de verdad tenga esa instalación en GitHub. */
export async function completeGithub(db: Db, actor: Actor, p: { installationId: string; code: string; state: string }, client: GitHubClient | null = getClient()) {
  assertCan(actor, "connections:manage");
  const gh = need(client, NOT_CONFIGURED);
  if (!/^\d{1,20}$/.test(p.installationId ?? "")) throw new Error("La respuesta de GitHub no es válida.");
  if (!verifyState(p.state, actor)) throw new Error("El enlace de conexión caducó o no es de esta cuenta. Vuelve a pulsar «Conectar GitHub».");
  if (!p.code || !(await gh.userOwnsInstallation(p.code, p.installationId))) throw new Error("GitHub no confirmó que esa instalación sea tuya. No se conectó nada.");
  const account = await gh.installationAccount(p.installationId);
  const prev = await connRow(db, actor.companyId);
  if (prev?.external_id && prev.external_id !== p.installationId) await db.query("DELETE FROM github_sources WHERE company_id=$1", [actor.companyId]); // otra cuenta: lo importado antes no se mezcla
  await db.query(`INSERT INTO connections(id,company_id,toolkit,status,external_id,account_label,scopes) VALUES($1,$2,$3,'conectado',$4,$5,$6)
    ON CONFLICT (company_id,toolkit) DO UPDATE SET status='conectado', external_id=$4, account_label=$5, scopes=$6, last_error=NULL`, [newId(), actor.companyId, TOOLKIT, p.installationId, account, JSON.stringify(["contents:read", "metadata:read"])]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.connect", TOOLKIT, { account, installationId: p.installationId });
}

async function activeInstallation(db: Db, companyId: string): Promise<string> {
  const c = await connRow(db, companyId);
  if (!c || c.status !== "conectado" || !c.external_id) throw new Error("GitHub no está conectado.");
  return c.external_id as string;
}

// ---- Elegir repositorios (solo los que el cliente autorizó al instalar la App) ----
export async function listAvailableRepos(db: Db, actor: Actor, client: GitHubClient | null = getClient()) {
  assertCan(actor, "connections:manage");
  return need(client, NOT_CONFIGURED).listRepos(await activeInstallation(db, actor.companyId));
}
export async function selectSources(db: Db, actor: Actor, picks: { repo: string; paths?: string[] }[], client: GitHubClient | null = getClient()) {
  assertCan(actor, "connections:manage");
  const gh = need(client, NOT_CONFIGURED), inst = await activeInstallation(db, actor.companyId);
  if (picks.length > LIMITS.maxRepos) throw new Error(`Puedes conectar hasta ${LIMITS.maxRepos} repositorios.`);
  const avail = new Map((await gh.listRepos(inst)).map((r) => [r.full_name, r]));
  for (const p of picks) if (!avail.has(p.repo)) throw new Error(`«${p.repo}» no está entre los repositorios que autorizaste en GitHub.`);
  const keep = picks.map((p) => p.repo);
  await db.query("DELETE FROM github_sources WHERE company_id=$1 AND NOT (repo = ANY($2::text[]))", [actor.companyId, keep]);
  for (const p of picks) {
    const f = normalizeFilters(p.paths ?? []), filters = f.length ? f : DEFAULT_FILTERS;
    const old = (await db.query("SELECT path_filters FROM github_sources WHERE company_id=$1 AND repo=$2", [actor.companyId, p.repo]))[0];
    if (old && JSON.stringify(old.path_filters) !== JSON.stringify(filters)) await db.query("UPDATE github_sources SET path_filters=$3, head_sha=NULL WHERE company_id=$1 AND repo=$2", [actor.companyId, p.repo, JSON.stringify(filters)]);
    else if (!old) await db.query("INSERT INTO github_sources(id,company_id,repo,branch,path_filters) VALUES($1,$2,$3,$4,$5)", [newId(), actor.companyId, p.repo, avail.get(p.repo)!.default_branch, JSON.stringify(filters)]);
  }
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.select", TOOLKIT, { repos: keep });
}

export async function setEmployeeAccess(db: Db, actor: Actor, employeeIds: string[]) {
  assertCan(actor, "connections:manage");
  await db.tx(async (t) => {
    await t.query("DELETE FROM github_access WHERE company_id=$1", [actor.companyId]);
    for (const id of new Set(employeeIds)) await t.query("INSERT INTO github_access(company_id,employee_id) SELECT $1,id FROM employees WHERE id=$2 AND company_id=$1", [actor.companyId, id]);
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.access", TOOLKIT, { employees: employeeIds.length });
}

// ---- Sincronizar ----
export interface SyncReport { repo: string; status: "ok" | "parcial" | "error" | "omitido"; files: number; skipped: Partial<Record<Skip, number>>; message: string }

async function syncSource(db: Db, companyId: string, inst: string, src: any, gh: GitHubClient): Promise<SyncReport> {
  const filters = (src.path_filters as string[]) ?? DEFAULT_FILTERS, skipped: Partial<Record<Skip, number>> = {};
  const skip = (r: Skip) => { skipped[r] = (skipped[r] ?? 0) + 1; };
  const tree = await gh.getTree(inst, src.repo, src.branch);
  if (src.head_sha === tree.sha && src.status === "ok") { await db.query("UPDATE github_sources SET last_sync=now() WHERE id=$1", [src.id]); return { repo: src.repo, status: "ok", files: src.files, skipped, message: "Sin cambios desde la última vez." }; }
  const eligible: { path: string; sha: string }[] = [];
  for (const t of tree.tree) { const r = skipByPath(t.path, filters); if (r) { if (r !== "fuera_de_carpetas_elegidas" && r !== "extension_no_permitida") skip(r); continue; } if ((t.size ?? 0) > LIMITS.maxFileBytes) { skip("muy_grande"); continue; } eligible.push({ path: t.path, sha: t.sha }); }
  eligible.sort((a, b) => a.path.localeCompare(b.path));
  for (const _ of eligible.splice(LIMITS.maxFilesPerRepo)) skip("limite_de_archivos");
  const rejected: Record<string, string> = { ...((src.rejected as Record<string, string>) ?? {}) }, rejectedNow: Record<string, string> = {};
  const existing = new Map((await db.query<{ path: string; blob_sha: string }>("SELECT DISTINCT path, blob_sha FROM github_chunks WHERE source_id=$1 AND company_id=$2", [src.id, companyId])).map((r) => [r.path, r.blob_sha]));
  const fetched = new Map<string, { sha: string; chunks: string[] }>(), kept = new Set<string>(); let bytes = 0, partial: string | null = null;
  for (const f of eligible) {
    if (existing.get(f.path) === f.sha) { kept.add(f.path); continue; }
    const prev = rejected[f.path]; if (prev?.startsWith(f.sha + ":")) { skip(prev.slice(41) as Skip); rejectedNow[f.path] = prev; continue; } // ya se revisó y se rechazó: no se vuelve a descargar
    try {
      const buf = await gh.getBlob(inst, src.repo, f.sha);
      const rej = (why: Skip) => { skip(why); rejectedNow[f.path] = `${f.sha}:${why}`; };
      if (buf.length > LIMITS.maxFileBytes) { rej("muy_grande"); continue; }
      if (bytes + buf.length > LIMITS.maxBytesPerSync) { skip("limite_de_archivos"); continue; }
      bytes += buf.length;
      if (looksBinary(buf)) { rej("binario"); continue; }
      const text = buf.toString("utf8"), hit = detectSecret(text) ?? detectSecret(f.path);
      if (hit) { rej("posible_secreto"); continue; } // se salta el archivo entero; nunca se guarda ni se tacha
      const chunks = chunkText(text); if (chunks.length) fetched.set(f.path, { sha: f.sha, chunks });
    } catch (e: any) { if (e instanceof GitHubLimitError) { partial = e.message; break; } if (e instanceof GitHubError && e.status === 404) { skip("limite_de_archivos"); continue; } throw e; }
  }
  const eligibleSet = new Set(eligible.map((e) => e.path));
  await db.tx(async (t) => {
    // Completa: se borra todo lo que ya no es apto o ya no existe. Parcial (límite de GitHub): solo se reemplaza lo descargado y se quita lo que dejó de ser apto.
    const drop = [...existing.keys()].filter((p) => (partial ? !eligibleSet.has(p) : !kept.has(p) && !fetched.has(p)) || fetched.has(p));
    if (drop.length) await t.query("DELETE FROM github_chunks WHERE source_id=$1 AND company_id=$2 AND path = ANY($3::text[])", [src.id, companyId, drop]);
    for (const [path, v] of fetched) for (let i = 0; i < v.chunks.length; i++)
      await t.query("INSERT INTO github_chunks(company_id,source_id,repo,path,blob_sha,commit_sha,chunk_index,content,search_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [companyId, src.id, src.repo, path, v.sha, tree.sha, i, v.chunks[i], normalizeSearch(v.chunks[i])]);
    if (kept.size) await t.query("UPDATE github_chunks SET commit_sha=$3 WHERE source_id=$1 AND company_id=$2 AND path = ANY($4::text[])", [src.id, companyId, tree.sha, [...kept]]);
    const n = (await t.query<{ n: number }>("SELECT count(DISTINCT path)::int n FROM github_chunks WHERE source_id=$1 AND company_id=$2", [src.id, companyId]))[0].n;
    await t.query("UPDATE github_sources SET head_sha=$2, files=$3, skipped=$4, status=$5, last_sync=now(), last_error=$6, rejected=$7 WHERE id=$1", [src.id, partial ? null : tree.sha, n, Object.values(skipped).reduce((a, b) => a + (b ?? 0), 0), partial ? "parcial" : "ok", partial, JSON.stringify(partial ? { ...rejected, ...rejectedNow } : rejectedNow)]);
  });
  const n = (await db.query<{ n: number }>("SELECT count(DISTINCT path)::int n FROM github_chunks WHERE source_id=$1 AND company_id=$2", [src.id, companyId]))[0].n;
  return { repo: src.repo, status: partial ? "parcial" : "ok", files: n, skipped, message: partial ?? (tree.truncated ? "GitHub devolvió una lista incompleta de archivos de este repositorio; se importó lo disponible." : "Sincronizado.") };
}

export async function syncGithub(db: Db, actor: Actor, client: GitHubClient | null = getClient(), opts: { minIntervalMs?: number; now?: number } = {}): Promise<SyncReport[]> {
  assertCan(actor, "connections:manage");
  const gh = need(client, NOT_CONFIGURED), inst = await activeInstallation(db, actor.companyId);
  const min = opts.minIntervalMs ?? LIMITS.minSyncIntervalMs, now = opts.now ?? Date.now();
  gh.forgetToken(inst); // cada sincronización empieza con un token nuevo: detecta enseguida si el cliente quitó la App
  try { await gh.installationToken(inst); } catch (e: any) {
    const msg = e instanceof GitHubLimitError ? e.message : e instanceof GitHubError && [401, 404].includes(e.status) ? "GitHub ya no reconoce la instalación. Vuelve a conectar GitHub." : `No se pudo hablar con GitHub: ${e.message}. Lo ya importado sigue disponible.`;
    if (e instanceof GitHubError && !(e instanceof GitHubLimitError) && [401, 404].includes(e.status)) await db.query("UPDATE connections SET status='error', last_error=$3 WHERE company_id=$1 AND toolkit=$2", [actor.companyId, TOOLKIT, msg]);
    else await db.query("UPDATE connections SET last_error=$3 WHERE company_id=$1 AND toolkit=$2", [actor.companyId, TOOLKIT, msg]);
    throw new Error(msg);
  }
  const sources = await db.query("SELECT * FROM github_sources WHERE company_id=$1 ORDER BY repo", [actor.companyId]);
  const reports: SyncReport[] = [];
  for (const s of sources) {
    if (s.last_sync && now - new Date(s.last_sync).getTime() < min && s.status !== "pendiente") { reports.push({ repo: s.repo, status: "omitido", files: s.files, skipped: {}, message: "Se sincronizó hace pocos minutos; espera un poco para volver a pedirlo." }); continue; }
    try { reports.push(await syncSource(db, actor.companyId, inst, s, gh)); }
    catch (e: any) {
      const m = e instanceof GitHubLimitError ? e.message : e instanceof GitHubError ? e.message : `No se pudo conectar con GitHub (${e.message}). Lo ya importado sigue disponible.`;
      await db.query("UPDATE github_sources SET status='error', last_error=$2, last_sync=now() WHERE id=$1", [s.id, m]);
      reports.push({ repo: s.repo, status: "error", files: s.files, skipped: {}, message: m });
      if (e instanceof GitHubLimitError) break;
    }
  }
  const bad = reports.find((r) => r.status === "error" || r.status === "parcial");
  await db.query("UPDATE connections SET status='conectado', last_sync=now(), last_error=$3 WHERE company_id=$1 AND toolkit=$2", [actor.companyId, TOOLKIT, bad?.message ?? null]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.sync", TOOLKIT, { repos: reports.map((r) => ({ repo: r.repo, status: r.status, files: r.files })) });
  return reports;
}

// ---- Desconectar / borrar ----
export async function deleteGithubKnowledge(db: Db, actor: Actor) {
  assertCan(actor, "connections:manage");
  await db.query("DELETE FROM github_sources WHERE company_id=$1", [actor.companyId]); // los fragmentos caen en cascada
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.delete_knowledge", TOOLKIT);
}
/** Revoca el uso al instante (la búsqueda exige conexión activa). La App también se quita de GitHub si se puede. `deleteKnowledge` borra además lo importado. */
export async function disconnectGithub(db: Db, actor: Actor, opts: { deleteKnowledge: boolean }, client: GitHubClient | null = getClient()) {
  assertCan(actor, "connections:manage");
  const c = await connRow(db, actor.companyId); if (!c) return { revoked: false };
  await db.query("DELETE FROM connections WHERE company_id=$1 AND toolkit=$2", [actor.companyId, TOOLKIT]);
  let revokeError: string | null = null;
  if (c.external_id && client) { try { await client.revokeInstallation(c.external_id); } catch (e: any) { revokeError = e.message; } }
  if (opts.deleteKnowledge) await db.query("DELETE FROM github_sources WHERE company_id=$1", [actor.companyId]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "github.disconnect", TOOLKIT, { deleteKnowledge: opts.deleteKnowledge, revokeError });
  return { revoked: !revokeError, revokeError };
}

// ---- Panel ----
export async function githubOverview(db: Db, actor: Actor) {
  assertCan(actor, "read");
  const conn = await connRow(db, actor.companyId);
  const sources = await db.query("SELECT id,repo,branch,path_filters,files,skipped,status,last_sync,last_error,head_sha FROM github_sources WHERE company_id=$1 ORDER BY repo", [actor.companyId]);
  const access = (await db.query<{ employee_id: string }>("SELECT employee_id FROM github_access WHERE company_id=$1", [actor.companyId])).map((r) => r.employee_id);
  const employees = await db.query("SELECT id,name,role_title FROM employees WHERE company_id=$1 AND status<>'inactive' ORDER BY created_at", [actor.companyId]);
  return { configured: !!githubConfig(), conn, sources, access, employees };
}

// ---- Recuperación (RAG sencillo, sin servicios nuevos): texto completo de PostgreSQL ----
export interface GithubHit { repo: string; path: string; blobSha: string; commitSha: string; cite: string; snippet: string; score: number }
export async function searchGithub(db: Db, companyId: string, employeeId: string, query: string, limit = 4): Promise<GithubHit[]> {
  // Solo si hay conexión ACTIVA de esta empresa Y este empleado fue autorizado. Todo filtrado por company_id.
  const ok = await db.query("SELECT 1 FROM connections c JOIN github_access a ON a.company_id=c.company_id AND a.employee_id=$2 WHERE c.company_id=$1 AND c.toolkit='github' AND c.status='conectado'", [companyId, employeeId]);
  if (!ok.length) return [];
  const toks = queryTerms(query); if (!toks.length) return [];
  const rows = await db.query(`SELECT c.repo,c.path,c.blob_sha,c.commit_sha,c.content, ts_rank(to_tsvector('simple',c.search_text), to_tsquery('simple',$2))::float r
    FROM github_chunks c JOIN github_sources s ON s.id=c.source_id AND s.company_id=c.company_id WHERE c.company_id=$1 AND to_tsvector('simple',c.search_text) @@ to_tsquery('simple',$2) ORDER BY r DESC, c.id LIMIT 30`, [companyId, toks.map((t) => t + ":*").join(" | ")]);
  const seen = new Set<string>(), out: GithubHit[] = [];
  for (const r of rows) {
    const k = `${r.repo}/${r.path}`; if (seen.has(k) || detectSecret(r.content)) continue; seen.add(k); // defensa en profundidad: si algo sospechoso llegó a la base, no sale
    out.push({ repo: r.repo, path: r.path, blobSha: r.blob_sha, commitSha: r.commit_sha, cite: citation(r.repo, r.path, r.commit_sha), snippet: String(r.content).slice(0, 1200), score: r.r });
    if (out.length >= limit) break;
  }
  return out;
}
/** Cita legible y segura para delimitar en el prompt: repositorio/ruta@revisión. */
export const citation = (repo: string, path: string, sha: string) => `${repo}/${path}@${sha.slice(0, 7)}`.replace(/[^\w./@ -]/g, "_");
