import { CompleteRequest, CompleteResult, ModelProvider } from "../../src/server/models";

/**
 * SIMULACIÓN del modelo de IA (NO es Claude). Decide qué herramienta llamar según el puesto del empleado, pero los DATOS que usa
 * (productos, cantidades, ids) salen de los resultados REALES de las herramientas del sistema, nunca de valores escritos aquí.
 */
export class PilotSimProvider implements ModelProvider {
  id = "simulacion-piloto"; calls: { role: string; tool?: string }[] = [];
  pricing() { return { inUsd: 3, outUsd: 15 }; }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const role = /Eres ([^.\n]+)\./.exec(req.system)?.[1] ?? "?";
    const prev = req.messages.flatMap((m) => (m.role === "assistant" ? m.toolCalls.map((c) => c.name) : []));
    const results = req.messages.flatMap((m) => (m.role === "tool" ? m.results.map((r) => { try { return JSON.parse(r.content); } catch { return null; } }) : []));
    const mate = (re: RegExp) => new RegExp(`${re.source}[^\\n]*\\(id: ([0-9a-f-]{36})\\)`).exec(req.system)?.[1];
    const first = req.messages[0]; const userText = first && first.role === "user" ? first.content : "";
    const out = (text: string, toolCalls: CompleteResult["toolCalls"] = []): CompleteResult => { this.calls.push({ role, tool: toolCalls[0]?.name }); return { text, toolCalls, inputTokens: 400, outputTokens: 120 }; };
    const call = (name: string, input: Record<string, unknown> = {}) => ({ id: `t${prev.length}`, name, input });
    if (/^Controlador de inventario/.test(role)) {
      if (!prev.includes("inventario__leer_inventario")) return out("", [call("inventario__leer_inventario")]);
      if (!prev.includes("inventario__calcular_resurtido")) return out("", [call("inventario__calcular_resurtido")]);
      const calc = results.at(-1); const low: any[] = calc?.bajo_minimo ?? [];
      if (!low.length) return out("Revisé el inventario: no hay productos bajo el mínimo. No hace falta resurtir.");
      const analyst = mate(/Analista de proveedores/);
      if (!prev.includes("delegate_task") && analyst) {
        const txt = `Detecté ${low.length} productos bajo el mínimo: ${low.map((l) => `${l.nombre} (${l.stock}/${l.minimo})`).join(", ")}. Total por reponer: ${calc.total_unidades} unidades.`;
        return out(txt, [call("delegate_task", { employee_id: analyst, title: "Preparar borrador de resurtido", instruction: `Prepara el borrador de resurtido para ${low.length} productos bajo el mínimo (${calc.total_unidades} unidades en total) y llévalo a aprobación.`, context: txt })]);
      }
      return out("Listo: detecté los productos bajo el mínimo y delegué el borrador al Analista de proveedores.");
    }
    if (/^Analista de proveedores/.test(role)) {
      if (!prev.includes("inventario__calcular_resurtido")) return out("", [call("inventario__calcular_resurtido")]);
      if (!prev.includes("inventario__guardar_borrador_resurtido")) return out("", [call("inventario__guardar_borrador_resurtido", { nota: "Borrador automático" })]);
      const draft = results.at(-1); const sup = mate(/Supervisor general/);
      if (!prev.includes("delegate_task") && draft?.draft_id && sup) {
        const txt = `Borrador ${draft.draft_id} guardado: ${draft.productos} productos, ${draft.total_unidades} unidades, costo estimado ${draft.costo_estimado}. Estado: borrador, no enviado.`;
        return out(txt, [call("delegate_task", { employee_id: sup, title: "Presentar resurtido al propietario", instruction: `Presenta al propietario el borrador de resurtido ${draft.draft_id} (${draft.total_unidades} unidades) y solicita su aprobación.`, context: txt })]);
      }
      return out(draft?.mensaje ?? "Borrador preparado y entregado al supervisor.");
    }
    if (/^Supervisor general/.test(role)) {
      const id = /resurtido ([0-9a-f-]{36})/.exec(userText)?.[1];
      if (!prev.includes("inventario__solicitar_resurtido") && id) return out("", [call("inventario__solicitar_resurtido", { draft_id: id })]);
      return out("Presenté la solicitud de resurtido al propietario; queda esperando su aprobación. No se envió ninguna compra.");
    }
    return out("(simulación sin guion para este puesto)");
  }
}
