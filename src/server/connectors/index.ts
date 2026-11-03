import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";
import { getToolkit, TOOLKITS } from "./catalog";

export interface ExecResult { ok: boolean; data?: unknown; error?: string }
export interface InitResult { redirectUrl?: string; externalId: string }
/** Adaptador desacoplado: Composio es una implementación; se pueden añadir otras sin tocar el resto. */
export interface ConnectorAdapter {
  id: string;
  configured(): boolean;
  /** El `entityId` identifica a la EMPRESA en el proveedor (aislamiento por empresa). */
  initiate(entityId: string, toolkit: string): Promise<InitResult>;
  status(entityId: string, externalId: string): Promise<{ active: boolean; account?: string; error?: string }>;
  execute(entityId: string, externalId: string, toolkit: string, action: string, args: Record<string, unknown>): Promise<ExecResult>;
  revoke(externalId: string): Promise<void>;
}

/** NO verificado contra una cuenta real de Composio (sin clave ni acceso a su documentación en esta sesión). */
export class ComposioAdapter implements ConnectorAdapter {
  id = "composio";
  private base = "https://backend.composio.dev/api/v3";
  configured() { return !!process.env.COMPOSIO_API_KEY; }
  private async call(method: string, path: string, body?: unknown) {
    const r = await fetch(this.base + path, { method, headers: { "x-api-key": process.env.COMPOSIO_API_KEY!, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || j?.message || `Composio respondió ${r.status}`);
    return j;
  }
  async initiate(entityId: string, toolkit: string): Promise<InitResult> {
    const j = await this.call("POST", "/connected_accounts/link", { auth_config_id: toolkit, user_id: entityId });
    return { redirectUrl: j.redirect_url, externalId: j.connected_account_id ?? j.id };
  }
  async status(_e: string, externalId: string) {
    const j = await this.call("GET", `/connected_accounts/${encodeURIComponent(externalId)}`);
    return { active: j.status === "ACTIVE", account: j.account_label ?? undefined, error: j.status_reason ?? undefined };
  }
  async execute(entityId: string, externalId: string, toolkit: string, action: string, args: Record<string, unknown>): Promise<ExecResult> {
    const slug = `${toolkit}_${action}`.toUpperCase();
    try {
      const j = await this.call("POST", `/tools/execute/${slug}`, { user_id: entityId, connected_account_id: externalId, arguments: args });
      return { ok: j.successful !== false, data: j.data, error: j.error ?? undefined };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }
  async revoke(externalId: string) { await this.call("DELETE", `/connected_accounts/${encodeURIComponent(externalId)}`); }
}
export const getAdapter = (): ConnectorAdapter => new ComposioAdapter();

export async function listConnections(db: Db, actor: Actor, adapter: ConnectorAdapter = getAdapter()) {
  assertCan(actor, "read");
  const conns = await db.query("SELECT toolkit,status,account_label,scopes,last_sync,last_error FROM connections WHERE company_id=$1", [actor.companyId]);
  const emps = await db.query("SELECT name, permissions FROM employees WHERE company_id=$1 AND status<>'inactive'", [actor.companyId]);
  return TOOLKITS.map((t) => {
    const c = conns.find((x) => x.toolkit === t.key);
    return {
      key: t.key, label: t.label, category: t.category, availability: t.availability, note: t.note,
      canConnect: t.availability !== "no-disponible" && adapter.configured(),
      providerConfigured: adapter.configured(),
      status: c?.status ?? "desconectado", account: c?.account_label ?? null, scopes: c?.scopes ?? [], lastSync: c?.last_sync ?? null, lastError: c?.last_error ?? null,
      usedBy: emps.filter((e) => e.permissions?.[t.key] && e.permissions[t.key] !== "none").map((e) => e.name as string),
    };
  });
}

export async function startConnection(db: Db, actor: Actor, toolkit: string, adapter: ConnectorAdapter = getAdapter()): Promise<{ redirectUrl?: string }> {
  assertCan(actor, "connections:manage");
  const spec = getToolkit(toolkit);
  if (!spec) throw new Error("Integración desconocida.");
  if (spec.availability === "no-disponible") throw new Error(`${spec.label} aún no está disponible: ${spec.note}`);
  if (!adapter.configured()) throw new Error("Falta configurar Composio (COMPOSIO_API_KEY). Consulta la guía de conexión.");
  const init = await adapter.initiate(actor.companyId, toolkit);
  await db.query(`INSERT INTO connections(id,company_id,toolkit,status,external_id) VALUES($1,$2,$3,'pendiente',$4)
    ON CONFLICT (company_id,toolkit) DO UPDATE SET status='pendiente', external_id=$4, last_error=NULL`, [newId(), actor.companyId, toolkit, init.externalId]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "connection.start", toolkit);
  return { redirectUrl: init.redirectUrl };
}

/** Prueba de conexión: consulta al proveedor y guarda el resultado con mensaje claro. */
export async function testConnection(db: Db, actor: Actor, toolkit: string, adapter: ConnectorAdapter = getAdapter()): Promise<{ ok: boolean; message: string }> {
  assertCan(actor, "connections:manage");
  const c = (await db.query("SELECT external_id FROM connections WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit]))[0];
  if (!c) return { ok: false, message: "Esta integración no está conectada." };
  try {
    const s = await adapter.status(actor.companyId, c.external_id);
    if (s.active) {
      await db.query("UPDATE connections SET status='conectado', account_label=$3, last_sync=now(), last_error=NULL WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit, s.account ?? null]);
      return { ok: true, message: "Conexión verificada." };
    }
    await db.query("UPDATE connections SET status='error', last_error=$3 WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit, s.error ?? "La autorización no está activa."]);
    return { ok: false, message: s.error ?? "La autorización aún no está activa. Termina el permiso en la ventana del proveedor." };
  } catch (e: any) {
    await db.query("UPDATE connections SET status='error', last_error=$3 WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit, e.message]);
    return { ok: false, message: `No se pudo comprobar: ${e.message}` };
  }
}

export async function disconnect(db: Db, actor: Actor, toolkit: string, adapter: ConnectorAdapter = getAdapter()) {
  assertCan(actor, "connections:manage");
  const c = (await db.query("SELECT external_id FROM connections WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit]))[0];
  if (!c) return;
  let revokeError: string | null = null;
  try { if (c.external_id) await adapter.revoke(c.external_id); } catch (e: any) { revokeError = e.message; }
  await db.query("DELETE FROM connections WHERE company_id=$1 AND toolkit=$2", [actor.companyId, toolkit]);
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "connection.disconnect", toolkit, { revokeError });
}

export async function getActiveConnection(db: Db, companyId: string, toolkit: string) {
  return (await db.query("SELECT external_id FROM connections WHERE company_id=$1 AND toolkit=$2 AND status='conectado'", [companyId, toolkit]))[0] as { external_id: string } | undefined;
}
