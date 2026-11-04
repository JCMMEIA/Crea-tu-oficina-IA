/**
 * Eventos de conversión del funnel (única lista; los nombres NO se escriben sueltos en los componentes).
 *   Medición propia, anónima: sin cookies ni IP. Tablas: `events` (visitas y clics), `checkout_intents` (pagos iniciados), `orders` (pagos confirmados por webhook),
 *   `agencies` + tareas (oficinas activadas). Ver docs/funnel/EVENTOS.md.
 */
export const FUNNEL_EVENTS = {
  visita: "visita",           // vista de la landing (evento «visita» con ruta «/»)
  clic: "cta_click",          // clic en un botón; el identificador va en props.cta
  planVisto: "plan_visto",    // vista de la página de planes
} as const;
/** Identificadores de botón de compra: SIEMPRE empiezan con «comprar-» (así los cuenta el panel de conversión). */
export const BUY_CTA = (donde: string) => `comprar-${donde}`;
export const BUY_SPOTS = ["header", "header-movil", "hero", "oferta", "final"] as const;

/** Identificadores de CTA de la landing (props.cta del evento «cta_click»). Los de compra siempre empiezan con «comprar-» (los cuenta el panel de conversión). */
export const PLAN_CTA = (tier: string) => `plan-${tier}`;            // selección de plan (starter | pro | business)
export const CTA_EMPLEADO = "empleado-conocer";                       // «Conocer empleado»
export const CTA_TAREA = "tarea-explorada";                           // «Quiero usar estas tareas» tras explorar una demostración
