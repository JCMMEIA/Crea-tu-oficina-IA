import { z } from "zod";
import { Db } from "../db";
import { AgencyActor, assertAgencyCan, audit } from "../auth";

/** Marca blanca de mensajería por agencia. Con bot/número CENTRAL compartido solo cambia el texto, no la cuenta remitente. */
export const messagingSchema = z.object({
  assistantName: z.string().trim().max(60).default(""),
  welcome: z.string().trim().max(500).default(""),
  tone: z.enum(["cercano", "formal"]).default("cercano"),
  allowedTemplateKeys: z.array(z.string()).max(60).default([]), // vacío = todos los empleados asignables por chat
  allowDigest: z.boolean().default(true),
  maxNotificationsPerDay: z.number().int().min(1).max(200).default(30),
});
export type MessagingSettings = z.infer<typeof messagingSchema>;

export async function getSettings(db: Db, agencyId: string): Promise<MessagingSettings & { agencyName: string }> {
  const r = (await db.query("SELECT name, messaging FROM agencies WHERE id=$1", [agencyId]))[0];
  return { ...messagingSchema.parse(r?.messaging ?? {}), agencyName: r?.name ?? "" };
}
export async function saveSettings(db: Db, a: AgencyActor, input: unknown) {
  assertAgencyCan(a, "agency:brand");
  const v = messagingSchema.parse(input);
  await db.query("UPDATE agencies SET messaging=$2 WHERE id=$1", [a.agencyId, JSON.stringify(v)]);
  await audit(db, { userId: a.userId }, "messaging.settings", a.agencyId);
}
export const assistantLabel = (s: { assistantName: string; agencyName: string }) => s.assistantName || `Asistente de ${s.agencyName}`;
