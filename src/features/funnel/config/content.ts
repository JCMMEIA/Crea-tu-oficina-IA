import type { IconName } from "@/components/Icon";
import { planOf, PlanKey } from "@/server/agency/plans";

/**
 * TODO el texto editable de la landing vive aquí (no en los componentes). Reglas de honestidad: no inventar testimonios, cifras de ventas ni resultados;
 * no prometer que los empleados están operativos antes de que las integraciones reales estén verificadas. Ver docs/funnel/EDITAR.md.
 */
export const HERO = {
  badge: "Tu oficina IA, lista para configurar en minutos",
  lineas: ["Crea tu oficina de empleados", "de inteligencia artificial", "y automatiza tu negocio"],
  lead: "Configura una oficina con empleados IA especializados para ayudarte con tareas de marketing, ventas, atención al cliente y más, desde un solo lugar.",
  trust: [["card", "Pago seguro (Stripe)"], ["bolt", "Activación automática"], ["users", "Sin reuniones"], ["shield", "Sin permanencia"]] as [IconName, string][],
  laptopAlt: "Panel de Crea tu Oficina IA: resumen de oficinas, empleados y estados (datos de ejemplo)",
};
export const BENEFICIOS: [IconName, string, string][] = [
  ["bolt", "Automatiza tu operación", "Delega tareas de marketing, ventas y atención a empleados IA. Tú apruebas lo importante."],
  ["sparkle", "Configura tu oficina fácilmente", "Eliges tu negocio, una plantilla y tus empleados, con valores ya sugeridos."],
  ["users", "Sin reuniones ni instalaciones complicadas", "Pagas, recibes tu acceso por correo y todo se hace desde el navegador."],
  ["layers", "Administra múltiples oficinas", "Crea otras oficinas para otros negocios, cada una con sus datos y su suscripción."],
];
export const PASOS: [IconName, string, string][] = [
  ["cursor", "Descubres Crea tu Oficina IA", "Conoces cómo funciona y ves el panel por dentro, sin registrarte."],
  ["card", "Realizas tu compra", "Un solo pago seguro con Stripe. No necesitas crear cuenta antes."],
  ["building", "Se crea automáticamente tu oficina", "Al confirmarse el pago, tu oficina privada se crea sola."],
  ["mail", "Recibes acceso seguro por correo", "Un enlace temporal de un solo uso. Sin contraseñas que recordar."],
  ["settings", "Configuras tus empleados y empiezas", "Nombre, negocio, plantilla y equipo, paso a paso."],
];
export const PASOS_NOTA = "Cada empleado trabaja cuando conectas la IA y tus aplicaciones, y siempre te pide permiso antes de publicar, enviar o gastar. Te mostramos el estado real de cada conexión.";
export const AVISOS_COMPRA: Record<string, string> = { cerrada: "Las compras todavía no están abiertas. Déjanos tu correo y te avisamos.", cancelada: "Cancelaste el pago: no se cobró nada. Cuando quieras, vuelve a intentarlo.", error: "No pudimos abrir el pago. No se cobró nada. Inténtalo de nuevo en unos minutos." };
/** Promoción opcional: texto de la franja superior, SOLO si defines FUNNEL_PROMO_TEXT en el servidor. Es texto: un descuento real requiere un cupón en Stripe (ver docs/funnel/STRIPE.md). */
export const promoText = () => (process.env.FUNNEL_PROMO_TEXT ?? "").trim().slice(0, 140);
export function ofertaBullets(p: ReturnType<typeof planOf>): { t: string; fuerte?: string[] }[] {
  return [{ t: "Oficina propia y privada, separada de las demás" }, { t: `Hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados IA` }, { t: "Aprobación antes de publicar, enviar o gastar" }, { t: "Tope mensual de uso de IA propio, sin sorpresas" }, { t: "Acceso por correo: sin contraseña ni registro previo" }, { t: "Crea más oficinas, cada una con su suscripción" }];
}
export function faqItems(plan: PlanKey): [string, string][] {
  const p = planOf(plan);
  return [
    ["¿Qué recibo exactamente al pagar?", `Una oficina IA propia y privada (plan ${p.label}): hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados IA, con su panel, sus aprobaciones y su tope de uso de IA. Te llega un correo con tu enlace de acceso; no creas cuenta ni contraseña.`],
    ["¿Los empleados IA ya están trabajando?", "Cada empleado trabaja cuando tu oficina tiene la IA activa y conectas tus aplicaciones. Antes de publicar, enviar o gastar, siempre te pide tu permiso. Te decimos con claridad el estado de cada conexión."],
    ["¿Tengo que saber de tecnología?", "No. Al entrar te guiamos paso a paso con valores sugeridos. No hay juntas ni demostraciones: todo es autoservicio."],
    ["¿Puedo tener más de una oficina?", "Sí. Desde tu panel creas otra oficina (con su propia suscripción) y entras a cualquiera con un clic. Cada una tiene sus propios datos."],
    ["¿Puedo cancelar o pausar?", "Sí, desde «Mis oficinas»: cancelas una oficina al final del periodo pagado, o la pausas, sin afectar las demás. Tus datos se conservan."],
    ["¿Me garantizan clientes o ganancias?", "No. Te damos una herramienta de trabajo; los resultados dependen de ti."],
    ["¿Qué pasa si no me llega el correo?", "Revisa «Spam» y pide otro enlace en «Iniciar sesión» con el correo que usaste al pagar."],
  ];
}
