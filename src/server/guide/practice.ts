import { getTemplate } from "../catalog/data";

/** Práctica con datos INVENTADOS. Nunca se presenta como trabajo real de un cliente. */
export const PRACTICE_BUSINESS = "Café Luna";
export const DEMO_LABEL = "Ejemplo ilustrativo escrito por nosotros con datos inventados. No lo hizo una inteligencia artificial ni es trabajo real.";
export interface PracticeExample { negocio: string; pedido: string; entrega: string }
const EX: Record<string, { pedido: string; entrega: string }> = {
  "creador-anuncios": { pedido: "Escribe 3 anuncios cortos para el desayuno del fin de semana.", entrega: "1) «Sábado de café y pan recién hecho. ¡Ven a desayunar a Café Luna!»\n2) «Tu desayuno de fin de semana, sin prisa y con aroma a café.»\n3) «Pan caliente + café de especialidad = el mejor plan del sábado.»" },
  "agente-soporte": { pedido: "Una clienta pregunta a qué hora abren los domingos y si aceptan tarjeta.", entrega: "«¡Hola! Los domingos abrimos de 8:00 a 14:00 y sí aceptamos tarjeta. ¡Te esperamos!» (Borrador para que tú lo revises antes de enviarlo.)" },
  "controlador-inventario": { pedido: "Hay 4 kg de café, 2 litros de leche y 30 panes. Cada día se usan 1 kg, 3 litros y 20 panes. ¿Qué se acaba primero?", entrega: "La leche se acaba mañana y el pan en 1 día y medio. Conviene pedir leche hoy. El café alcanza para 4 días." },
  "estratega-contenido": { pedido: "Dame ideas de publicaciones para una semana.", entrega: "Lunes: foto del café del día. Martes: cómo se prepara el pan. Miércoles: pregunta a los vecinos su bebida favorita. Jueves: promo de 2x1 en galletas. Viernes: el equipo detrás de la barra." },
  "analista-conversiones": { pedido: "Entraron 200 personas a la tienda en línea y compraron 8. ¿Qué puede estar pasando?", entrega: "Compraron 4 de cada 100 visitas. Puede que el pago sea difícil o que falte confianza. Prueba mostrar opiniones y simplificar el pago." },
  "coordinador-proyectos": { pedido: "Organiza la apertura del segundo local.", entrega: "Paso 1: elegir el lugar. Paso 2: permisos. Paso 3: compras. Paso 4: contratar. Paso 5: inauguración. Cada paso con responsable y fecha." },
  "guionista-storytelling": { pedido: "Escribe un guion de 20 segundos sobre cómo nació Café Luna.", entrega: "«Todo empezó con una cafetera vieja y un sueño de barrio. Hoy, cada taza cuenta esa historia. Café Luna: donde empieza tu día.»" },
};
export function practiceExample(templateKey: string): PracticeExample {
  const e = EX[templateKey]; if (e) return { negocio: PRACTICE_BUSINESS, ...e };
  const t = getTemplate(templateKey); const d = t?.deliverables[0] ?? "un resumen";
  return { negocio: PRACTICE_BUSINESS, pedido: `Prepara: ${d.toLowerCase()} para ${PRACTICE_BUSINESS}.`, entrega: `Así se vería la entrega: ${d.toLowerCase()}, con datos inventados de ${PRACTICE_BUSINESS}. (Aquí no escribimos un ejemplo detallado para este empleado todavía.)` };
}
/** Instrucción que se envía si la inteligencia artificial real SÍ está conectada: deja claro que son datos inventados. */
export const practiceInstruction = (templateKey: string) => `PRÁCTICA con datos inventados. El negocio «${PRACTICE_BUSINESS}» no existe. ${practiceExample(templateKey).pedido}`;
