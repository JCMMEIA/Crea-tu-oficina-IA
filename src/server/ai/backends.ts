import { AnthropicProvider, TransientProviderError, type CompleteRequest, type CompleteResult, type Msg } from "../models";
import type { Sensitivity } from "./types";

/**
 * Adaptadores de proveedor. El router los llama con el id real del modelo. Nunca imprimen ni devuelven claves.
 * NOTA DE VERIFICACIÓN: el formato de OpenRouter sigue la interfaz compatible con OpenAI. Los campos `provider.data_collection`/`provider.zdr` constan en documentación pública
 * consultada solo por fragmentos de búsqueda; `usage.cost` y `usage.include` NO se verificaron: el costo se toma del proveedor SOLO si viene como número y, si no, se estima con el precio del catálogo.
 */
export interface BackendResult extends CompleteResult { costUsd?: number; providerName?: string }
export interface Backend { id: "openrouter" | "anthropic"; configured(): boolean; complete(modelId: string, req: CompleteRequest, opts: { sensitivity: Sensitivity }): Promise<BackendResult> }
export class BackendError extends Error { constructor(message: string, public code: "auth" | "credits" | "bad_request" | "provider") { super(message); this.name = "BackendError"; } }

const toOpenAi = (req: CompleteRequest) => {
  const messages: any[] = [{ role: "system", content: req.system }];
  for (const m of req.messages as Msg[]) {
    if (m.role === "user") messages.push({ role: "user", content: m.content });
    else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text || null, ...(m.toolCalls.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}) });
    else for (const r of m.results) messages.push({ role: "tool", tool_call_id: r.id, content: r.isError ? `Error: ${r.content}` : r.content });
  }
  return messages;
};
export class OpenRouterBackend implements Backend {
  id = "openrouter" as const;
  constructor(private key = process.env.OPENROUTER_API_KEY ?? "", private base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "")) {}
  configured() { return this.key.length > 10; }
  async complete(modelId: string, req: CompleteRequest, opts: { sensitivity: Sensitivity }): Promise<BackendResult> {
    const body: Record<string, unknown> = { model: modelId, messages: toOpenAi(req), max_tokens: req.maxTokens, usage: { include: true },
      // Privacidad: interna → solo proveedores que no recolectan datos; confidencial → además retención cero. Fallbacks de proveedor desactivados: el router decide, no el proveedor.
      provider: { allow_fallbacks: false, ...(opts.sensitivity !== "public" ? { data_collection: "deny" } : {}), ...(opts.sensitivity === "confidential" ? { zdr: true } : {}) } };
    if (req.tools.length) body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    let res: Response;
    try { res = await fetch(`${this.base}/chat/completions`, { method: "POST", signal: req.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}`, "X-Title": "Crea tu Oficina IA" }, body: JSON.stringify(body) }); }
    catch (e: any) { throw new TransientProviderError(`red: ${String(e?.message ?? e).slice(0, 120)}`); }
    if (res.status === 429 || res.status >= 500) throw new TransientProviderError(`OpenRouter respondió ${res.status}`);
    if (res.status === 401 || res.status === 403) throw new BackendError("OpenRouter rechazó la clave del servidor.", "auth");
    if (res.status === 402) throw new BackendError("OpenRouter sin saldo.", "credits");
    if (!res.ok) throw new BackendError(`OpenRouter respondió ${res.status}`, "bad_request");
    const j: any = await res.json().catch(() => null); const msg = j?.choices?.[0]?.message; if (!msg) throw new TransientProviderError("respuesta vacía del proveedor");
    const toolCalls = (msg.tool_calls ?? []).map((c: any) => { let input: Record<string, unknown> = {}; try { input = JSON.parse(c.function?.arguments || "{}"); } catch { throw new BackendError("argumentos de herramienta no válidos", "bad_request"); } return { id: String(c.id), name: String(c.function?.name), input }; });
    const cost = typeof j?.usage?.cost === "number" && j.usage.cost >= 0 ? j.usage.cost : undefined;
    return { text: typeof msg.content === "string" ? msg.content : "", toolCalls, inputTokens: Number(j?.usage?.prompt_tokens ?? 0), outputTokens: Number(j?.usage?.completion_tokens ?? 0), costUsd: cost, providerName: typeof j?.provider === "string" ? j.provider : undefined };
  }
}
export class AnthropicBackend implements Backend {
  id = "anthropic" as const; constructor(private key = process.env.ANTHROPIC_API_KEY ?? "") {}
  configured() { return this.key.length > 10; }
  async complete(modelId: string, req: CompleteRequest): Promise<BackendResult> { const r = await new AnthropicProvider(this.key, modelId).complete(req); return { ...r, providerName: "anthropic" }; }
}
export const defaultBackends = (): Backend[] => [new OpenRouterBackend(), new AnthropicBackend()];
