import { EMPLOYEES, EmployeeTemplate, getTemplate } from "../catalog/data";

/** Tarjetas de «¿Qué quieres ofrecer?». Cada una recomienda empleados. Textos pensados para quien nunca vio tecnología. */
export interface ServiceCard { id: string; icon: string; title: string; plain: string; example: string; employees: string[]; suggestedPriceUsd: number }
export const SERVICE_CARDS: ServiceCard[] = [
  { id: "anuncios", icon: "📣", title: "Crear anuncios", plain: "Preparar los textos y las ideas de los anuncios de un negocio.", example: "«Escribe 3 anuncios para el desayuno del fin de semana».", employees: ["creador-anuncios", "guionista-storytelling", "analista-meta-ads"], suggestedPriceUsd: 250 },
  { id: "mensajes", icon: "💬", title: "Contestar mensajes", plain: "Redactar respuestas para los clientes que escriben por chat o correo. Tú decides qué se envía.", example: "«Un cliente pregunta a qué hora abren».", employees: ["vendedor-conversacional", "agente-soporte"], suggestedPriceUsd: 200 },
  { id: "inventarios", icon: "📦", title: "Revisar inventarios", plain: "Vigilar qué productos se están acabando y avisar a tiempo.", example: "«¿Qué productos se acaban esta semana?».", employees: ["controlador-inventario", "coordinador-pedidos"], suggestedPriceUsd: 200 },
  { id: "ventas", icon: "📈", title: "Analizar ventas", plain: "Mirar cómo van las ventas y explicar qué mejorar, con palabras simples.", example: "«¿Qué producto se vendió más este mes?».", employees: ["analista-conversiones", "especialista-rentabilidad"], suggestedPriceUsd: 300 },
  { id: "tareas", icon: "✅", title: "Organizar tareas", plain: "Ordenar el trabajo del equipo y recordar lo que falta.", example: "«Haz una lista de lo que hay que hacer esta semana».", employees: ["coordinador-proyectos", "supervisor-tareas"], suggestedPriceUsd: 180 },
  { id: "contenido", icon: "🎬", title: "Crear contenido", plain: "Pensar publicaciones, guiones y calendarios para las redes.", example: "«Dame ideas de publicaciones para una semana».", employees: ["estratega-contenido", "guionista-storytelling", "director-creativo"], suggestedPriceUsd: 250 },
  { id: "atencion", icon: "🎧", title: "Atender clientes", plain: "Dar seguimiento después de una compra y resolver quejas con amabilidad.", example: "«Escribe un mensaje para agradecer una compra».", employees: ["agente-soporte", "seguimiento-posventa", "analista-satisfaccion"], suggestedPriceUsd: 200 },
];
export const getCard = (id: string) => SERVICE_CARDS.find((c) => c.id === id);

/** Explicación en 4 frases cotidianas: qué hace, para qué sirve, qué necesita y qué entrega. */
export interface PlainEmployee { key: string; name: string; que: string; paraQue: string; necesita: string; entrega: string; needsApps: string[] }
const PLAIN: Record<string, Omit<PlainEmployee, "key" | "name" | "needsApps">> = {
  "creador-anuncios": { que: "Escribe los textos de los anuncios de tu cliente.", paraQue: "Para que tengas varias opciones listas sin empezar de cero.", necesita: "Que le cuentes qué vende el negocio y a quién le quiere vender.", entrega: "Varios anuncios listos para que tú elijas." },
  "guionista-storytelling": { que: "Inventa historias cortas para videos y publicaciones.", paraQue: "Para que la gente recuerde el negocio y se interese.", necesita: "Saber cómo es el negocio y cómo le gusta hablar.", entrega: "Tres versiones de un guion para que elijas." },
  "analista-meta-ads": { que: "Revisa los anuncios que ya están publicados y dice cuáles funcionan.", paraQue: "Para no gastar dinero en anuncios que no sirven.", necesita: "Que conectes la cuenta de anuncios del cliente (con su permiso).", entrega: "Un resumen con qué mejorar. Si hay que cambiar algo, te pide permiso." },
  "vendedor-conversacional": { que: "Prepara respuestas amables para quien pregunta por los productos.", paraQue: "Para contestar rápido y no perder ventas.", necesita: "La lista de productos y precios del negocio.", entrega: "Respuestas listas. Tú decides cuáles se envían." },
  "agente-soporte": { que: "Contesta dudas de clientes con la información del negocio.", paraQue: "Para que nadie se quede esperando una respuesta.", necesita: "Las preguntas más comunes y sus respuestas.", entrega: "Respuestas escritas, listas para revisar." },
  "controlador-inventario": { que: "Revisa qué productos quedan y cuáles se están acabando.", paraQue: "Para pedir a tiempo y no quedarte sin nada.", necesita: "La lista de productos y cuántos hay (o la hoja donde la llevan).", entrega: "Un aviso con lo que hay que reponer." },
  "coordinador-pedidos": { que: "Sigue cada pedido y avisa si algo se atrasa.", paraQue: "Para que los clientes reciban lo que pidieron.", necesita: "Que conectes la tienda del cliente.", entrega: "Un reporte de pedidos que necesitan atención." },
  "analista-conversiones": { que: "Mira cuántas personas compran y en qué momento se van.", paraQue: "Para entender por qué no se vende más.", necesita: "Datos de ventas (una hoja o la tienda conectada).", entrega: "Un informe sencillo con ideas para vender más." },
  "especialista-rentabilidad": { que: "Calcula qué productos dejan más ganancia.", paraQue: "Para saber en qué conviene enfocarse.", necesita: "Precios y costos de los productos.", entrega: "Una lista de lo que más y menos conviene." },
  "coordinador-proyectos": { que: "Divide un trabajo grande en pasos pequeños.", paraQue: "Para que nada se olvide.", necesita: "Que le cuentes qué quieres lograr.", entrega: "Un plan con pasos y orden." },
  "supervisor-tareas": { que: "Revisa qué tareas siguen pendientes y las recuerda.", paraQue: "Para que el equipo cumpla a tiempo.", necesita: "La lista de tareas.", entrega: "Un recordatorio de lo que falta." },
  "estratega-contenido": { que: "Planea qué publicar y cuándo.", paraQue: "Para que las redes del cliente no se queden vacías.", necesita: "Qué vende el negocio y qué redes usa.", entrega: "Un calendario de ideas de publicaciones." },
  "director-creativo": { que: "Propone ideas nuevas para que las publicaciones se vean mejor.", paraQue: "Para destacar entre otros negocios.", necesita: "Ejemplos de lo que ya funcionó.", entrega: "Ideas creativas explicadas con claridad." },
  "seguimiento-posventa": { que: "Escribe mensajes para después de una compra.", paraQue: "Para que el cliente se sienta cuidado y vuelva.", necesita: "Los datos de la compra (sin información privada innecesaria).", entrega: "Mensajes de seguimiento listos para revisar." },
  "analista-satisfaccion": { que: "Lee los comentarios de los clientes y los resume.", paraQue: "Para saber qué les gusta y qué no.", necesita: "Comentarios o reseñas de clientes.", entrega: "Un resumen de lo que piensan." },
  "investigador-mercado": { que: "Investiga cómo es el mercado y qué quiere la gente.", paraQue: "Para tomar mejores decisiones.", necesita: "El tipo de negocio y la ciudad.", entrega: "Un informe con las fuentes que usó." },
  "analista-competidores": { que: "Compara a los negocios de la competencia.", paraQue: "Para ver en qué puedes ser distinto.", necesita: "Los nombres de los competidores.", entrega: "Una tabla comparando precios y mensajes." },
  "optimizador-campanas": { que: "Propone cambios para que los anuncios rindan más.", paraQue: "Para aprovechar mejor el presupuesto.", necesita: "Que estén conectados los anuncios del cliente.", entrega: "Una lista de mejoras. Cada cambio te lo pide primero." },
  "admin-crm": { que: "Mantiene ordenada la lista de tus clientes y de las personas interesadas.", paraQue: "Para que nadie se olvide y no haya datos repetidos.", necesita: "La hoja o lista donde guardas a tus clientes.", entrega: "Un reporte de qué datos faltan o están repetidos." },
  "analista-flujo": { que: "Calcula cuánto dinero entra y sale.", paraQue: "Para evitar sorpresas.", necesita: "Una hoja con ingresos y gastos.", entrega: "Un resumen con los supuestos a la vista." },
};
export function plainEmployee(t: EmployeeTemplate): PlainEmployee {
  const p = PLAIN[t.key];
  const apps = t.connections.filter((c) => c.required).map((c) => c.toolkit);
  if (p) return { key: t.key, name: t.name, ...p, needsApps: apps };
  return { key: t.key, name: t.name, que: t.mission, paraQue: `Para ayudarte con ${t.name.toLowerCase()}.`, necesita: t.connections.length ? "Algunas de tus aplicaciones conectadas (opcional)." : "Solo que le cuentes qué necesitas.", entrega: t.deliverables.join(", ") + ".", needsApps: apps };
}
export const employeesForServices = (ids: string[]): PlainEmployee[] => {
  const keys = [...new Set(ids.flatMap((i) => getCard(i)?.employees ?? []))];
  return keys.map((k) => getTemplate(k)).filter((t): t is EmployeeTemplate => !!t).map(plainEmployee);
};
export const allPlainEmployees = () => EMPLOYEES.map(plainEmployee);
