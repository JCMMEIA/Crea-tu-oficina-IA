export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown> }
export interface ToolCall { id: string; name: string; input: Record<string, unknown> }
export type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; results: { id: string; content: string; isError?: boolean }[] };
export interface CompleteRequest { system: string; messages: Msg[]; tools: ToolDef[]; maxTokens: number; signal?: AbortSignal }
export interface CompleteResult { text: string; toolCalls: ToolCall[]; inputTokens: number; outputTokens: number }

export interface ModelProvider {
  id: string;
  /** USD por millón de tokens; null = sin tarifa conocida → no se ejecuta (no se puede controlar el costo). */
  pricing(): { inUsd: number; outUsd: number } | null;
  complete(req: CompleteRequest): Promise<CompleteResult>;
}

export class TransientProviderError extends Error {}

export function pricingFromEnv(): { inUsd: number; outUsd: number } | null {
  const i = Number(process.env.MODEL_INPUT_USD_PER_MTOK), o = Number(process.env.MODEL_OUTPUT_USD_PER_MTOK);
  return i > 0 && o > 0 ? { inUsd: i, outUsd: o } : null;
}

/** Proveedor real (API oficial de Anthropic). Solo existe si hay ANTHROPIC_API_KEY; nunca se simula en producción. */
export class AnthropicProvider implements ModelProvider {
  id = "anthropic";
  constructor(private apiKey: string, private model = process.env.MODEL_ID || "claude-sonnet-5-5") {}
  pricing() { return pricingFromEnv(); }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey, maxRetries: 0 });
    const messages: any[] = req.messages.map((m) =>
      m.role === "user" ? { role: "user", content: m.content }
      : m.role === "assistant" ? { role: "assistant", content: [...(m.text ? [{ type: "text", text: m.text }] : []), ...m.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.input }))] }
      : { role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, is_error: r.isError })) });
    try {
      const res: any = await client.messages.create({
        model: this.model, max_tokens: req.maxTokens, system: req.system, messages,
        ...(req.tools.length ? { tools: req.tools } : {}),
      } as any, { signal: req.signal });
      const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      const toolCalls = res.content.filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input }));
      return { text, toolCalls, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
    } catch (e: any) {
      if (e?.status === 429 || e?.status >= 500 || e?.name === "APIConnectionError") throw new TransientProviderError(e.message);
      throw e;
    }
  }
}

export function getProvider(): ModelProvider | null {
  const k = process.env.ANTHROPIC_API_KEY;
  return k ? new AnthropicProvider(k) : null;
}
