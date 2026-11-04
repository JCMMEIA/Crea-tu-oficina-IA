/**
 * PLANES COMERCIALES (Starter, Pro, Business) — configuración central.
 * ESTADO: borrador sin aprobar. Mientras `aprobado` sea false, la landing NO publica precios ni cantidades: muestra «Por definir».
 * Para publicar: llena `precioMxn` y `valores`, y pon aprobado = true. El plan que realmente se puede comprar hoy es el de `OFFER_PLAN` (ver Offer.tsx y docs/landing/AUDITORIA_SUSCRIPCION.md); estos tres niveles NO están conectados al cobro.
 */
export type TierKey = "starter" | "pro" | "business";
export interface Tier { key: TierKey; nombre: string; para: string; ideal: string[]; destacado?: boolean; precioMxn: number | null }
export const PLANES_APROBADOS = false;
export const TIERS: Tier[] = [
  { key: "starter", nombre: "Starter", para: "Para empezar con una oficina y probar tus primeras tareas.", ideal: ["Conocer cómo trabajan los empleados IA", "Un negocio y un equipo pequeño", "Probar las tareas guiadas con tus datos"], precioMxn: null },
  { key: "pro", nombre: "Pro", para: "Para un negocio que ya trabaja todos los días con su equipo IA.", destacado: true, ideal: ["Trabajo diario con varios empleados", "Más tareas y más documentos de conocimiento", "Resultados guardados para toda tu operación"], precioMxn: null },
  { key: "business", nombre: "Business", para: "Para varios departamentos o varias oficinas.", ideal: ["Marketing, ventas y atención a la vez", "Varias oficinas con datos separados", "Más margen de uso y soporte prioritario"], precioMxn: null },
];
/** `ideal` es solo ORIENTACIÓN de a quién va dirigido cada nivel; no promete cantidades ni límites. */
/** Filas de la comparación. `valores` por nivel (null = por definir). `feature` enlaza con disponibilidad.ts para etiquetar la fila. */
export interface FilaPlan { fila: string; ayuda?: string; feature?: string; valores: Record<TierKey, string | null> }
export const FILAS: FilaPlan[] = [
  { fila: "Oficinas incluidas", valores: { starter: null, pro: null, business: null } },
  { fila: "Empleados IA disponibles", ayuda: "Del catálogo de 41", feature: "empleados", valores: { starter: null, pro: null, business: null } },
  { fila: "Tareas incluidas al mes", ayuda: "Límite de uso de IA", valores: { starter: null, pro: null, business: null } },
  { fila: "Tareas guiadas", feature: "tareasGuiadas", valores: { starter: "Incluidas", pro: "Incluidas", business: "Incluidas" } },
  { fila: "Cerebro Empresarial", feature: "cerebro", valores: { starter: "Incluido", pro: "Incluido", business: "Incluido" } },
  { fila: "Resultados guardados y descargables", feature: "resultados", valores: { starter: "Incluidos", pro: "Incluidos", business: "Incluidos" } },
  { fila: "Control de consumo y límites", feature: "consumo", valores: { starter: "Incluido", pro: "Incluido", business: "Incluido" } },
  { fila: "Workflows entre empleados", feature: "workflows", valores: { starter: null, pro: null, business: null } },
  { fila: "Soporte", valores: { starter: null, pro: null, business: null } },
];
export const PLANES_PREGUNTAS: [string, string][] = [
  ["¿Puedo cancelar cuando quiera?", "Sí. Cancelas desde «Mis oficinas» y la oficina sigue activa hasta el final del periodo que ya pagaste. Sin permanencia."],
  ["¿Cómo se factura?", "El cobro lo procesa Stripe de forma recurrente, en pesos mexicanos. Ves tus pagos y comprobantes en «Facturación», dentro de tu panel. Los detalles de facturación fiscal se anunciarán al abrir las ventas."],
  ["¿Qué pasa si llego al límite de uso?", "Las nuevas tareas se detienen y la pantalla te explica por qué. Nunca se gasta de más sin que lo sepas."],
];
