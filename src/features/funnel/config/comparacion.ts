/** Comparación justa con una conversación general de IA (por ejemplo, ChatGPT o Claude). Cada fila dice qué hace bien la conversación general y qué agrega esta plataforma. «Estado» refleja disponibilidad real (ver disponibilidad.ts). */
export interface Fila { tema: string; general: string; nosotros: string; feature: string }
export const COMPARACION: Fila[] = [
  { tema: "Cómo se usa", general: "Una conversación abierta: sirve para casi todo y tú decides qué pedir.", nosotros: "Empleados con puesto y especialidad: eliges a quién pedirle el trabajo.", feature: "empleados" },
  { tema: "Contexto de tu empresa", general: "Tienes que volver a explicarlo en cada conversación o pegarlo tú.", nosotros: "Lo registras una vez en el Cerebro Empresarial y lo usan tus empleados.", feature: "cerebro" },
  { tema: "Tareas guiadas", general: "Tú escribes la instrucción completa; el resultado depende de cómo la redactes.", nosotros: "Eliges una tarea y respondes preguntas ya prellenadas con tus datos.", feature: "tareasGuiadas" },
  { tema: "Resultados guardados", general: "Quedan en el historial del chat.", nosotros: "Cada resultado se guarda por oficina, se edita y se descarga.", feature: "resultados" },
  { tema: "Control de consumo", general: "Depende del plan que contrates con el proveedor.", nosotros: "Ves tokens, costo estimado y límites por oficina, con bloqueo al llegar al tope.", feature: "consumo" },
  { tema: "Varias oficinas", general: "Una cuenta o proyecto, sin separación de datos por cliente.", nosotros: "Cada oficina tiene sus datos, sus empleados y su consumo separados.", feature: "oficinas" },
  { tema: "Antes de actuar", general: "Normalmente solo conversas; publicar o enviar lo haces tú fuera del chat.", nosotros: "Los empleados proponen; tú apruebas antes de cualquier acción.", feature: "oficinas" },
];
export const COMPARACION_NOTA = "Una conversación general de IA es excelente para explorar ideas o resolver algo puntual. Esta plataforma busca ahorrarte repetir contexto y ordenar el trabajo cuando lo necesitas todos los días. No necesitas contratar ninguna otra IA por separado para lo incluido en tu plan.";
