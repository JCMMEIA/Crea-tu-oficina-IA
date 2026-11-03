import { z } from "zod";
import { Db, newId } from "./db";

const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200), name: z.string().trim().max(120).default(""),
  stage: z.enum(["", "idea", "ya-vendo-servicios", "tengo-clientes"]).default(""), message: z.string().trim().max(1000).default(""),
  consent: z.literal(true, { error: "Debes aceptar la política de privacidad." }),
  utm: z.record(z.string(), z.string().max(200)).default({}),
});
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
export const pickUtm = (src: Record<string, string | undefined>) => Object.fromEntries(UTM_KEYS.filter((k) => src[k]).map((k) => [k, String(src[k]).slice(0, 200)]));

/** Acceso anticipado. Honeypot y tope por hora contra abuso; el mismo correo se actualiza, no se duplica. */
export async function addLead(db: Db, input: unknown, honeypot = ""): Promise<"ok" | "ignored"> {
  if (honeypot) return "ignored"; // bots: respondemos igual para no darles señal
  const v = leadSchema.parse(input);
  const n = Number((await db.query<{ n: string }>("SELECT count(*) n FROM leads WHERE created_at > now() - interval '1 hour'"))[0].n);
  if (n >= 200) throw new Error("Hay demasiadas solicitudes ahora mismo. Inténtalo más tarde.");
  await db.query(`INSERT INTO leads(id,email,name,stage,message,consent,utm) VALUES($1,$2,$3,$4,$5,true,$6)
    ON CONFLICT (email) DO UPDATE SET name=$3, stage=$4, message=$5, utm=$6`, [newId(), v.email, v.name, v.stage, v.message, JSON.stringify(v.utm)]);
  return "ok";
}
