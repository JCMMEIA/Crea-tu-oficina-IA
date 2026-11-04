import { describe, it, expect } from "vitest";
import { CatalogFormatError, SLOTS, parseCatalog, shortlist } from "@/server/ai/catalogo";

// Ejemplo INVENTADO con el formato que recordamos del catálogo público (precios en USD por TOKEN, como texto). No son modelos reales.
const FIXTURE = { data: [
  { id: "demo/libre-a:free", name: "Libre A", created: 1700000300, context_length: 32000, pricing: { prompt: "0", completion: "0" }, supported_parameters: ["max_tokens"], architecture: { output_modalities: ["text"] } },
  { id: "demo/libre-b:free", name: "Libre B", created: 1700000100, context_length: 8000, pricing: { prompt: "0", completion: "0" }, supported_parameters: ["tools"] },
  { id: "demo/eco-1", name: "Eco 1", created: 1700000200, context_length: 64000, pricing: { prompt: "0.0000002", completion: "0.0000008" }, supported_parameters: ["tools", "response_format"] },
  { id: "demo/eco-2", name: "Eco 2", created: 1700000250, context_length: 64000, pricing: { prompt: "0.0000002", completion: "0.0000008" }, supported_parameters: ["tools"] },
  { id: "demo/eco-sin-tools", name: "Eco sin tools", context_length: 64000, pricing: { prompt: "0.0000001", completion: "0.0000004" }, supported_parameters: [] },
  { id: "demo/pro-1", name: "Pro 1", created: 1700000400, context_length: 200000, pricing: { prompt: "0.000003", completion: "0.000015" }, supported_parameters: ["tools", "structured_outputs"] },
  { id: "demo/caro", name: "Caro", context_length: 200000, pricing: { prompt: "0.00002", completion: "0.0001" }, supported_parameters: ["tools"] },
  { id: "demo/imagen", name: "Imagen", context_length: 4000, pricing: { prompt: "0.000001", completion: "0.000001" }, architecture: { output_modalities: ["image"] } },
  { id: "demo/sin-precio", name: "Sin precio", context_length: 64000, supported_parameters: ["tools"] },
] };
describe("preselección de candidatos (formato supuesto del catálogo)", () => {
  const c = parseCatalog(FIXTURE);
  it("convierte precios por token a USD por millón y descarta lo que no es texto o no trae precio legible", () => {
    expect(c.find((m) => m.id === "demo/eco-1")).toMatchObject({ inUsdMtok: expect.closeTo(0.2, 6), outUsdMtok: expect.closeTo(0.8, 6), tools: true, json: true }); expect(c.map((m) => m.id)).not.toContain("demo/imagen"); expect(c.map((m) => m.id)).not.toContain("demo/sin-precio");
  });
  it("gratuito: precio 0 en entrada y salida y contexto suficiente (sin precio NO es gratis)", () => { expect(shortlist(c, SLOTS.gratuito).map((m) => m.id)).toEqual(["demo/libre-a:free"]); });
  it("económico: de pago, con herramientas, contexto y tope de precio; el más barato y reciente primero", () => { expect(shortlist(c, SLOTS.economico).map((m) => m.id)).toEqual(["demo/eco-2", "demo/eco-1"]); });
  it("avanzado: admite herramientas, contexto grande y respeta el tope; el excesivamente caro queda fuera", () => { const l = shortlist(c, SLOTS.avanzado).map((m) => m.id); expect(l).toContain("demo/pro-1"); expect(l).not.toContain("demo/caro"); });
  it("si el formato cambia, se niega a seleccionar en vez de adivinar", () => { expect(() => parseCatalog({})).toThrow(CatalogFormatError); expect(() => parseCatalog({ data: [{ id: "x", pricing: {} }] })).toThrow(CatalogFormatError); });
});
