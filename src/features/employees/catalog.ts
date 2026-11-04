import { DEPARTMENTS, EMPLOYEES, EmployeeTemplate, getDepartment, getTemplate } from "@/server/catalog/data";
import { plainEmployee } from "@/server/guide/services";
import { getToolkit } from "@/server/connectors/catalog";

/**
 * CATÁLOGO ÚNICO DE IDENTIDAD de los empleados IA. Aquí (y solo aquí) viven: nombre propio, puesto mostrado, especialidad, descripción de una línea y los rasgos del retrato.
 * Todo lo demás (misión, responsabilidades, herramientas, entregables, departamento) se LEE de la plantilla real (`src/server/catalog/data.ts`) para no duplicarlo.
 * Los retratos son de personas FICTICIAS: la interfaz siempre los rotula «Empleado IA · imagen ilustrativa». Prompts y proceso: docs/empleados/.
 */
export interface Identity {
  key: string; nombre: string; puesto: string; especialidad: string; linea: string;
  retrato: { genero: "mujer" | "hombre"; edad: number; rasgos: string };
}
const R = (genero: "mujer" | "hombre", edad: number, rasgos: string) => ({ genero, edad, rasgos });
export const IDENTITIES: Identity[] = [
  // Marketing
  { key: "investigador-mercado", nombre: "Camila Herrera", puesto: "Investigadora de mercado", especialidad: "Clientes ideales y tendencias", linea: "Descubre qué quieren tus clientes y qué está haciendo tu competencia.", retrato: R("mujer", 34, "mexicana de piel morena clara, cabello negro ondulado a los hombros") },
  { key: "analista-competidores", nombre: "Mateo Ibarra", puesto: "Analista de competidores", especialidad: "Posicionamiento y precios de la competencia", linea: "Compara tu negocio con los demás y te dice dónde te conviene destacar.", retrato: R("hombre", 38, "latino de piel trigueña, barba corta bien recortada, lentes de armazón delgado") },
  { key: "analista-meta-ads", nombre: "Renata Cisneros", puesto: "Analista de Meta Ads", especialidad: "Rendimiento de campañas en Facebook e Instagram", linea: "Revisa tus anuncios de Meta y te explica qué mejorar, con palabras simples.", retrato: R("mujer", 31, "afrolatina de piel oscura, cabello rizado natural recogido") },
  { key: "creador-anuncios", nombre: "Sebastián Ortega", puesto: "Creador de anuncios", especialidad: "Textos e ideas para anuncios", linea: "Escribe propuestas de anuncios para que tú elijas cuál publicar.", retrato: R("hombre", 29, "latino de piel clara, cabello castaño corto, sonrisa discreta") },
  { key: "guionista-storytelling", nombre: "Lucía Fernández", puesto: "Guionista de storytelling", especialidad: "Historias y guiones de video", linea: "Convierte lo que vendes en historias que la gente quiere ver.", retrato: R("mujer", 42, "española de piel clara, cabello castaño con algunas canas, expresión cálida") },
  { key: "analista-anuncios-ganadores", nombre: "Andrés Quiroga", puesto: "Analista de anuncios ganadores", especialidad: "Qué anuncios funcionan y por qué", linea: "Encuentra lo que hace ganar a un anuncio para repetirlo.", retrato: R("hombre", 45, "andino de piel morena, cabello corto canoso, mirada serena") },
  { key: "director-creativo", nombre: "Isabela Montoya", puesto: "Directora creativa", especialidad: "Dirección de estilo y mensajes", linea: "Cuida que todo lo que publicas se vea y suene a tu marca.", retrato: R("mujer", 39, "colombiana de piel canela, cabello negro lacio, aretes pequeños") },
  { key: "optimizador-campanas", nombre: "Joaquín Palacios", puesto: "Optimizador de campañas", especialidad: "Presupuesto y ajustes de campañas", linea: "Propone cómo gastar mejor tu presupuesto en anuncios; tú decides.", retrato: R("hombre", 33, "latino de piel morena, cabello rizado corto, barba de tres días") },
  { key: "estratega-contenido", nombre: "Ximena Robles", puesto: "Estratega de contenido", especialidad: "Calendario y temas para redes sociales", linea: "Arma tu plan de publicaciones para que nunca te falten ideas.", retrato: R("mujer", 27, "mexicana de rasgos indígenas, cabello largo negro, sonrisa amplia") },
  // Ventas
  { key: "vendedor-conversacional", nombre: "Valentina Torres", puesto: "Especialista en ventas conversacionales", especialidad: "Consultas de clientes y oportunidades", linea: "Responde consultas, detecta oportunidades y prepara respuestas comerciales para tu aprobación.", retrato: R("mujer", 36, "latina de piel clara, cabello castaño oscuro a la altura del cuello, blazer azul marino") },
  { key: "seguimiento-prospectos", nombre: "Emiliano Castañeda", puesto: "Especialista en seguimiento de prospectos", especialidad: "Recordatorios y seguimiento a interesados", linea: "No deja que se enfríe ningún interesado: te recuerda y redacta el seguimiento.", retrato: R("hombre", 41, "mexicano de piel morena clara, bigote ligero, cabello negro corto") },
  { key: "admin-crm", nombre: "Paulina Aguirre", puesto: "Administradora de clientes", especialidad: "Orden de contactos y clientes", linea: "Mantiene tu lista de clientes al día y sin duplicados.", retrato: R("mujer", 47, "latina de piel blanca, cabello corto plateado, lentes redondos") },
  { key: "analista-conversiones", nombre: "Ricardo Valdez", puesto: "Analista de conversiones", especialidad: "De visitante a cliente", linea: "Te muestra en qué paso se te van los clientes y cómo evitarlo.", retrato: R("hombre", 35, "afrolatino de piel oscura, cabeza rapada, barba corta") },
  { key: "especialista-ofertas", nombre: "Fernanda Lozano", puesto: "Especialista en ofertas", especialidad: "Promociones y paquetes", linea: "Diseña ofertas claras y atractivas para que más gente diga que sí.", retrato: R("mujer", 30, "mexicana de piel trigueña, cabello castaño con mechas, sonrisa confiada") },
  { key: "gestor-recurrentes", nombre: "Tomás Beltrán", puesto: "Gestor de clientes recurrentes", especialidad: "Clientes que vuelven a comprar", linea: "Cuida a tus clientes fieles y te avisa cuándo contactarlos.", retrato: R("hombre", 52, "latino de piel clara, cabello gris, sonrisa amable") },
  // Operaciones
  { key: "controlador-inventario", nombre: "Héctor Mendoza", puesto: "Controlador de inventario", especialidad: "Existencias y reabastecimiento", linea: "Vigila qué se está acabando y prepara el borrador de resurtido.", retrato: R("hombre", 44, "mexicano de piel morena, cabello negro corto, camisa de cuadros discreta") },
  { key: "analista-proveedores", nombre: "Gabriela Núñez", puesto: "Analista de proveedores", especialidad: "Comparación de proveedores", linea: "Compara proveedores por precio, tiempo y confiabilidad.", retrato: R("mujer", 40, "latina de piel canela, cabello castaño recogido en chongo") },
  { key: "coordinador-pedidos", nombre: "Samuel Ríos", puesto: "Coordinador de pedidos", especialidad: "Seguimiento de pedidos", linea: "Sigue cada pedido y te avisa cuáles van en riesgo de retrasarse.", retrato: R("hombre", 32, "latino de piel trigueña, cabello ondulado, sonrisa tranquila") },
  { key: "supervisor-operaciones", nombre: "Marisol Cabrera", puesto: "Supervisora de operaciones", especialidad: "Orden del día a día", linea: "Revisa que la operación avance y señala lo que está atorado.", retrato: R("mujer", 49, "mexicana de piel morena, cabello negro con algunas canas, expresión firme") },
  { key: "analista-productividad", nombre: "Iván Zamora", puesto: "Analista de productividad", especialidad: "Tiempos y cuellos de botella", linea: "Encuentra en qué se va el tiempo del equipo y cómo ahorrarlo.", retrato: R("hombre", 28, "latino de piel clara, cabello castaño despeinado con estilo, lentes") },
  { key: "coordinador-logistica", nombre: "Alejandra Peña", puesto: "Coordinadora de logística", especialidad: "Envíos y entregas", linea: "Organiza envíos y entregas para que todo llegue a tiempo.", retrato: R("mujer", 37, "latina de piel morena clara, cabello negro lacio a los hombros") },
  // Finanzas
  { key: "analista-flujo", nombre: "Rodrigo Esquivel", puesto: "Analista de flujo de efectivo", especialidad: "Dinero que entra y sale", linea: "Te muestra cuánto dinero tendrás y cuándo se aprieta la caja.", retrato: R("hombre", 50, "mexicano de piel clara, cabello canoso peinado hacia atrás, traje gris") },
  { key: "analista-gastos", nombre: "Carolina Vidal", puesto: "Analista de gastos", especialidad: "Clasificación de gastos", linea: "Ordena tus gastos y señala los que no cuadran.", retrato: R("mujer", 33, "chilena de piel clara, cabello rubio oscuro corto, sonrisa tímida") },
  { key: "especialista-rentabilidad", nombre: "Nicolás Barrera", puesto: "Especialista en rentabilidad", especialidad: "Qué te deja ganancia", linea: "Calcula qué productos y servicios realmente te dejan ganancia.", retrato: R("hombre", 43, "latino de piel morena, barba cuidada con canas, chaleco oscuro") },
  { key: "analista-precios", nombre: "Sofía Marín", puesto: "Analista de precios", especialidad: "Precios y márgenes", linea: "Propone precios que cuidan tu margen y siguen siendo atractivos.", retrato: R("mujer", 29, "latina de rasgos asiáticos, cabello negro corto con flequillo") },
  { key: "creador-presupuestos", nombre: "Leonardo Fuentes", puesto: "Creador de presupuestos", especialidad: "Presupuestos y cotizaciones", linea: "Arma presupuestos claros para ti o para tus clientes.", retrato: R("hombre", 36, "mexicano de piel trigueña, cabello negro, sonrisa discreta, camisa blanca") },
  { key: "supervisor-indicadores", nombre: "Adriana Solís", puesto: "Supervisora de indicadores financieros", especialidad: "Tablero de números clave", linea: "Vigila tus números clave y te avisa cuando algo se sale de lo normal.", retrato: R("mujer", 54, "latina de piel clara, cabello corto castaño canoso, collar sencillo") },
  // Recursos humanos
  { key: "asistente-reclutamiento", nombre: "Mariana Duarte", puesto: "Asistente de reclutamiento", especialidad: "Vacantes y candidatos", linea: "Redacta vacantes y ordena a los candidatos según lo que buscas.", retrato: R("mujer", 31, "mexicana de piel morena clara, cabello castaño largo suelto") },
  { key: "analista-desempeno", nombre: "Gustavo Arce", puesto: "Analista de desempeño", especialidad: "Seguimiento del desempeño del equipo", linea: "Resume cómo va el equipo con datos claros y sin juicios.", retrato: R("hombre", 46, "latino de piel clara, calvo, barba corta gris") },
  { key: "coordinador-capacitacion", nombre: "Elena Vargas", puesto: "Coordinadora de capacitación", especialidad: "Planes de capacitación", linea: "Prepara planes para que tu equipo aprenda lo que necesita.", retrato: R("mujer", 44, "latina de piel canela, cabello rizado largo, sonrisa cálida") },
  { key: "supervisor-tareas", nombre: "Julián Cordero", puesto: "Supervisor de tareas", especialidad: "Seguimiento de pendientes", linea: "Lleva la cuenta de lo pendiente y recuerda quién debe qué.", retrato: R("hombre", 26, "latino de piel clara, cabello castaño corto, sonrisa juvenil") },
  { key: "especialista-cultura", nombre: "Natalia Pineda", puesto: "Especialista en cultura organizacional", especialidad: "Ambiente y valores del equipo", linea: "Cuida el ambiente del equipo y propone cómo mejorarlo.", retrato: R("mujer", 38, "mexicana de piel clara, cabello castaño rojizo, lentes de pasta") },
  // Dirección
  { key: "asistente-ejecutivo", nombre: "Regina Salgado", puesto: "Asistente ejecutiva", especialidad: "Agenda, resúmenes y pendientes", linea: "Prepara tu día: agenda, resúmenes y lo que no puede esperar.", retrato: R("mujer", 35, "latina de piel blanca, cabello negro en coleta baja, blusa clara") },
  { key: "analista-estrategico", nombre: "Maximiliano Ochoa", puesto: "Analista estratégico", especialidad: "Decisiones con datos", linea: "Junta datos de tu negocio para ayudarte a decidir hacia dónde ir.", retrato: R("hombre", 48, "mexicano de piel morena, cabello gris corto, traje azul") },
  { key: "coordinador-proyectos", nombre: "Valeria Cano", puesto: "Coordinadora de proyectos", especialidad: "Proyectos y fechas", linea: "Divide los proyectos en pasos y cuida que se cumplan las fechas.", retrato: R("mujer", 32, "latina de rasgos mestizos, cabello castaño ondulado, sonrisa segura") },
  { key: "investigador-oportunidades", nombre: "Bruno Aguilar", puesto: "Investigador de oportunidades", especialidad: "Nuevos mercados y alianzas", linea: "Busca nuevas oportunidades de negocio con fuentes citadas.", retrato: R("hombre", 40, "latino de piel clara, cabello castaño con entradas, barba ligera") },
  { key: "supervisor-general", nombre: "Patricia Mejía", puesto: "Supervisora general de empleados IA", especialidad: "Coordinación de todo el equipo", linea: "Coordina a los demás empleados y te da un resumen único.", retrato: R("mujer", 51, "latina de piel morena clara, cabello corto negro, blazer gris") },
  // Atención al cliente
  { key: "agente-soporte", nombre: "Miguel Reyes", puesto: "Asistente de soporte", especialidad: "Dudas y problemas de clientes", linea: "Redacta respuestas amables a las dudas de tus clientes para tu aprobación.", retrato: R("hombre", 34, "mexicano de piel trigueña, cabello negro corto, camisa azul claro") },
  { key: "analista-satisfaccion", nombre: "Claudia Navarro", puesto: "Analista de satisfacción", especialidad: "Opiniones y calificaciones", linea: "Lee las opiniones de tus clientes y te resume lo que piden.", retrato: R("mujer", 45, "latina de piel morena, cabello negro con ondas suaves, sonrisa afable") },
  { key: "gestor-reclamaciones", nombre: "Óscar Domínguez", puesto: "Gestor de reclamaciones", especialidad: "Quejas y soluciones", linea: "Atiende las quejas con calma y propone una solución justa.", retrato: R("hombre", 55, "latino de piel clara, cabello blanco, bigote, expresión empática") },
  { key: "seguimiento-posventa", nombre: "Rafael Guerrero", puesto: "Asistente de seguimiento posventa", especialidad: "Después de la compra", linea: "Da seguimiento después de una compra para que el cliente vuelva.", retrato: R("hombre", 30, "afrolatino de piel oscura, cabello corto, sonrisa abierta") },
];
const BY_KEY = new Map(IDENTITIES.map((i) => [i.key, i]));
export const identityFor = (templateKey: string | null | undefined): Identity | null => (templateKey ? BY_KEY.get(templateKey) ?? null : null);
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
/** Nombre que se muestra de un empleado contratado: el que el cliente le puso; si aún se llama como su puesto (empleados anteriores), el de su identidad. */
export function displayName(e: { name: string; role_title?: string | null; template_key?: string | null }): string {
  const id = identityFor(e.template_key); return id && (!e.name || e.name === e.role_title || e.name === getTemplate(id.key)?.name) ? id.nombre : e.name;
}

export interface Profile {
  key: string; nombre: string; puesto: string; especialidad: string; linea: string; departamento: { key: string; nombre: string };
  encargo: string; descripcion: string; paraQue: string; necesita: string; responsabilidades: string[]; entregables: string[]; habilidad: string;
  herramientas: { toolkit: string; label: string; obligatoria: boolean }[]; foto: string;
}
/** Ficha completa = identidad (este catálogo) + lo que la plantilla real ya define. Una sola función para tarjeta, ficha, demo y panel. */
export function profileFor(key: string): Profile | null {
  const id = identityFor(key); const t: EmployeeTemplate | undefined = getTemplate(key); if (!id || !t) return null; const pl = plainEmployee(t); const dep = getDepartment(t.department);
  return { key, nombre: id.nombre, puesto: id.puesto, especialidad: id.especialidad, linea: id.linea, departamento: { key: t.department, nombre: dep?.name ?? t.department }, encargo: t.mission, descripcion: pl.que, paraQue: pl.paraQue, necesita: pl.necesita,
    responsabilidades: t.responsibilities, entregables: t.deliverables, habilidad: t.skillName, herramientas: t.connections.map((c) => ({ toolkit: c.toolkit, label: getToolkit(c.toolkit)?.label ?? c.toolkit, obligatoria: !!c.required })), foto: `/employees/${key}.webp` };
}
export const allProfiles = (): Profile[] => EMPLOYEES.map((e) => profileFor(e.key)).filter((p): p is Profile => !!p);
export const departmentsWithProfiles = () => DEPARTMENTS.map((d) => ({ key: d.key, nombre: d.name, perfiles: allProfiles().filter((p) => p.departamento.key === d.key) })).filter((d) => d.perfiles.length);

/** Prompt del retrato (para generación de imágenes). Fotografía corporativa realista de una persona FICTICIA; fondo coherente con la marca. */
const ATUENDO: Record<string, string> = { marketing: "smart casual creative attire", ventas: "business casual attire", operaciones: "practical business casual attire", finanzas: "formal business attire", rrhh: "warm professional attire", direccion: "executive business attire", atencion: "friendly professional attire" };
export function portraitPrompt(key: string): string | null {
  const id = identityFor(key); const t = getTemplate(key); if (!id || !t) return null; const r = id.retrato;
  return `Professional corporate headshot photograph of a fictional ${r.edad}-year-old ${r.genero === "mujer" ? "woman" : "man"}, ${r.rasgos}. ${ATUENDO[t.department] ?? "business attire"}. Natural, confident, approachable expression, looking at the camera. Soft studio lighting, shallow depth of field, subtle dark navy-to-violet gradient backdrop, shoulders-up framing, realistic photography, sharp focus, high resolution, natural skin texture. No text, no logos, no watermark. This is a fictional person, not a real individual.`;
}
