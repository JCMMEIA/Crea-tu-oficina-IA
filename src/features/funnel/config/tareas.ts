/**
 * Las 8 tareas guiadas que muestra la landing (marketing, ventas y atención). Describen lo que construye el PR #3; su disponibilidad se declara en disponibilidad.ts.
 * Los EJEMPLOS son textos ilustrativos escritos por nosotros con un negocio inventado («Café Luna»). NO los generó una IA ni son un resultado real de un cliente: la landing los rotula así.
 * Cuando el PR #3 se fusione, las claves y los empleados deben coincidir con src/features/tasks/catalog.ts (hay una prueba que lo vigila).
 */
export type Area = "marketing" | "ventas" | "atencion";
export const AREAS: { key: Area; label: string }[] = [{ key: "marketing", label: "Marketing" }, { key: "ventas", label: "Ventas" }, { key: "atencion", label: "Atención al cliente" }];
export type Bloque = { h?: string; p?: string; li?: string[] };
export interface TareaLanding {
  key: string; area: Area; titulo: string; empleadoKey: string; problema: string; pide: string[]; entrega: string; formato: string;
  ejemplo: { entradas: [string, string][]; salida: { titulo: string; bloques: Bloque[] } };
}
export const TAREAS: TareaLanding[] = [
  { key: "anuncios-3-variantes", area: "marketing", titulo: "Anuncios: 3 propuestas para una promoción", empleadoKey: "creador-anuncios",
    problema: "No sabes qué escribir para anunciar una promoción sin sonar igual que todos.", pide: ["Qué vas a promocionar", "A quién le hablas (ya viene de tu perfil)", "Dónde se publicará", "Hasta cuándo dura"],
    entrega: "Tres propuestas de anuncio con título, texto, llamada a la acción e idea de imagen.", formato: "Documento con 3 propuestas y una lista de qué revisar antes de publicar",
    ejemplo: { entradas: [["Qué promocionas", "Desayuno completo a $99, de lunes a viernes"], ["A quién", "Oficinistas jóvenes de 22 a 35 años"], ["Dónde", "Instagram"]],
      salida: { titulo: "Propuestas de anuncio", bloques: [{ h: "Propuesta 1 · Directa", p: "«Tu mañana, resuelta por $99». Café de filtro, croissant y fruta, de lunes a viernes. Pasa antes de la oficina." }, { h: "Propuesta 2 · Cercana", p: "«¿Ya desayunaste como se debe?» Tostamos cada semana el café de productores locales. Ven por el desayuno completo a $99." }, { h: "Propuesta 3 · Curiosidad", p: "«El secreto está en el tueste.» Descubre por qué nuestro desayuno completo cuesta $99 y se acaba temprano." }, { h: "Qué revisar antes de publicar", li: ["Confirma que $99 sigue vigente", "Elige la imagen real de tu local", "No prometas entregas el mismo día"] }] } } },
  { key: "contenido-semanal", area: "marketing", titulo: "Plan de contenido para una semana", empleadoKey: "estratega-contenido",
    problema: "Publicas cuando te acuerdas y no sabes qué toca mañana.", pide: ["Red social", "Objetivo de la semana (ya viene de tu perfil)", "Cuántas publicaciones puedes hacer", "Tema o fecha especial"],
    entrega: "Calendario con día, formato, idea y texto sugerido, más cómo medir si funcionó.", formato: "Tabla semanal con horario sugerido y forma de medir",
    ejemplo: { entradas: [["Red", "Instagram"], ["Objetivo", "Vender más entre semana"], ["Publicaciones", "3"]],
      salida: { titulo: "Plan de contenido semanal", bloques: [{ h: "Lunes · Foto", p: "El desayuno completo servido en la barra. Texto: «Empieza la semana con algo rico»." }, { h: "Miércoles · Video corto", p: "Cómo preparamos un café de filtro en 30 segundos." }, { h: "Viernes · Historia", p: "Encuesta: ¿croissant o pan dulce? Invita a pasar el fin de semana." }, { h: "Cómo medir si funcionó", li: ["Guardados y comentarios por publicación", "Cuántos mencionan el desayuno en la caja"] }] } } },
  { key: "guion-video-corto", area: "marketing", titulo: "Guion de un video corto", empleadoKey: "guionista-storytelling",
    problema: "Quieres grabar un video con tu celular pero no sabes qué decir ni cómo empezar.", pide: ["Sobre qué es el video", "Cuánto debe durar", "Qué debe recordar quien lo vea"],
    entrega: "Gancho, guion por escenas, cierre y lista de lo necesario para grabarlo.", formato: "Guion con gancho, escenas, cierre y lista de materiales",
    ejemplo: { entradas: [["Tema", "Cómo preparamos nuestro café de filtro"], ["Duración", "30 segundos"], ["Mensaje", "Es café de productores locales"]],
      salida: { titulo: "Guion de video · 30 segundos", bloques: [{ h: "Gancho (3 s)", p: "«Este café viene de un productor a 300 km de aquí.»" }, { h: "Escenas", li: ["Primer plano de los granos recién molidos", "El agua cayendo sobre el filtro", "La taza servida; sonrisa a cámara"] }, { h: "Cierre", p: "«Pruébalo esta semana en Café Luna.»" }, { h: "Qué necesitas para grabarlo", li: ["Celular con buena luz natural", "Una taza limpia y los granos"] }] } } },
  { key: "respuesta-prospecto", area: "ventas", titulo: "Responder a un prospecto interesado", empleadoKey: "vendedor-conversacional",
    problema: "Te escriben por mensaje y tardas en contestar o no sabes cómo avanzar a la venta.", pide: ["El mensaje del prospecto", "Por dónde te escribió", "Qué quieres que haga después"],
    entrega: "Respuesta lista para copiar, por qué funciona y cómo contestar dos objeciones comunes.", formato: "Respuesta sugerida, razones, objeciones y datos que faltan",
    ejemplo: { entradas: [["Mensaje", "«¿Cuánto cuesta el paquete para 20 personas?»"], ["Canal", "WhatsApp"], ["Objetivo", "Que reserve una fecha"]],
      salida: { titulo: "Respuesta de ventas", bloques: [{ h: "Respuesta sugerida", p: "¡Hola! Qué gusto. Para 20 personas armamos el paquete según lo que quieran probar. ¿Para qué fecha lo necesitas? Así te confirmo disponibilidad y te paso el precio exacto." }, { h: "Datos que faltan", li: ["Precio del paquete [por confirmar]", "Fecha y horario del evento"] }] } } },
  { key: "propuesta-comercial", area: "ventas", titulo: "Propuesta comercial para un cliente", empleadoKey: "creador-presupuestos",
    problema: "Cada propuesta te toma una tarde y termina distinta a la anterior.", pide: ["Para quién es", "Qué necesita el cliente", "Qué ofreces y a qué precio", "Condiciones de pago y vigencia"],
    entrega: "Documento con resumen, alcance, inversión, condiciones y siguientes pasos; lo que falta queda como «por confirmar».", formato: "Documento de propuesta con cinco secciones",
    ejemplo: { entradas: [["Cliente", "Oficinas Aurora"], ["Necesidad", "Café y desayuno para 15 personas, tres veces por semana"], ["Servicios", "Desayuno completo $99 por persona"]],
      salida: { titulo: "Propuesta para Oficinas Aurora", bloques: [{ h: "Resumen", p: "Servicio de desayuno y café para 15 personas, tres veces por semana." }, { h: "Alcance y entregables", li: ["Entrega a las 8:30 a. m.", "Café de filtro y desayuno completo"] }, { h: "Inversión", p: "$99 por persona por servicio. Total mensual: [por confirmar según días del mes]." }, { h: "Condiciones", p: "Pago: [por confirmar]. Vigencia: [por confirmar]." }, { h: "Siguientes pasos", li: ["Confirmar fechas", "Programar una prueba"] }] } } },
  { key: "responder-cliente", area: "atencion", titulo: "Responder la duda de un cliente", empleadoKey: "agente-soporte",
    problema: "Los mismos mensajes llegan todo el día y cada respuesta consume tu tiempo.", pide: ["El mensaje del cliente", "Datos que debe usar (horarios, políticas)", "Por dónde se enviará"],
    entrega: "Respuesta amable lista para copiar, de dónde salió cada dato y qué falta confirmar.", formato: "Respuesta sugerida, datos usados y pendientes",
    ejemplo: { entradas: [["Mensaje", "«¿A qué hora abren los domingos?»"], ["Datos", "Domingos de 9 a 15 h"], ["Canal", "WhatsApp"]],
      salida: { titulo: "Respuesta a cliente", bloques: [{ h: "Respuesta sugerida", p: "¡Hola! Los domingos abrimos de 9:00 a 15:00 h. ¡Te esperamos!" }, { h: "Datos usados", li: ["Horario de domingos (dato que tú diste)"] }, { h: "Pendiente de confirmar", p: "Nada: toda la información venía en tus datos." }] } } },
  { key: "queja-resena", area: "atencion", titulo: "Atender una queja o reseña negativa", empleadoKey: "gestor-reclamaciones",
    problema: "Una reseña mala te enoja y respondes con prisa, o la dejas sin contestar.", pide: ["La queja o reseña", "Qué pasó realmente", "Qué solución puedes ofrecer", "Dónde se responderá"],
    entrega: "Respuesta serena, solución propuesta, qué no conviene decir y cómo dar seguimiento.", formato: "Respuesta, solución, advertencias y seguimiento",
    ejemplo: { entradas: [["Reseña", "«Esperé 25 minutos y el café llegó frío»"], ["Solución", "Reponer la bebida en su próxima visita"], ["Canal", "Reseña pública"]],
      salida: { titulo: "Respuesta a reseña", bloques: [{ h: "Respuesta sugerida", p: "Gracias por contarnos y lamentamos la espera y el café frío; no es lo que queremos ofrecer. Nos gustaría invitarte a una bebida en tu próxima visita." }, { h: "Qué NO conviene decir", li: ["Culpar al cliente o al día de mucho trabajo", "Dar datos personales en una reseña pública"] }, { h: "Seguimiento recomendado", p: "Revisa los tiempos de servicio de ese horario." }] } } },
  { key: "seguimiento-posventa", area: "atencion", titulo: "Mensaje de seguimiento después de una compra", empleadoKey: "seguimiento-posventa",
    problema: "Después de vender no vuelves a escribirle al cliente y pierdes la recompra.", pide: ["Qué compró", "Hace cuántos días", "Qué quieres lograr", "Por dónde se enviará"],
    entrega: "Mensaje cálido, una variante más corta y el mejor momento para enviarlo.", formato: "Mensaje, variante corta y momento sugerido",
    ejemplo: { entradas: [["Compra", "Café de grano 500 g"], ["Hace", "una semana"], ["Objetivo", "Pedir una reseña"]],
      salida: { titulo: "Mensaje posventa", bloques: [{ h: "Mensaje sugerido", p: "¡Hola! Hace una semana te llevaste nuestro café de grano. ¿Qué tal te fue? Si te gustó, nos ayudaría mucho una reseña de dos líneas." }, { h: "Variante más corta", p: "¡Hola! ¿Cómo te fue con el café? Cuéntanos si te gustó." }, { h: "Cuándo enviarlo", p: "Entre semana, por la tarde." }] } } },
];
