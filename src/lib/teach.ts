import { skillSpecSchema, SkillSpec } from "@/server/skills/spec";

/** «Enseña a tu empleado»: 5 preguntas cotidianas → instrucciones ordenadas. Función pura (sirve para la vista previa y para guardar). */
export interface TeachAnswers { quiere: string; como: string; sabe: string; nunca: string; resultado: string }
export const TEACH_QUESTIONS: { key: keyof TeachAnswers; label: string; help: string; example: string }[] = [
  { key: "quiere", label: "¿Qué quieres que haga?", help: "Cuéntalo como se lo dirías a una persona.", example: "Que escriba anuncios cortos para mi cafetería." },
  { key: "como", label: "¿Cómo quieres que trabaje?", help: "Por ejemplo: con un tono amable, paso a paso, con frases cortas.", example: "Con tono cercano y alegre, frases cortas." },
  { key: "sabe", label: "¿Qué debe saber de tu negocio?", help: "Qué vendes, a quién, qué te hace especial.", example: "Vendemos café de especialidad y pan artesanal a vecinos del barrio." },
  { key: "nunca", label: "¿Qué cosas no debe hacer?", help: "Una por línea. Es la parte más importante para tu tranquilidad.", example: "Prometer descuentos\nInventar opiniones de clientes" },
  { key: "resultado", label: "¿Qué resultado quieres recibir?", help: "Cómo quieres que te entregue el trabajo.", example: "Tres opciones numeradas, listas para copiar." },
];
const lines = (s: string) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
const MARK = "\n\n## Lo que me enseñaron";

export function buildTaughtSkill(base: SkillSpec, a: TeachAnswers): SkillSpec {
  const sec = (t: string, v: string) => (v.trim() ? `${t}\n${v.trim()}` : "");
  const taught = [sec("Lo que debes hacer:", a.quiere), sec("Cómo debes trabajar:", a.como), sec("Lo que debes saber del negocio:", a.sabe),
    lines(a.nunca).length ? `Lo que NUNCA debes hacer:\n${lines(a.nunca).map((n) => `- ${n}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  return skillSpecSchema.parse({
    ...base, systemPrompt: base.systemPrompt.split(MARK)[0] + (taught ? `${MARK}\n${taught}` : ""),
    outputFormat: a.resultado.trim() || base.outputFormat, goals: a.quiere.trim() ? [a.quiere.trim().slice(0, 300), ...base.goals.filter((g) => g !== a.quiere.trim())].slice(0, 20) : base.goals,
    actionConditions: [...new Set([...base.actionConditions, ...lines(a.nunca).map((n) => `Nunca: ${n}`)])].slice(0, 20),
  });
}
/** Vista previa con palabras sencillas: lo que SE VA A GUARDAR. */
export function previewTaught(a: TeachAnswers) {
  return [
    { titulo: "Lo que hará", texto: a.quiere.trim() || "(lo que ya sabe hacer)" }, { titulo: "Cómo trabajará", texto: a.como.trim() || "(a su manera habitual)" },
    { titulo: "Lo que sabrá de tu negocio", texto: a.sabe.trim() || "(todavía nada de tu negocio)" },
    { titulo: "Lo que nunca hará", texto: lines(a.nunca).join(" · ") || "(sin reglas extra; siempre pedirá permiso antes de cambiar algo)" }, { titulo: "Lo que recibirás", texto: a.resultado.trim() || "(el formato habitual)" },
  ];
}
export const emptyTeach: TeachAnswers = { quiere: "", como: "", sabe: "", nunca: "", resultado: "" };
