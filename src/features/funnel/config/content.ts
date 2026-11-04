import type { IconName } from "@/components/Icon";
import { planOf, PlanKey } from "@/server/agency/plans";
import { ESTADO_LABEL, estadoDe } from "./disponibilidad";

/**
 * TODO el texto editable de la landing vive en esta carpeta `config/` (no en los componentes). Reglas de honestidad: no inventar testimonios, cifras ni resultados;
 * no presentar como disponible lo que no lo está (usa disponibilidad.ts). Ver docs/funnel/EDITAR.md y docs/landing/.
 */
export const NAV: { href: string; label: string }[] = [
  { href: "#empleados", label: "Empleados" }, { href: "#cerebro", label: "Cerebro" }, { href: "#tareas", label: "Tareas" },
  { href: "#workflows", label: "Colaboración" }, { href: "#planes", label: "Planes" }, { href: "#faq", label: "Preguntas" },
];
export const HERO = {
  badge: "Oficinas de empleados IA para cada área de tu negocio",
  lineas: ["Tu empresa merece un equipo completo.", "Ahora puedes construirlo con IA."],
  lead: "Crea tu propia oficina digital, incorpora empleados IA especializados y organiza tareas de marketing, ventas, atención al cliente y operaciones desde una sola plataforma.",
  trust: [["shield", "Tú apruebas antes de publicar o enviar"], ["layers", "Cada oficina con sus datos separados"], ["card", "Pago seguro con Stripe"], ["mail", "Acceso por correo, sin contraseñas"]] as [IconName, string][],
  laptopAlt: "Panel de Crea tu Oficina IA: resumen de oficinas, empleados y estados (datos de ejemplo)",
};
export const PROBLEMAS: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: "clock", titulo: "No te alcanza el tiempo", texto: "Atiendes clientes, vendes, publicas y llevas las cuentas. Tu agenda la manda el negocio, no tú." },
  { icon: "workflow", titulo: "Haces lo mismo una y otra vez", texto: "Los mismos mensajes, los mismos formatos, las mismas preguntas. Cada repetición te quita energía para decidir." },
  { icon: "users", titulo: "No hay quién se especialice", texto: "Contratar a alguien de marketing, otro de ventas y otro de atención no cabe en un negocio que apenas despega." },
  { icon: "layers", titulo: "Los departamentos no se hablan", texto: "Lo que ventas promete no siempre lo sabe atención; lo que marketing publica no siempre lo respalda el inventario." },
  { icon: "grid", titulo: "Tus herramientas están dispersas", texto: "Un chat aquí, una hoja allá, notas en el celular. La información vive en diez lugares y en ninguno completa." },
  { icon: "help", titulo: "No sabes cómo usar la IA para trabajar", texto: "Abrir un chat en blanco y pedir lo correcto es otra habilidad. Falta una forma ordenada de pedir trabajo." },
];
export const PROBLEMA_CIERRE = "Una oficina IA no reemplaza tu criterio: lo libera. Tú decides; tu equipo prepara.";
export const CEREBRO = {
  eyebrow: "Tu Cerebro Empresarial",
  titulo: "Cuéntale a tu oficina quién eres, una sola vez",
  lead: "Registras tu negocio una vez. Después, tus empleados parten de esa información en lugar de empezar de cero en cada tarea.",
  items: [["Información del negocio", "A qué te dedicas, dónde y con quién compites."], ["Productos y servicios", "Qué vendes, con precios si los quieres incluir."], ["Público objetivo", "Quién es tu cliente ideal y cómo te encuentra."], ["Identidad y tono de marca", "Cómo hablas, y lo que nunca debes decir o prometer."], ["Objetivos", "Lo que quieres lograr este trimestre."], ["Documentos y conocimientos", "Políticas, catálogos y guías, autorizados empleado por empleado."]] as [string, string][],
  control: "Tú ves exactamente qué información recibe cada empleado y puedes editarla cuando quieras. Lo que registras en una oficina nunca llega a otra.",
  cuidado: "No pongas contraseñas ni datos privados de tus clientes: esta información se envía a la IA que usa tu oficina.",
};
export const PASOS: { titulo: string; texto: string }[] = [
  { titulo: "Eliges un plan", texto: "Conoces lo que incluye cada uno y escoges el que va con tu negocio." },
  { titulo: "Realizas el pago", texto: "Un pago seguro con Stripe. Nosotros nunca vemos los datos de tu tarjeta." },
  { titulo: "Recibes acceso por correo", texto: "Un enlace temporal de un solo uso. Sin contraseñas que recordar." },
  { titulo: "Configuras tu Cerebro Empresarial", texto: "Cuentas tu negocio, tus productos, tu tono y tus metas. Toma unos minutos." },
  { titulo: "Seleccionas a tus empleados", texto: "Eliges de los 41 puestos a quienes necesitas; agregas más cuando quieras." },
  { titulo: "Ejecutas tu primera tarea", texto: "Escoges una tarea guiada, revisas las respuestas prellenadas y la pides." },
  { titulo: "Recibes y revisas el resultado", texto: "Lo editas, lo descargas y decides qué hacer con él. Nada se publica solo." },
];
export const PASOS_NOTA = "Cada empleado trabaja cuando la IA de tu oficina está activa y, si lo necesita, conectas tus aplicaciones. Te mostramos el estado real de cada cosa y siempre pide permiso antes de publicar, enviar o gastar.";
export const CONFIANZA = {
  seguridad: [
    ["Datos separados por oficina", "Cada oficina guarda y consulta solo lo suyo."], ["Enlaces de acceso de un solo uso", "Duran 30 minutos y se guardan solo como huella, no como enlace."],
    ["Aprobación antes de actuar", "Las acciones que cambian algo en una aplicación externa esperan tu aprobación."], ["Límites de gasto", "El consumo de IA tiene presupuesto mensual y bloqueo al llegar al tope."],
    ["Pagos con Stripe", "La tarjeta se captura en Stripe; la plataforma no la ve."], ["Registro de actividad", "Lo que hace cada empleado queda registrado para que lo revises."]] as [string, string][],
  sinCertificaciones: "Aún no contamos con certificaciones de seguridad de terceros y por eso no las anunciamos.",
  casos: [["Cafetería o restaurante", "Anuncios de la promoción de la semana, respuestas a clientes y reseñas."], ["Tienda en línea", "Seguimiento posventa, respuestas a dudas y plan de contenido."], ["Negocio de servicios", "Respuestas a prospectos y propuestas comerciales ordenadas."], ["Agencia o consultor", "Varias oficinas, una por cliente, cada una con sus datos."]] as [string, string][],
  casosNota: "Son casos de uso ilustrativos para que imagines tu caso, no clientes reales.",
  demos: [["Panel de demostración", "Recórrelo sin registrarte, con datos de ejemplo.", "/panel-demo/inicio"], ["Ficha de cada empleado", "Responsabilidades, herramientas y estado, sin contratar nada.", "/panel-demo/empleados"]] as [string, string, string][],
  testimoniosVacio: "Todavía no publicamos testimonios. Cuando existan, serán de clientes reales y con su permiso.",
};
export const AVISOS_COMPRA: Record<string, string> = { cerrada: "Las compras todavía no están abiertas. Déjanos tu correo y te avisamos.", cancelada: "Cancelaste el pago: no se cobró nada. Cuando quieras, puedes volver a intentarlo.", error: "No pudimos abrir el pago. No se cobró nada; inténtalo de nuevo en unos minutos." };
/** Promoción opcional: texto de la franja superior, SOLO si defines FUNNEL_PROMO_TEXT en el servidor. Es texto: un descuento real requiere un cupón en Stripe (ver docs/funnel/STRIPE.md). */
export const promoText = () => (process.env.FUNNEL_PROMO_TEXT ?? "").trim().slice(0, 140);
export function ofertaBullets(p: ReturnType<typeof planOf>): { t: string }[] {
  return [{ t: "Oficina propia y privada, separada de las demás" }, { t: `Hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados IA` }, { t: "Aprobación antes de publicar, enviar o gastar" }, { t: "Panel con empleados, tareas, historial y consumo" }, { t: "Cancelas al final del periodo pagado, sin permanencia" }];
}
/** Preguntas frecuentes. La respuesta sobre funciones disponibles se arma sola desde disponibilidad.ts. */
export function faqItems(plan: PlanKey): [string, string][] {
  const p = planOf(plan); const lista = (e: ReturnType<typeof estadoDe>) => Object.entries(FEATURE_NOMBRES).filter(([k]) => estadoDe(k) === e).map(([, n]) => n);
  const d = lista("disponible"), r = lista("en_revision"), s = lista("proximamente");
  return [
    ["¿Necesito saber programar?", "No. Todo se hace desde el navegador con formularios y botones. Te guiamos paso a paso y no hay reuniones ni instalaciones."],
    ["¿Necesito contratar Claude o ChatGPT por separado?", "No para lo incluido en tu plan: tu oficina usa la IA que configura la plataforma y tú no manejas claves técnicas. Si ya usas una conversación general de IA, puedes seguir usándola; esto es otra forma de trabajar, con roles y contexto."],
    ["¿Cómo trabajan los empleados IA?", "Cada uno tiene un puesto, una especialidad, instrucciones y permisos. Recibe tu petición, usa la información que le autorizaste y te entrega una propuesta. Si algo implica actuar en una aplicación externa, te pide aprobación."],
    ["¿Qué es el Cerebro Empresarial?", `Es la ficha de tu negocio (productos, clientes, tono, metas) y los documentos que autorizas. Se registra una vez. Estado: ${ESTADO_LABEL[estadoDe("cerebro")].toLowerCase()} el uso automático de ese contexto en cada tarea.`],
    ["¿Puedo tener varias oficinas?", "Sí. Cada oficina tiene sus propios datos, empleados y consumo, y se administra desde tu cuenta. Una oficina pausada o cancelada no afecta a las demás."],
    ["¿Cómo se controla el consumo?", "Cada oficina tiene un presupuesto mensual de IA y topes de ejecuciones. Al llegar al límite, las nuevas tareas se detienen y se te explica por qué. No hay consumo ilimitado."],
    ["¿Qué pasa si cancelo?", "Cancelas desde «Mis oficinas» al final del periodo ya pagado, o la pausas, sin afectar tus otras oficinas. Tus datos se conservan."],
    ["¿Mis empleados publican o envían mensajes automáticamente?", "No. Hoy preparan propuestas y borradores; publicar o enviar lo decides tú. Las integraciones para actuar en plataformas externas están como «próximamente» y, cuando existan, esperarán tu aprobación."],
    ["¿Qué funciones están disponibles actualmente?", `Disponibles: ${d.join(", ") || "—"}. En revisión: ${r.join(", ") || "—"}. Próximamente: ${s.join(", ") || "—"}.`],
    ["¿Me garantizan clientes o ganancias?", "No. Te damos herramientas de trabajo; los resultados dependen de ti y de tu negocio."],
    ["¿Qué pasa si no me llega el correo de acceso?", "Revisa «Spam» y pide otro enlace en «Iniciar sesión» con el correo que usaste al pagar."],
    ["¿Qué incluye hoy la oferta a la venta?", `Una oficina propia (plan ${p.label}) con hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados IA, su panel, aprobaciones y topes de gasto.`],
  ];
}
export const FEATURE_NOMBRES: Record<string, string> = { oficinas: "oficinas con panel y aprobaciones", empleados: "catálogo de 41 empleados", fichaNegocio: "ficha del negocio y documentos", cerebro: "uso del contexto en cada tarea", tareasGuiadas: "8 tareas guiadas", resultados: "resultados guardados y descargables", consumo: "pantalla de consumo y límites", workflows: "workflows entre empleados", integraciones: "publicar o enviar en plataformas externas", afiliados: "programa de afiliados (solo lista de interés)", servicioGestionado: "servicio gestionado (solo solicitud de diagnóstico)" };
