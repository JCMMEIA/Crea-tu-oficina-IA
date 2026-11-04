import { getTemplate } from "@/server/catalog/data";

/** Tres niveles DISTINTOS (nunca se mezclan): configurado → conectado → operativo. */
export type Level = "no" | "parcial" | "si" | "na";
export interface Readiness {
  configurado: { level: Level; detail: string };
  conectado: { level: Level; detail: string; faltan: string[] };
  operativo: { level: Level; detail: string };
}
export interface ReadinessInput { templateKey: string | null; status: string; connected: Set<string>; aiOk: boolean | null }
/**
 * configurado: el empleado existe, está activo y tiene su enseñanza (skill).
 * conectado:   todas las aplicaciones OBLIGATORIAS de su plantilla están conectadas de verdad (estado «conectado»).
 * operativo:   configurado + conectado + la IA del servidor fue verificada. Solo entonces se afirma que puede trabajar.
 */
export function readiness(i: ReadinessInput): Readiness {
  const t = i.templateKey ? getTemplate(i.templateKey) : undefined;
  const need = (t?.connections ?? []).filter((c) => c.required);
  const faltan = need.filter((c) => !i.connected.has(c.toolkit)).map((c) => c.toolkit);
  const configurado: Readiness["configurado"] = i.status === "active" ? { level: "si", detail: "Contratado y activo." } : { level: "no", detail: "Está en pausa." };
  const conectado: Readiness["conectado"] = !need.length ? { level: "na", detail: "No necesita aplicaciones conectadas.", faltan }
    : faltan.length === 0 ? { level: "si", detail: "Sus aplicaciones obligatorias están conectadas.", faltan }
    : faltan.length < need.length ? { level: "parcial", detail: "Falta conectar alguna aplicación obligatoria.", faltan } : { level: "no", detail: "Aún no tiene sus aplicaciones conectadas.", faltan };
  const ok = configurado.level === "si" && (conectado.level === "si" || conectado.level === "na") && i.aiOk === true;
  const operativo: Readiness["operativo"] = ok ? { level: "si", detail: "Listo para trabajar: la IA fue verificada." }
    : i.aiOk !== true ? { level: "no", detail: "La IA del servidor aún no está verificada; no se promete que pueda trabajar." } : { level: "no", detail: "Completa lo anterior para que pueda trabajar." };
  return { configurado, conectado, operativo };
}
export const LEVEL_LABEL: Record<Level, string> = { si: "Sí", parcial: "Parcial", no: "No", na: "No aplica" };
