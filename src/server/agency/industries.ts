/** Plantillas de implementación por industria: paquetes de servicios sugeridos. Los precios son puntos de partida editables, NO promesas de ingreso. */
export interface IndustryService { name: string; description: string; templateKeys: string[]; suggestedPriceUsd: number; unit: "mes" | "proyecto"; tasksPerMonth: number }
export interface IndustryTemplate { key: string; name: string; description: string; services: IndustryService[] }

export const INDUSTRIES: IndustryTemplate[] = [
  { key: "ecommerce", name: "Comercio electrónico", description: "Tiendas online que venden por redes y mensajería.", services: [
    { name: "Análisis de anuncios y recomendaciones", description: "Revisión de campañas con datos conectados y propuestas de mejora para aprobación.", templateKeys: ["analista-meta-ads", "optimizador-campanas"], suggestedPriceUsd: 300, unit: "mes", tasksPerMonth: 20 },
    { name: "Contenido y guiones de producto", description: "Guiones y calendario de contenido alineados a la marca.", templateKeys: ["estratega-contenido", "guionista-storytelling"], suggestedPriceUsd: 250, unit: "mes", tasksPerMonth: 30 },
    { name: "Control de inventario y pedidos", description: "Alertas de stock y seguimiento de pedidos en riesgo.", templateKeys: ["controlador-inventario", "coordinador-pedidos"], suggestedPriceUsd: 200, unit: "mes", tasksPerMonth: 30 }] },
  { key: "servicios-locales", name: "Servicios locales (clínicas, salones, talleres)", description: "Negocios que viven de citas y recomendaciones.", services: [
    { name: "Atención y seguimiento de clientes", description: "Respuestas redactadas para aprobación y seguimiento posventa.", templateKeys: ["agente-soporte", "seguimiento-posventa"], suggestedPriceUsd: 200, unit: "mes", tasksPerMonth: 40 },
    { name: "Seguimiento de prospectos", description: "Recordatorios y mensajes de seguimiento sin duplicar contactos.", templateKeys: ["seguimiento-prospectos", "admin-crm"], suggestedPriceUsd: 180, unit: "mes", tasksPerMonth: 30 }] },
  { key: "inmobiliaria", name: "Inmobiliarias", description: "Captación y seguimiento de interesados.", services: [
    { name: "Captación y seguimiento de interesados", description: "Calificación de prospectos y seguimientos redactados.", templateKeys: ["vendedor-conversacional", "seguimiento-prospectos"], suggestedPriceUsd: 350, unit: "mes", tasksPerMonth: 40 },
    { name: "Investigación de mercado local", description: "Informes de mercado con fuentes citadas.", templateKeys: ["investigador-mercado", "analista-competidores"], suggestedPriceUsd: 400, unit: "proyecto", tasksPerMonth: 6 }] },
  { key: "marca-personal", name: "Marcas personales y creadores", description: "Estrategia de contenido y conversión.", services: [
    { name: "Estrategia y guiones de contenido", description: "Pilares, calendario y guiones.", templateKeys: ["estratega-contenido", "guionista-storytelling", "director-creativo"], suggestedPriceUsd: 280, unit: "mes", tasksPerMonth: 30 }] },
  { key: "finanzas-pyme", name: "Finanzas para pymes", description: "Orden financiero con datos que la empresa carga.", services: [
    { name: "Reporte financiero y de gastos", description: "Clasificación de gastos y tablero de indicadores a partir de hojas conectadas.", templateKeys: ["analista-gastos", "supervisor-indicadores"], suggestedPriceUsd: 300, unit: "mes", tasksPerMonth: 12 }] },
];
export const getIndustry = (k: string) => INDUSTRIES.find((i) => i.key === k);
