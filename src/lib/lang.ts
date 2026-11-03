/** Vocabulario y mensajes en lenguaje cotidiano. No cambia nombres internos: solo lo que ve la persona. */
export const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño", admin: "Administrador", member: "Miembro del equipo", viewer: "Solo puede ver",
  agency_owner: "Dueño de la agencia", agency_admin: "Administrador de la agencia", agency_member: "Equipo de la agencia",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

/** Estados con ICONO y TEXTO (nunca solo color). */
export const TASK_STATUS: Record<string, { icon: string; text: string; tone: "" | "ok" | "warn" | "bad" }> = {
  requested: { icon: "🕐", text: "Pedida", tone: "" }, in_progress: { icon: "⏳", text: "Trabajando", tone: "warn" },
  completed: { icon: "✅", text: "Lista", tone: "ok" }, failed: { icon: "⚠️", text: "No salió", tone: "bad" },
  awaiting_approval: { icon: "✋", text: "Espera tu permiso", tone: "warn" }, rejected: { icon: "🚫", text: "Rechazada", tone: "bad" },
};

const RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/COMPOSIO|conexi[oó]n con tus aplicaciones/i, "Todavía no está activada la conexión con tus aplicaciones. Quien instaló la plataforma tiene que activarla; en «Conecta tus aplicaciones» te explicamos cómo."],
  [/ANTHROPIC_API_KEY|La IA no est[aá] configurada/i, "Tus empleados todavía no pueden trabajar de verdad: falta activar la inteligencia artificial. Mientras tanto puedes practicar con la demostración."],
  [/tarifa del modelo|MODEL_INPUT|MODEL_OUTPUT/i, "Falta terminar de activar la inteligencia artificial (sus precios de uso), así que no se pudo calcular el costo. Pídeselo a quien instaló la plataforma."],
  [/Presupuesto mensual de IA de la agencia/i, "Se acabó el presupuesto de inteligencia artificial de tu agencia este mes. Cuando se renueve podrás seguir."],
  [/Presupuesto mensual de IA/i, "Se acabó el presupuesto de inteligencia artificial de este cliente este mes. Puedes subirlo en su ficha."],
  [/l[ií]mite de ejecuciones por hora/i, "Se hicieron muchas tareas en poco tiempo. Espera un rato y vuelve a intentarlo."],
  [/l[ií]mite diario/i, "Este empleado ya trabajó todo lo permitido por hoy. Mañana podrá seguir."],
  [/Tiempo m[aá]ximo/i, "La tarea tardó demasiado y se detuvo. Prueba con una petición más corta."],
  [/Fall[oó] la IA/i, "La inteligencia artificial tuvo un problema y no pudo terminar. Puedes volver a intentarlo."],
  [/Ya existe una tarea igual/i, "Ya pediste esto hace poco. Mira la tarea que ya existe."],
  [/Tu plan (\w+) permite hasta (\d+) clientes/i, (m) => `Tu plan «${m[1]}» permite hasta ${m[2]} clientes. Para agregar más, hay que cambiar de plan.`],
  [/Tu plan (\w+) permite hasta (\d+) empleados/i, (m) => `Tu plan «${m[1]}» permite hasta ${m[2]} empleados. Para sumar más, hay que cambiar de plan.`],
  [/Empresa no encontrada|no encontrad[oa]/i, "No encontramos eso. Puede que ya no exista o que no sea tuyo."],
  [/Correo o contrase[nñ]a incorrectos/i, "El correo o la contraseña no coinciden. Revísalos e inténtalo otra vez."],
  [/Ya existe una cuenta con ese correo/i, "Ese correo ya tiene una cuenta. Prueba entrar con él."],
  [/at least 10|al menos 10 caracteres|Revisa los datos \(contrase/i, "Tu contraseña es muy corta. Usa al menos 10 letras o números."],
  [/Canal revocado o sin acceso/i, "Esa persona ya no tiene permiso para este trabajo, así que no se hizo."],
];
/** Convierte mensajes internos en frases que cualquiera entiende y le dicen qué hacer. */
export function friendlyError(msg: string | null | undefined): string {
  const s = String(msg ?? "").trim(); if (!s) return "";
  for (const [re, out] of RULES) { const m = s.match(re); if (m) return typeof out === "function" ? out(m) : out; }
  return s;
}
