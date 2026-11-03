import { createPgliteDb, createPgDb, Db } from "@/server/db";
import { signup, actorFromToken, login, Actor } from "@/server/auth";
import { CompleteRequest, CompleteResult, ModelProvider, TransientProviderError } from "@/server/models";
import { ConnectorAdapter, ExecResult } from "@/server/connectors";

process.env.APP_SECRET ??= Buffer.alloc(32, 7).toString("base64");

/** Con TEST_DATABASE_URL las pruebas corren contra un PostgreSQL REAL (un esquema aislado por prueba); sin ella, PGlite en memoria. */
export async function newDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return createPgliteDb();
  const { Pool } = await import("pg");
  const schema = "t_" + Math.random().toString(36).slice(2, 10);
  const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
  return createPgDb(url + (url.includes("?") ? "&" : "?") + "options=" + encodeURIComponent(`-c search_path=${schema}`));
}

export async function newCompany(db: Db, email: string, name = "Empresa de prueba"): Promise<Actor> {
  await signup(db, { email, name: "Dueño", password: "clave-larga-123", companyName: name });
  const token = await login(db, email, "clave-larga-123");
  return (await actorFromToken(db, token))!;
}

type Step = Partial<CompleteResult> | "transient" | "fatal" | ((r: CompleteRequest) => Partial<CompleteResult>);
/** SIMULACIÓN DE PRUEBA: proveedor guionado. Solo vive en tests/. No existe en la app. */
export class ScriptedProvider implements ModelProvider {
  id = "scripted-test"; calls: CompleteRequest[] = []; i = 0;
  constructor(private steps: Step[]) {}
  pricing() { return { inUsd: 3, outUsd: 15 }; }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    this.calls.push(req);
    const s = this.steps[Math.min(this.i++, this.steps.length - 1)];
    if (s === "transient") throw new TransientProviderError("429 simulado");
    if (s === "fatal") throw new Error("400 simulado");
    const r = typeof s === "function" ? s(req) : s;
    return { text: "", toolCalls: [], inputTokens: 100, outputTokens: 50, ...r };
  }
}

/** SIMULACIÓN DE PRUEBA de Composio. */
export class FakeAdapter implements ConnectorAdapter {
  id = "fake"; executed: { entityId: string; toolkit: string; action: string; args: any }[] = []; revoked: string[] = [];
  configured() { return true; }
  async initiate(entityId: string, toolkit: string) { return { redirectUrl: `https://fake/auth/${entityId}/${toolkit}`, externalId: `ext-${entityId}-${toolkit}` }; }
  async status() { return { active: true, account: "cuenta@prueba" }; }
  async execute(entityId: string, _x: string, toolkit: string, action: string, args: any): Promise<ExecResult> {
    this.executed.push({ entityId, toolkit, action, args });
    return { ok: true, data: { echo: action, roas: 1.2 } };
  }
  async revoke(id: string) { this.revoked.push(id); }
}

import { ChannelAdapter, Channel, SendOptions, SendResult } from "@/server/messaging/types";
/** SIMULACIÓN DE PRUEBA de un canal (Telegram/WhatsApp). No envía nada real. */
export class FakeChannel implements ChannelAdapter {
  sent: { to: string; text: string; template?: SendOptions["template"] }[] = []; failNext: SendResult | null = null; ok = true;
  constructor(public channel: Channel) {}
  configured() { return this.ok; }
  async send(to: string, text: string, opts?: SendOptions): Promise<SendResult> {
    if (this.failNext) { const f = this.failNext; this.failNext = null; return f; }
    this.sent.push({ to, text, template: opts?.template }); return { ok: true, externalMsgId: `fake-${this.sent.length}` };
  }
}
