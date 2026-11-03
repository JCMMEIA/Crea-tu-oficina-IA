export type Availability = "composio" | "oficial-directa" | "no-disponible" | "interna";
export interface ToolSpec { action: string; description: string; kind: "read" | "write" | "draft"; schema: Record<string, unknown>; composioSlug?: string }
export interface ToolkitSpec {
  key: string; label: string; category: string; availability: Availability; note: string; tools: ToolSpec[];
}
const obj = (props: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties: props, required });
const str = (d: string) => ({ type: "string", description: d });

/** Catálogo honesto: "disponible" significa que existe vía y adaptador, NO que esté probado con una cuenta real. */
export const TOOLKITS: ToolkitSpec[] = [
  { key: "inventario", label: "Inventario de la empresa", category: "Operaciones", availability: "interna", note: "Función propia de la plataforma: usa el inventario que la empresa carga por archivo. No necesita conexión externa.", tools: [
    { action: "leer_inventario", description: "Leer el inventario actual (productos, existencias, mínimos y máximos)", kind: "read", schema: obj() },
    { action: "calcular_resurtido", description: "Calcular qué productos están bajo el mínimo y cuántas unidades faltan para llegar al máximo (cálculo exacto del sistema)", kind: "read", schema: obj() },
    { action: "guardar_borrador_resurtido", description: "Guardar un BORRADOR de resurtido con los productos bajo el mínimo (el sistema calcula las cantidades; no se envía nada)", kind: "draft", schema: obj({ nota: str("Nota opcional") }) },
    { action: "solicitar_resurtido", description: "Pedir al propietario que apruebe el borrador de resurtido", kind: "write", schema: obj({ draft_id: str("ID del borrador") }, ["draft_id"]) }] },
  { key: "meta_ads", label: "Meta Ads", category: "Publicidad y marketing", availability: "composio", note: "Vía Composio. Requiere cuenta publicitaria autorizada por la empresa.", tools: [
    { action: "get_campaign_insights", description: "Métricas de campañas (CPM, CTR, CPC, CPA, ROAS)", kind: "read", schema: obj({ date_range: str("Rango, p. ej. last_7d") }) },
    { action: "pause_ad", description: "Pausar un anuncio", kind: "write", schema: obj({ ad_id: str("ID del anuncio") }, ["ad_id"]) },
    { action: "update_budget", description: "Cambiar presupuesto de una campaña", kind: "write", schema: obj({ campaign_id: str("ID"), daily_budget: { type: "number" } }, ["campaign_id", "daily_budget"]) },
    { action: "publish_ad", description: "Publicar un anuncio", kind: "write", schema: obj({ ad_id: str("ID del anuncio") }, ["ad_id"]) }] },
  { key: "instagram", label: "Instagram", category: "Publicidad y marketing", availability: "composio", note: "Vía Composio (cuentas Business).", tools: [] },
  { key: "facebook", label: "Facebook", category: "Publicidad y marketing", availability: "composio", note: "Vía Composio (páginas).", tools: [] },
  { key: "tiktok", label: "TikTok", category: "Publicidad y marketing", availability: "no-disponible", note: "Solo cuando exista acceso autorizado de TikTok para la empresa. Pendiente.", tools: [] },
  { key: "higgsfield", label: "Higgsfield", category: "Publicidad y marketing", availability: "no-disponible", note: "Según capacidades oficiales: hoy solo consulta de saldo y generaciones; no genera medios por API de terceros. Pendiente.", tools: [] },
  { key: "shopify", label: "Shopify", category: "Comercio", availability: "composio", note: "Vía Composio.", tools: [
    { action: "list_orders", description: "Listar pedidos recientes", kind: "read", schema: obj({ status: str("Estado") }) },
    { action: "get_inventory_levels", description: "Consultar inventario", kind: "read", schema: obj() },
    { action: "create_discount", description: "Crear un descuento", kind: "write", schema: obj({ code: str("Código"), percent: { type: "number" } }, ["code", "percent"]) },
    { action: "update_price", description: "Cambiar precio de un producto", kind: "write", schema: obj({ product_id: str("ID"), price: { type: "number" } }, ["product_id", "price"]) }] },
  { key: "woocommerce", label: "WooCommerce", category: "Comercio", availability: "composio", note: "Vía Composio si el toolkit está disponible para tu cuenta; sin verificar.", tools: [] },
  { key: "mercado_libre", label: "Mercado Libre", category: "Comercio", availability: "no-disponible", note: "Existe API oficial, pero no hay adaptador verificado todavía. Pendiente.", tools: [] },
  { key: "google_drive", label: "Google Drive", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [] },
  { key: "google_sheets", label: "Google Sheets", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [
    { action: "read_range", description: "Leer un rango de una hoja", kind: "read", schema: obj({ spreadsheet_id: str("ID"), range: str("A1:D20") }, ["spreadsheet_id", "range"]) },
    { action: "append_rows", description: "Agregar filas a una hoja", kind: "write", schema: obj({ spreadsheet_id: str("ID"), values: { type: "array" } }, ["spreadsheet_id", "values"]) },
    { action: "update_record", description: "Actualizar un registro", kind: "write", schema: obj({ spreadsheet_id: str("ID"), range: str("Rango"), values: { type: "array" } }, ["spreadsheet_id", "range", "values"]) }] },
  { key: "gmail", label: "Gmail", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [
    { action: "search_threads", description: "Buscar correos", kind: "read", schema: obj({ query: str("Búsqueda") }, ["query"]) },
    { action: "send_message", description: "Enviar un correo", kind: "write", schema: obj({ to: str("Destinatario"), subject: str("Asunto"), body: str("Cuerpo") }, ["to", "subject", "body"]) }] },
  { key: "google_calendar", label: "Google Calendar", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [
    { action: "list_events", description: "Listar eventos", kind: "read", schema: obj({ from: str("Desde"), to: str("Hasta") }) },
    { action: "create_event", description: "Crear un evento", kind: "write", schema: obj({ title: str("Título"), start: str("Inicio ISO"), end: str("Fin ISO") }, ["title", "start", "end"]) }] },
  { key: "notion", label: "Notion", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [] },
  { key: "github", label: "GitHub", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [] },
  { key: "asana", label: "Asana", category: "Productividad", availability: "composio", note: "Vía Composio.", tools: [
    { action: "list_tasks", description: "Listar tareas", kind: "read", schema: obj() },
    { action: "create_task", description: "Crear una tarea", kind: "write", schema: obj({ name: str("Nombre") }, ["name"]) }] },
  { key: "whatsapp_business", label: "WhatsApp Business", category: "Comunicación", availability: "oficial-directa", note: "Solo con la API oficial de WhatsApp Business (Meta). Adaptador pendiente; requiere número y cuenta verificados.", tools: [
    { action: "send_message", description: "Enviar un mensaje de WhatsApp", kind: "write", schema: obj({ to: str("Teléfono"), text: str("Texto") }, ["to", "text"]) }] },
  { key: "manychat", label: "ManyChat", category: "Comunicación", availability: "composio", note: "Sujeto a disponibilidad del toolkit; sin verificar.", tools: [] },
  { key: "slack", label: "Slack", category: "Comunicación", availability: "composio", note: "Vía Composio.", tools: [] },
];
export const getToolkit = (k: string) => TOOLKITS.find((t) => t.key === k);
