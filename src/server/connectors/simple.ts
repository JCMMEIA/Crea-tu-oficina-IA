import { EMPLOYEES } from "../catalog/data";

/** «Conecta tus aplicaciones»: 9 tarjetas en palabras sencillas. El estado SIEMPRE es el real. */
export type AppState = "conectada" | "lista" | "necesita" | "proximamente";
export interface SimpleApp { id: string; icon: string; title: string; para: string; permisos: string; toolkit?: string; channel?: "telegram" | "whatsapp"; soon?: boolean }
export const SIMPLE_APPS: SimpleApp[] = [
  { id: "whatsapp", icon: "💬", title: "WhatsApp", para: "Hablar con tus empleados desde el celular y recibir sus avisos.", permisos: "Leer lo que tú le escribas y responderte. No escribe a tus clientes sin tu permiso.", channel: "whatsapp", toolkit: "whatsapp_business" },
  { id: "telegram", icon: "✈️", title: "Telegram", para: "Lo mismo que WhatsApp, más fácil de activar.", permisos: "Leer lo que tú le escribas y responderte.", channel: "telegram" },
  { id: "instagram", icon: "📸", title: "Instagram", para: "Que tus empleados vean las publicaciones del negocio.", permisos: "Ver la cuenta del negocio. Publicar solo con tu permiso.", toolkit: "instagram" },
  { id: "facebook", icon: "👍", title: "Facebook", para: "Que tus empleados vean la página del negocio.", permisos: "Ver la página. Publicar solo con tu permiso.", toolkit: "facebook" },
  { id: "shopify", icon: "🛍️", title: "Shopify (tienda en línea)", para: "Que vean pedidos, productos e inventario.", permisos: "Ver pedidos y productos. Cambiar precios o crear descuentos solo con tu permiso.", toolkit: "shopify" },
  { id: "drive", icon: "📁", title: "Google Drive", para: "Que lean tus documentos y hojas de cálculo.", permisos: "Ver los archivos que elijas.", toolkit: "google_drive" },
  { id: "gmail", icon: "✉️", title: "Gmail", para: "Que lean y preparen correos.", permisos: "Leer correos y preparar borradores. Enviar solo con tu permiso.", toolkit: "gmail" },
  { id: "calendario", icon: "📅", title: "Calendario", para: "Que vean tu agenda y propongan citas.", permisos: "Ver eventos. Crear uno solo con tu permiso.", toolkit: "google_calendar" },
];
export const OTHER_APPS: SimpleApp[] = [
  { id: "sheets", icon: "📊", title: "Hojas de cálculo de Google", para: "Leer y llenar tablas.", permisos: "Ver tus hojas. Escribir solo con tu permiso.", toolkit: "google_sheets" },
  { id: "notion", icon: "📝", title: "Notion", para: "Leer tus notas.", permisos: "Ver las páginas que elijas.", toolkit: "notion" },
  { id: "slack", icon: "💼", title: "Slack", para: "Avisos en el chat del equipo.", permisos: "Leer y escribir en los canales que elijas.", toolkit: "slack" },
  { id: "asana", icon: "🗂️", title: "Asana", para: "Ver y crear tareas del equipo.", permisos: "Ver tareas. Crear con tu permiso.", toolkit: "asana" },
  { id: "woo", icon: "🛒", title: "WooCommerce", para: "Otra tienda en línea.", permisos: "Ver pedidos y productos.", toolkit: "woocommerce" },
  { id: "tiktok", icon: "🎵", title: "TikTok", para: "Ver cuentas de anuncios.", permisos: "—", soon: true },
  { id: "meli", icon: "🏷️", title: "Mercado Libre", para: "Ver ventas y publicaciones.", permisos: "—", soon: true },
];
export interface AppEnv { composioReady: boolean; channels: { telegram: boolean; whatsapp: boolean }; connected: Set<string> }
export interface AppView { app: SimpleApp; state: AppState; label: string; icon: string; button: string; steps: string[]; employees: string[] }

const STEPS_COMPOSIO = ["Quien instaló la plataforma crea una cuenta en el servicio que conecta las aplicaciones (se llama Composio).", "Copia la clave que le dan en el archivo de configuración de la plataforma (ver docs/GUIA_CLAUDE_Y_COMPOSIO.md).", "Reinicia la plataforma y vuelve a esta pantalla: el botón Conectar quedará activo."];
const STEPS = {
  telegram: ["Se crea un bot gratis hablando con @BotFather en Telegram.", "Se pega su clave en el archivo de configuración y se registra la conexión automática (ver docs/MENSAJERIA.md).", "Vuelve aquí y pulsa Conectar para vincular tu Telegram con un código de un solo uso."],
  whatsapp: ["Hace falta una cuenta de WhatsApp para empresas (de Meta) y un número que no se use en la app normal de WhatsApp.", "Meta pide verificar el negocio y aprobar plantillas de mensajes; puede tardar y tener costo por mensaje.", "Con eso, quien instaló la plataforma guarda las claves (ver docs/MENSAJERIA.md). Después pulsa Conectar."],
};
/** Empleados que podrán usar la aplicación, con nombres de puesto. */
export function employeesUsing(app: SimpleApp): string[] {
  if (app.channel === "telegram") return ["Todos tus empleados (tú les escribes desde el celular)"];
  const tk = app.toolkit; if (!tk) return [];
  const names = EMPLOYEES.filter((e) => e.connections.some((c) => c.toolkit === tk)).map((e) => e.name);
  return app.channel === "whatsapp" ? ["Todos (tú les escribes por WhatsApp)", ...names] : names.slice(0, 6);
}
export function appView(app: SimpleApp, env: AppEnv): AppView {
  const employees = employeesUsing(app); const mk = (state: AppState, label: string, icon: string, button: string, steps: string[] = []): AppView => ({ app, state, label, icon, button, steps, employees });
  if (app.soon) return mk("proximamente", "Próximamente", "🕒", "Avísame cuando esté");
  if (app.channel) { const ok = env.channels[app.channel]; return ok ? mk("lista", "Lista para conectar", "👉", "Conectar") : mk("necesita", "Necesita que la activen", "🔧", "Ver cómo activarla", STEPS[app.channel]); }
  if (app.toolkit && env.connected.has(app.toolkit)) return mk("conectada", "Conectada", "✅", "Probar conexión");
  return env.composioReady ? mk("lista", "Lista para conectar", "👉", "Conectar") : mk("necesita", "Necesita que la activen", "🔧", "Ver cómo activarla", STEPS_COMPOSIO);
}
