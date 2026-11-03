import { SERVICE_CARDS, getCard } from "./services";
import { getTemplate } from "../catalog/data";
import { norm } from "../messaging/interpreter";

/**
 * Asistente guiado POR REGLAS (palabras clave). NO es inteligencia artificial y no finge serlo: lo dice en cada respuesta.
 * Propone; nunca cambia nada solo: cada propuesta lleva botones que la persona debe pulsar.
 */
export const ASSISTANT_NOTE = "Soy un asistente guiado con reglas sencillas (no es inteligencia artificial). Cuando la conectes, podré entender más cosas.";
export interface Suggestion { label: string; href?: string; hire?: string[] }
export interface AssistantReply { understood: boolean; text: string; services: string[]; employees: string[]; suggestions: Suggestion[]; note: string }

const BUSINESS: [RegExp, string][] = [
  [/restaurante|cafeteria|cafe |comida|panaderia|taqueria|bar\b/, "restaurantes y cafeterías"], [/tienda|ropa|joyeria|e-?commerce|shopify|boutique/, "tiendas"],
  [/inmobiliaria|casas|departamentos|bienes raices/, "inmobiliarias"], [/clinica|dentista|consultorio|medic|doctor|salud/, "clínicas y consultorios"],
  [/gimnasio|salon|belleza|estetica|spa/, "negocios de belleza y bienestar"], [/escuela|cursos|academia|educacion/, "escuelas y cursos"], [/hotel|viajes|turismo/, "hoteles y viajes"],
];
const SERVICES: [RegExp, string][] = [
  [/anuncio|publicidad|campan|ads\b|facebook ads|instagram ads/, "anuncios"], [/mensaje|whatsapp|chat|responder|contestar|correo/, "mensajes"],
  [/inventario|stock|existencia|bodega|almacen/, "inventarios"], [/venta|vender|analizar|analisis|numeros/, "ventas"], [/tarea|organizar|proyecto|pendiente|agenda/, "tareas"],
  [/contenido|redes|publicacion|video|reels|tiktok|guion/, "contenido"], [/atencion|soporte|queja|posventa|reclamo|servicio al cliente/, "atencion"],
];
const MARKETING = { services: ["anuncios", "contenido", "ventas"], employees: ["creador-anuncios", "analista-meta-ads", "estratega-contenido"] };
const nameOf = (k: string) => (getTemplate(k)?.name ?? k).toLowerCase();
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

export function assist(raw: string): AssistantReply {
  const t = norm(raw); const base = { note: ASSISTANT_NOTE };
  if (t.length < 3) return { ...base, understood: false, text: "Cuéntame qué quieres ofrecer o qué necesitas. Por ejemplo: «Quiero vender servicios de marketing a restaurantes».", services: [], employees: [], suggestions: SERVICE_CARDS.slice(0, 4).map((c) => ({ label: `${c.icon} ${c.title}`, hire: c.employees.slice(0, 3) })) };
  // Acciones directas
  const go: [RegExp, Suggestion, string][] = [
    [/(agregar|crear|nuevo|nueva|anadir|sumar).{0,14}cliente|mi primer cliente/, { label: "Agregar un cliente", href: "/agencia/clientes" }, "Para agregar un cliente solo necesitas su nombre. Te llevo."],
    [/propuesta|cotizacion|presupuesto para/, { label: "Preparar una propuesta", href: "/agencia/propuestas" }, "Puedo llevarte a preparar una propuesta con tus servicios y precios."],
    [/whatsapp|telegram|celular/, { label: "Conectar mi celular", href: "/celular" }, "Puedes hablar con tus empleados desde el celular. Te llevo a conectarlo."],
    [/conectar|shopify|gmail|drive|calendario|instagram|facebook/, { label: "Conecta tus aplicaciones", href: "/agencia/conexiones" }, "Las aplicaciones se conectan por cada cliente. Te llevo a verlas."],
    [/logo|colores|marca|nombre de mi/, { label: "Cambiar mi marca", href: "/agencia/identidad" }, "Tu nombre, logo y colores se cambian aquí."],
  ];
  const wantsService = SERVICES.some(([re]) => re.test(t)) || /marketing|mercadotecnia/.test(t) || BUSINESS.some(([re]) => re.test(t));
  const wantsConnect = /conectar|vincular|enlazar|activar/.test(t);
  for (const [re, s, text] of go) if (re.test(t) && (!wantsService || wantsConnect) && !/vender servicios|ofrecer/.test(t)) return { ...base, understood: true, text, services: [], employees: [], suggestions: [s] };
  const biz = BUSINESS.find(([re]) => re.test(t))?.[1];
  let services = SERVICES.filter(([re]) => re.test(t)).map(([, id]) => id);
  let employees: string[] = [];
  if (/marketing|mercadotecnia/.test(t)) { services = [...new Set([...MARKETING.services, ...services])]; employees = [...MARKETING.employees]; }
  if (!employees.length) employees = [...new Set(services.flatMap((s) => getCard(s)?.employees.slice(0, 2) ?? []))].slice(0, 4);
  if (!services.length && !biz) return { ...base, understood: false, text: "No estoy seguro de entender. ¿Cuál de estas cosas quieres ofrecer?", services: [], employees: [], suggestions: SERVICE_CARDS.map((c) => ({ label: `${c.icon} ${c.title}`, hire: c.employees.slice(0, 3) })) };
  if (!employees.length) { employees = ["creador-anuncios", "agente-soporte", "estratega-contenido"]; services = ["anuncios", "atencion", "contenido"]; }
  const names = employees.map(nameOf);
  const text = `¡Perfecto!${biz ? ` Para ${biz}` : ""} te recomiendo estos ${names.length} empleados: ${list(names)}. Pulsa el botón para agregarlos a tu oficina de práctica; no se cambia nada hasta que tú lo confirmes.`;
  return { ...base, understood: true, text, services, employees, suggestions: [{ label: `Agregar los ${names.length} empleados`, hire: employees }, ...employees.map((k) => ({ label: `Solo ${nameOf(k)}`, hire: [k] }))] };
}
