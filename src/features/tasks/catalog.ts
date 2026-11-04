import type { BrainKey } from "@/server/brain";

/**
 * CATÁLOGO DE TAREAS GUIADAS (MVP: 8). Cada tarea = una plantilla con preguntas, el empleado responsable (clave de plantilla EXISTENTE en el catálogo de empleados),
 * lo que necesita del Cerebro Empresarial, el formato de salida y criterios de calidad. No duplica empleados ni perfil: solo los referencia por clave.
 * Todos los resultados son PROPUESTAS para que el dueño las revise: ninguna tarea publica, envía ni contacta a nadie.
 */
export type Area = "marketing" | "ventas" | "atencion";
export interface Question { id: string; label: string; help?: string; type: "text" | "textarea" | "select"; options?: string[]; required?: boolean; max?: number; prefill?: BrainKey; placeholder?: string }
export interface GuidedTask {
  key: string; title: string; area: Area; level: "A" | "B" | "C"; employeeKey: string; purpose: string; resultLabel: string;
  questions: Question[]; needs: BrainKey[]; outputFormat: string; sections: string[]; quality: string[]; estTokens: { in: number; out: number };
}
export const AREA_LABEL: Record<Area, string> = { marketing: "Marketing", ventas: "Ventas", atencion: "Atención al cliente" };
export const PROPOSAL_NOTICE = "Propuesta generada por IA. No se publicó, envió ni contactó a nadie. Revísala y edítala antes de usarla.";

const q = (id: string, label: string, o: Partial<Question> = {}): Question => ({ id, label, type: "text", required: true, ...o });
export const GUIDED_TASKS: GuidedTask[] = [
  { key: "anuncios-3-variantes", level: "B", title: "Anuncios: 3 propuestas para una promoción", area: "marketing", employeeKey: "creador-anuncios", resultLabel: "Propuestas de anuncio",
    purpose: "Recibe tres propuestas de anuncio listas para revisar, con tu tono y tu oferta.",
    questions: [q("oferta", "¿Qué vas a promocionar?", { type: "textarea", max: 500, placeholder: "Desayuno completo a $99 de lunes a viernes" }), q("publico", "¿A quién le quieres hablar?", { type: "textarea", prefill: "clients", max: 500 }), q("plataforma", "¿Dónde se publicará?", { type: "select", options: ["Instagram", "Facebook", "WhatsApp", "Google", "Otro"] }), q("fecha", "¿Hasta cuándo dura?", { required: false, max: 120, placeholder: "Hasta el 30 de noviembre" })],
    needs: ["products", "clients", "valueProp", "tone", "rules"],
    outputFormat: "Entrega EXACTAMENTE tres propuestas con estas secciones en este orden, cada una con encabezado de nivel 2: «## Propuesta 1», «## Propuesta 2», «## Propuesta 3». En cada una incluye: Título (máx. 40 caracteres), Texto principal (máx. 125 palabras), Llamada a la acción y Idea de imagen. Cierra con «## Qué revisar antes de publicar».",
    sections: ["Propuesta 1", "Propuesta 2", "Propuesta 3", "Qué revisar antes de publicar"],
    quality: ["Usa el tono de marca", "Menciona la oferta real, sin inventar precios", "Cada propuesta tiene un enfoque distinto", "No promete nada que contradiga las reglas del negocio"], estTokens: { in: 2200, out: 900 } },
  { key: "contenido-semanal", level: "B", title: "Plan de contenido para una semana", area: "marketing", employeeKey: "estratega-contenido", resultLabel: "Plan de contenido",
    purpose: "Un calendario de siete días con ideas concretas de publicaciones para tus redes.",
    questions: [q("red", "¿En qué red social?", { type: "select", options: ["Instagram", "Facebook", "TikTok", "LinkedIn"] }), q("objetivo", "¿Qué quieres lograr esta semana?", { type: "textarea", prefill: "goals", max: 500 }), q("frecuencia", "¿Cuántas publicaciones puedes hacer?", { type: "select", options: ["3", "5", "7"] }), q("tema", "¿Hay algún tema o fecha especial?", { required: false, max: 300 })],
    needs: ["sector", "products", "clients", "tone", "goals"],
    outputFormat: "Entrega una tabla en Markdown con columnas Día, Formato, Idea y Texto sugerido, con tantas filas como publicaciones pidió el cliente. Después agrega «## Mejor horario sugerido» y «## Cómo medir si funcionó». Usa solo datos de negocio que se te dieron.",
    sections: ["Mejor horario sugerido", "Cómo medir si funcionó"],
    quality: ["Una fila por publicación pedida", "Ideas aplicables con el negocio real", "Mezcla formatos (foto, video corto, texto)", "El texto sugerido respeta el tono"], estTokens: { in: 2000, out: 1100 } },
  { key: "guion-video-corto", level: "B", title: "Guion de un video corto", area: "marketing", employeeKey: "guionista-storytelling", resultLabel: "Guion de video",
    purpose: "Un guion de 30 a 45 segundos con gancho, desarrollo y cierre, listo para grabar con tu celular.",
    questions: [q("tema", "¿Sobre qué es el video?", { type: "textarea", max: 400, placeholder: "Cómo preparamos nuestro café de filtro" }), q("duracion", "¿Cuánto debe durar?", { type: "select", options: ["30 segundos", "45 segundos", "60 segundos"] }), q("mensaje", "¿Qué debe recordar quien lo vea?", { max: 300 })],
    needs: ["sector", "clients", "valueProp", "tone"],
    outputFormat: "Entrega: «## Gancho» (primeros 3 segundos), «## Guion» (tabla con Escena, Lo que se ve y Lo que se dice), «## Cierre» con llamada a la acción, y «## Qué necesitas para grabarlo».",
    sections: ["Gancho", "Guion", "Cierre", "Qué necesitas para grabarlo"],
    quality: ["Cabe en la duración pedida", "El gancho es concreto, no genérico", "Se puede grabar con un celular", "Usa el tono de marca"], estTokens: { in: 1800, out: 700 } },
  { key: "respuesta-prospecto", level: "B", title: "Responder a un prospecto interesado", area: "ventas", employeeKey: "vendedor-conversacional", resultLabel: "Respuesta de ventas",
    purpose: "Una respuesta clara y cálida para quien preguntó por tu producto, con el siguiente paso para cerrar.",
    questions: [q("mensaje", "Pega el mensaje del prospecto", { type: "textarea", max: 1200, placeholder: "Hola, ¿cuánto cuesta el paquete para 20 personas?" }), q("canal", "¿Por dónde te escribió?", { type: "select", options: ["WhatsApp", "Instagram", "Correo", "Teléfono"] }), q("objetivo", "¿Qué quieres que haga después?", { max: 300, placeholder: "Que reserve una fecha" })],
    needs: ["products", "valueProp", "tone", "rules"],
    outputFormat: "Entrega «## Respuesta sugerida» (lista para copiar, adaptada al canal), «## Por qué esta respuesta» (2 viñetas), «## Si responde con una objeción» (2 posibles objeciones con respuesta breve) y «## Datos que faltan» si necesitas algo que no se te dio.",
    sections: ["Respuesta sugerida", "Por qué esta respuesta", "Si responde con una objeción", "Datos que faltan"],
    quality: ["Responde lo que preguntó", "No inventa precios ni disponibilidad", "Propone un siguiente paso claro", "Tono cercano y breve"], estTokens: { in: 2000, out: 700 } },
  { key: "propuesta-comercial", level: "B", title: "Propuesta comercial para un cliente", area: "ventas", employeeKey: "creador-presupuestos", resultLabel: "Propuesta comercial",
    purpose: "Un documento de propuesta con alcance, entregables y condiciones, para revisar antes de enviarlo.",
    questions: [q("cliente", "¿Para quién es?", { max: 200 }), q("necesidad", "¿Qué necesita el cliente?", { type: "textarea", max: 800 }), q("servicios", "¿Qué le vas a ofrecer y a qué precio?", { type: "textarea", prefill: "products", max: 1200 }), q("condiciones", "¿Condiciones (pago, tiempos, vigencia)?", { type: "textarea", required: false, max: 500 })],
    needs: ["products", "valueProp", "tone", "rules"],
    outputFormat: "Entrega un documento con estos encabezados de nivel 2: «## Resumen», «## Alcance y entregables», «## Inversión», «## Condiciones», «## Siguientes pasos». Usa SOLO los precios y condiciones que se te dieron; si falta alguno escribe «[por confirmar]».",
    sections: ["Resumen", "Alcance y entregables", "Inversión", "Condiciones", "Siguientes pasos"],
    quality: ["Los precios coinciden con los datos dados", "Lo que falta aparece como «por confirmar»", "Alcance claro y medible", "Tono profesional"], estTokens: { in: 2200, out: 1100 } },
  { key: "responder-cliente", level: "A", title: "Responder la duda de un cliente", area: "atencion", employeeKey: "agente-soporte", resultLabel: "Respuesta a cliente",
    purpose: "Una respuesta amable y correcta a la duda de un cliente, usando la información de tu negocio.",
    questions: [q("mensaje", "Pega el mensaje del cliente", { type: "textarea", max: 1200 }), q("datos", "Datos que debe usar (horarios, políticas, precios)", { type: "textarea", required: false, max: 800, prefill: "products" }), q("canal", "¿Por dónde se enviará?", { type: "select", options: ["WhatsApp", "Instagram", "Correo", "Chat del sitio"] })],
    needs: ["products", "tone", "rules"],
    outputFormat: "Entrega «## Respuesta sugerida» (lista para copiar), «## Datos usados» (de dónde salió cada dato) y «## Pendiente de confirmar» si algo no está en los datos del negocio (no lo inventes).",
    sections: ["Respuesta sugerida", "Datos usados", "Pendiente de confirmar"],
    quality: ["Resuelve la duda", "No inventa datos que no se dieron", "Tono amable y breve", "Indica qué falta confirmar"], estTokens: { in: 1700, out: 500 } },
  { key: "queja-resena", level: "B", title: "Atender una queja o reseña negativa", area: "atencion", employeeKey: "gestor-reclamaciones", resultLabel: "Respuesta a queja",
    purpose: "Una respuesta serena que reconoce el problema y propone una solución justa, sin ponerte a la defensiva.",
    questions: [q("queja", "Pega la queja o reseña", { type: "textarea", max: 1500 }), q("hechos", "¿Qué pasó realmente?", { type: "textarea", required: false, max: 800 }), q("solucion", "¿Qué solución puedes ofrecer?", { type: "textarea", required: false, max: 500 }), q("canal", "¿Dónde se responderá?", { type: "select", options: ["Reseña pública", "Mensaje privado", "Correo"] })],
    needs: ["tone", "rules", "valueProp"],
    outputFormat: "Entrega «## Respuesta sugerida» (adaptada al canal; si es pública, sin datos personales), «## Solución propuesta», «## Qué NO conviene decir» y «## Seguimiento recomendado».",
    sections: ["Respuesta sugerida", "Solución propuesta", "Qué NO conviene decir", "Seguimiento recomendado"],
    quality: ["Reconoce el problema sin culpar al cliente", "No promete más de lo que se autorizó", "Si es pública, no expone datos personales", "Propone un siguiente paso"], estTokens: { in: 1900, out: 600 } },
  { key: "seguimiento-posventa", level: "A", title: "Mensaje de seguimiento después de una compra", area: "atencion", employeeKey: "seguimiento-posventa", resultLabel: "Mensaje posventa",
    purpose: "Un mensaje para agradecer, preguntar cómo les fue y abrir la puerta a una recompra o una reseña.",
    questions: [q("compra", "¿Qué compró el cliente?", { max: 300 }), q("dias", "¿Hace cuántos días?", { type: "select", options: ["1 a 2 días", "una semana", "un mes"] }), q("objetivo", "¿Qué quieres lograr?", { type: "select", options: ["Saber si quedó satisfecho", "Pedir una reseña", "Invitar a volver"] }), q("canal", "¿Por dónde se enviará?", { type: "select", options: ["WhatsApp", "Correo", "Instagram"] })],
    needs: ["tone", "valueProp", "rules"],
    outputFormat: "Entrega «## Mensaje sugerido», «## Variante más corta» y «## Cuándo enviarlo». El mensaje debe sentirse personal y sin presión de venta.",
    sections: ["Mensaje sugerido", "Variante más corta", "Cuándo enviarlo"],
    quality: ["Tono cálido y no insistente", "Un solo objetivo claro", "No ofrece descuentos no autorizados", "Se puede enviar tal cual tras revisarlo"], estTokens: { in: 1600, out: 450 } },
];
export const getGuided = (key: string) => GUIDED_TASKS.find((t) => t.key === key);
export const tasksByArea = () => (Object.keys(AREA_LABEL) as Area[]).map((a) => ({ area: a, label: AREA_LABEL[a], tasks: GUIDED_TASKS.filter((t) => t.area === a) }));
