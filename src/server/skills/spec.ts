import { z } from "zod";

/** Skill = unidad modular y reutilizable. La plantilla del catálogo es inmutable; cada empresa edita su copia versionada. */
export const skillSpecSchema = z.object({
  systemPrompt: z.string().min(1).max(12000),
  procedures: z.array(z.string().max(1000)).max(30).default([]),
  authorizedTools: z.array(z.string().max(80)).max(30).default([]),
  knowledgeSources: z.array(z.string().max(120)).max(30).default([]),
  outputFormat: z.string().max(2000).default(""),
  goals: z.array(z.string().max(300)).max(20).default([]),
  metrics: z.array(z.string().max(200)).max(20).default([]),
  actionConditions: z.array(z.string().max(500)).max(20).default([]),
  collaborationRules: z.array(z.string().max(500)).max(20).default([]),
  autonomy: z.object({
    requireApprovalForWrites: z.boolean().default(true),
    maxTaskSeconds: z.number().int().min(5).max(300).default(120),
  }).default({ requireApprovalForWrites: true, maxTaskSeconds: 120 }),
});
export type SkillSpec = z.infer<typeof skillSpecSchema>;

export const BEGINNER_QUESTIONS = [
  { key: "sells", label: "¿Qué vende tu empresa?" },
  { key: "idealClient", label: "¿Quién es tu cliente ideal?" },
  { key: "difference", label: "¿Qué te hace diferente?" },
  { key: "competitors", label: "¿Quiénes son tus competidores?" },
  { key: "tone", label: "¿Cómo quieres comunicarte con tus clientes?" },
  { key: "expected", label: "¿Qué resultados esperas de este empleado?" },
  { key: "never", label: "¿Qué cosas nunca debe hacer?" },
  { key: "consult", label: "¿Qué información debe consultar antes de trabajar?" },
] as const;
export type BeginnerAnswers = Partial<Record<(typeof BEGINNER_QUESTIONS)[number]["key"], string>>;
