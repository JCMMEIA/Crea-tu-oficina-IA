import http from "node:http";
import { createHash, createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import { GitHubClient, GitHubConfig } from "@/server/github/client";

/** SIMULACIÓN DE PRUEBA de la API de GitHub (servidor local). Sin red real, sin claves reales: el par RSA se genera al vuelo. */
export const gitSha = (s: string | Buffer) => createHash("sha1").update(s).digest("hex");
export interface FakeRepo { full_name: string; default_branch?: string; files: Record<string, string | Buffer> }
export interface FakeInstall { id: string; account: string; repos: FakeRepo[] }
// Valores con forma de secreto armados en tiempo de ejecución para no dejar patrones reales en el repositorio.
export const FAKE = {
  awsKey: "AKIA" + "IOSFODNN7EXAMPLE", ghToken: "ghp" + "_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8", pem: ["-----BEGIN", "RSA PRIVATE KEY-----"].join(" ") + "\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
  orKey: "sk-or" + "-v1-" + "0123456789abcdef0123456789abcdef", dbUrl: "postgres" + "://admin:SuperClave123@db.interno:5432/prod",
};

export class FakeGitHub {
  srv!: http.Server; url = ""; privateKeyPem = ""; publicKey: any;
  installs = new Map<string, FakeInstall>(); codes = new Map<string, string[]>(); // code → ids de instalaciones del usuario
  log: { method: string; path: string; auth?: string; body?: any }[] = []; tokens = new Map<string, string>(); tokenCounter = 0;
  mode: { rateLimit?: boolean; down?: boolean; revoked?: Set<string>; blobFail?: boolean } = {}; blobHits = 0; jwtErrors: string[] = [];
  async start() {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    this.privateKeyPem = privateKey; this.publicKey = createPublicKey(publicKey);
    this.srv = http.createServer((req, res) => { let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => this.handle(req, res, raw)); });
    await new Promise<void>((r) => this.srv.listen(0, "127.0.0.1", () => r())); this.url = `http://127.0.0.1:${(this.srv.address() as AddressInfo).port}`; return this;
  }
  async stop() { await new Promise((r) => { this.srv.closeAllConnections?.(); this.srv.close(() => r(null)); }); }
  cfg(): GitHubConfig { return { appId: "12345", privateKey: this.privateKeyPem, clientId: "Iv1.fake", clientSecret: "fake-secret", slug: "mi-oficina-ia", apiUrl: this.url, webUrl: this.url }; }
  client() { return new GitHubClient(this.cfg(), 3000); }
  install(i: FakeInstall) { this.installs.set(i.id, i); return i; }
  private verifyJwt(auth: string): string | null {
    const [h, p, s] = auth.replace("Bearer ", "").split("."); if (!h || !p || !s) return null;
    if (!createVerify("RSA-SHA256").update(`${h}.${p}`).verify(this.publicKey, Buffer.from(s, "base64url"))) { this.jwtErrors.push("firma"); return null; }
    const c = JSON.parse(Buffer.from(p, "base64url").toString()); if (c.iss !== "12345" || c.exp * 1000 < Date.now() || c.exp - c.iat > 660) { this.jwtErrors.push("claims"); return null; } return c.iss;
  }
  private handle(req: http.IncomingMessage, res: http.ServerResponse, raw: string) {
    const url = new URL(req.url!, this.url), m = req.method!, auth = String(req.headers.authorization ?? ""); const body = raw ? JSON.parse(raw) : undefined;
    this.log.push({ method: m, path: url.pathname, auth, body });
    const send = (status: number, json: any, headers: Record<string, string> = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(status === 204 ? "" : JSON.stringify(json)); };
    if (this.mode.down) return void req.socket.destroy();
    let x: RegExpMatchArray | null;
    if (m === "POST" && url.pathname === "/login/oauth/access_token") { return this.codes.has(body.code) && body.client_secret === "fake-secret" ? send(200, { access_token: "user-" + body.code }) : send(200, { error: "bad_verification_code" }); }
    if (m === "GET" && url.pathname === "/user/installations") { const code = auth.replace("Bearer user-", ""); return send(200, { installations: (this.codes.get(code) ?? []).map((id) => ({ id: Number(id) })) }); }
    if ((x = url.pathname.match(/^\/app\/installations\/(\d+)\/access_tokens$/)) && m === "POST") {
      if (!this.verifyJwt(auth)) return send(401, { message: "Bad credentials" });
      if (!this.installs.has(x[1]) || this.mode.revoked?.has(x[1])) return send(404, { message: "Not Found" });
      const t = `tok-${++this.tokenCounter}`; this.tokens.set(t, x[1]); return send(201, { token: t, expires_at: new Date(Date.now() + 3600_000).toISOString(), permissions: body?.permissions });
    }
    if ((x = url.pathname.match(/^\/app\/installations\/(\d+)$/))) {
      if (!this.verifyJwt(auth)) return send(401, {});
      const i = this.installs.get(x[1]); if (!i) return send(404, {});
      if (m === "DELETE") { this.installs.delete(x[1]); return send(204, {}); } return send(200, { id: Number(x[1]), account: { login: i.account } });
    }
    const tid = this.tokens.get(auth.replace("Bearer ", "")) ?? ""; const inst = this.mode.revoked?.has(tid) ? undefined : this.installs.get(tid); if (!inst) return send(401, { message: "Bad credentials" });
    if (this.mode.rateLimit && /\/git\/blobs\//.test(url.pathname)) return send(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600) });
    if (m !== "GET") return send(405, {});
    if (url.pathname === "/installation/repositories") return send(200, { total_count: inst.repos.length, repositories: inst.repos.map((r, id) => ({ id: id + 1, full_name: r.full_name, default_branch: r.default_branch ?? "main", private: true })) });
    if ((x = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/git\/trees\/(.+)$/))) {
      const r = inst.repos.find((q) => q.full_name === x![1]); if (!r) return send(404, {});
      return send(200, { sha: gitSha(JSON.stringify(Object.entries(r.files).map(([k, v]) => [k, gitSha(v)]))), truncated: false, tree: Object.entries(r.files).map(([path, v]) => ({ path, type: "blob", sha: gitSha(v), size: Buffer.byteLength(v) })).concat([{ path: "docs", type: "tree", sha: "0".repeat(40), size: 0 }]) });
    }
    if ((x = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/git\/blobs\/([0-9a-f]{40})$/))) {
      const r = inst.repos.find((q) => q.full_name === x![1]); const f = r && Object.values(r.files).find((v) => gitSha(v) === x![2]); if (!f) return send(404, {});
      this.blobHits++; return send(200, { encoding: "base64", content: Buffer.from(f).toString("base64") });
    }
    send(404, {});
  }
}
