import { EMPLOYEES, getTemplate } from "../catalog/data";
import type { Level, Sensitivity } from "./types";

/**
 * PERFIL DE ENRUTAMIENTO de cada puesto. El router es UNO solo y compartido: lo que cambia entre los 41 puestos son estos datos
 * (sensibilidad de la información, nivel habitual de dificultad y exigencia de calidad). Se ajustan aquí o, a futuro, desde /admin/ia.
 */
export interface RoutingProfile { sensitivity: Sensitivity; level: Level; quality: "basica" | "estandar" | "alta"; nota: string }
export const DEPARTMENT_PROFILE: Record<string, RoutingProfile> = {
  marketing: { sensitivity: "internal", level: "B", quality: "estandar", nota: "Textos y planes de marca: datos del negocio (internos), sin datos personales de terceros." },
  ventas: { sensitivity: "internal", level: "B", quality: "estandar", nota: "Mensajes de prospectos y precios: pueden contener datos personales de contacto." },
  operaciones: { sensitivity: "internal", level: "A", quality: "basica", nota: "Inventarios, proveedores y pedidos: información operativa interna." },
  finanzas: { sensitivity: "confidential", level: "B", quality: "alta", nota: "Cifras de la empresa, márgenes y flujo de efectivo: confidencial." },
  rrhh: { sensitivity: "confidential", level: "B", quality: "alta", nota: "Candidatos y desempeño del equipo: datos personales; confidencial." },
  direccion: { sensitivity: "confidential", level: "C", quality: "alta", nota: "Estrategia y análisis transversal: confidencial; razonamiento profundo." },
  atencion: { sensitivity: "internal", level: "A", quality: "estandar", nota: "Mensajes de clientes finales: datos personales posibles; tono y exactitud importan." },
};
/** Excepciones por puesto (clave de plantilla). */
export const EMPLOYEE_OVERRIDES: Record<string, Partial<RoutingProfile>> = {
  "gestor-reclamaciones": { level: "B", quality: "alta", nota: "Quejas: tono delicado y posibles datos personales." },
  "analista-estrategico": { level: "C" }, "supervisor-general": { level: "C", nota: "Resume el trabajo de otros empleados: puede ver datos de varios departamentos." },
  "investigador-oportunidades": { level: "C" }, "analista-flujo": { level: "B", quality: "alta" }, "especialista-rentabilidad": { level: "C" },
  "investigador-mercado": { level: "B" }, "analista-competidores": { level: "B" }, "asistente-ejecutivo": { sensitivity: "confidential", level: "A", nota: "Agenda y resúmenes de la dirección: confidencial." },
  "agente-soporte": { level: "A" }, "seguimiento-posventa": { level: "A" }, "admin-crm": { level: "A", nota: "Registros de clientes: datos personales." },
  "analista-conversiones": { level: "B" }, "analista-meta-ads": { level: "B" }, "optimizador-campanas": { level: "B" },
};
export function profileOf(templateKey: string | null | undefined): RoutingProfile {
  const t = templateKey ? getTemplate(templateKey) : undefined; const base = DEPARTMENT_PROFILE[t?.department ?? ""] ?? { sensitivity: "internal" as Sensitivity, level: "B" as Level, quality: "estandar" as const, nota: "Puesto personalizado: se trata como información interna." };
  return { ...base, ...(templateKey ? EMPLOYEE_OVERRIDES[templateKey] : {}) };
}
export const allRoutingProfiles = () => EMPLOYEES.map((e) => ({ key: e.key, name: e.name, department: e.department, tools: e.connections.map((c) => c.toolkit), ...profileOf(e.key) }));
