import { createSign } from "node:crypto";

/**
 * Cliente de SOLO LECTURA de la GitHub App. Autenticación: JWT de la App (RS256, 9 min) → token de instalación de ~1 h pedido con permisos reducidos
 * (contents:read, metadata:read). El token vive solo en memoria del servidor: no se guarda en la base, no se registra y no llega al navegador.
 * Aquí no existe ninguna llamada de escritura a repositorios (ni commit, ni push, ni borrado).
 */
export interface GitHubConfig { appId: string; privateKey: string; clientId: string; clientSecret: string; slug: string; apiUrl: string; webUrl: string }

/** NO verificado contra una GitHub App real: no se registró ninguna. Los nombres de variables están documentados en docs/GITHUB_CONEXION.md. */
export function githubConfig(env: NodeJS.ProcessEnv = process.env): GitHubConfig | null {
  const { GITHUB_APP_ID: appId, GITHUB_APP_PRIVATE_KEY: raw, GITHUB_APP_CLIENT_ID: clientId, GITHUB_APP_CLIENT_SECRET: clientSecret, GITHUB_APP_SLUG: slug } = env;
  if (!appId || !raw || !clientId || !clientSecret || !slug) return null;
  const privateKey = raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8");
  return { appId, privateKey, clientId, clientSecret, slug, apiUrl: (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, ""), webUrl: (env.GITHUB_WEB_URL || "https://github.com").replace(/\/$/, "") };
}

export class GitHubError extends Error { constructor(message: string, public status: number) { super(message); this.name = "GitHubError"; } }
/** Límite de la API de GitHub alcanzado: se detiene la sincronización sin perder lo ya guardado. */
export class GitHubLimitError extends GitHubError { constructor(public resetAt: Date | null) { super(`GitHub pidió esperar (límite de uso alcanzado)${resetAt ? ` hasta ${resetAt.toISOString()}` : ""}.`, 429); this.name = "GitHubLimitError"; } }

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export function appJwt(cfg: GitHubConfig, now = Math.floor(Date.now() / 1000)): string {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })), body = b64u(JSON.stringify({ iat: now - 60, exp: now + 540, iss: cfg.appId }));
  return `${head}.${body}.${b64u(createSign("RSA-SHA256").update(`${head}.${body}`).sign(cfg.privateKey))}`;
}

export interface RepoInfo { id: number; full_name: string; default_branch: string; private: boolean }
export interface TreeEntry { path: string; type: string; sha: string; size?: number }
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SHA = /^[0-9a-f]{40}$/;
const tokenCache = new Map<string, { token: string; exp: number }>();
/** Solo para pruebas: vacía los tokens en memoria. */
export const clearTokenCache = () => tokenCache.clear();

export class GitHubClient {
  constructor(public cfg: GitHubConfig, private timeoutMs = 20000) {}
  private async http<T>(method: string, url: string, auth: string, body?: unknown): Promise<{ data: T; headers: Headers }> {
    const r = await fetch(url, { method, headers: { authorization: auth, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "crea-tu-oficina-ia", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(this.timeoutMs) });
    if (r.status === 429 || (r.status === 403 && (r.headers.get("x-ratelimit-remaining") === "0" || r.headers.has("retry-after")))) {
      const reset = r.headers.get("x-ratelimit-reset"), wait = r.headers.get("retry-after");
      throw new GitHubLimitError(wait ? new Date(Date.now() + Number(wait) * 1000) : reset ? new Date(Number(reset) * 1000) : null);
    }
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new GitHubError(r.status === 401 ? "GitHub no aceptó la autorización." : r.status === 404 ? "GitHub no encontró el recurso (¿se quitó la instalación o el repositorio?)." : `GitHub respondió ${r.status}.`, r.status);
    return { data, headers: r.headers };
  }
  /** Token de instalación de corta duración, con permisos reducidos a solo lectura. */
  async installationToken(installationId: string): Promise<string> {
    const key = `${this.cfg.apiUrl}|${installationId}`, hit = tokenCache.get(key);
    if (hit && hit.exp > Date.now() + 60_000) return hit.token;
    const { data } = await this.http<{ token: string; expires_at: string }>("POST", `${this.cfg.apiUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, `Bearer ${appJwt(this.cfg)}`, { permissions: { contents: "read", metadata: "read" } });
    tokenCache.set(key, { token: data.token, exp: new Date(data.expires_at).getTime() });
    return data.token;
  }
  forgetToken(installationId: string) { tokenCache.delete(`${this.cfg.apiUrl}|${installationId}`); }
  /** Si GitHub rechaza el token en caché (401), se descarta y se pide uno nuevo UNA vez. */
  private async get<T>(installationId: string, path: string): Promise<T> {
    try { return (await this.http<T>("GET", this.cfg.apiUrl + path, `Bearer ${await this.installationToken(installationId)}`)).data; }
    catch (e) { if (!(e instanceof GitHubError) || e instanceof GitHubLimitError || e.status !== 401) throw e; this.forgetToken(installationId); return (await this.http<T>("GET", this.cfg.apiUrl + path, `Bearer ${await this.installationToken(installationId)}`)).data; }
  }

  async listRepos(installationId: string, maxPages = 5): Promise<RepoInfo[]> {
    const out: RepoInfo[] = [];
    for (let p = 1; p <= maxPages; p++) {
      const d = await this.get<{ repositories: RepoInfo[] }>(installationId, `/installation/repositories?per_page=100&page=${p}`);
      out.push(...d.repositories.map((r) => ({ id: r.id, full_name: r.full_name, default_branch: r.default_branch, private: r.private })));
      if (d.repositories.length < 100) break;
    }
    return out;
  }
  async getTree(installationId: string, repo: string, branch: string): Promise<{ sha: string; tree: TreeEntry[]; truncated: boolean }> {
    if (!REPO.test(repo)) throw new GitHubError("Nombre de repositorio no válido.", 400);
    const d = await this.get<{ sha: string; tree: TreeEntry[]; truncated: boolean }>(installationId, `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return { sha: d.sha, tree: d.tree.filter((t) => t.type === "blob"), truncated: !!d.truncated };
  }
  async getBlob(installationId: string, repo: string, sha: string): Promise<Buffer> {
    if (!REPO.test(repo) || !SHA.test(sha)) throw new GitHubError("Referencia no válida.", 400);
    const d = await this.get<{ content: string; encoding: string }>(installationId, `/repos/${repo}/git/blobs/${sha}`);
    return Buffer.from(d.content, d.encoding === "base64" ? "base64" : "utf8");
  }
  // --- Verificación de quién instala y revocación ---
  async installationAccount(installationId: string): Promise<string> {
    const { data } = await this.http<{ account?: { login?: string } }>("GET", `${this.cfg.apiUrl}/app/installations/${encodeURIComponent(installationId)}`, `Bearer ${appJwt(this.cfg)}`);
    return data.account?.login ?? "cuenta de GitHub";
  }
  /** ¿Esta persona (autorizó con su cuenta de GitHub) es realmente quien tiene esa instalación? Evita que alguien pegue el id de la instalación de otro. */
  async userOwnsInstallation(code: string, installationId: string): Promise<boolean> {
    const r = await fetch(`${this.cfg.webUrl}/login/oauth/access_token`, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, code }), signal: AbortSignal.timeout(this.timeoutMs) });
    const j: any = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) return false;
    const { data } = await this.http<{ installations: { id: number }[] }>("GET", `${this.cfg.apiUrl}/user/installations?per_page=100`, `Bearer ${j.access_token}`);
    return data.installations.some((i) => String(i.id) === String(installationId));
  }
  /** Revoca el acceso de la App desde nuestro lado (la quita de la cuenta del cliente). No toca contenido de repositorios. */
  async revokeInstallation(installationId: string) {
    this.forgetToken(installationId);
    await this.http("DELETE", `${this.cfg.apiUrl}/app/installations/${encodeURIComponent(installationId)}`, `Bearer ${appJwt(this.cfg)}`);
  }
}
