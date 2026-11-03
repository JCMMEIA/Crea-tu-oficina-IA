"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { addLead, pickUtm } from "@/server/leads";
export async function leadAction(f: FormData) {
  const g = (k: string) => String(f.get(k) ?? "");
  try {
    await addLead(await getDb(), { email: g("email"), name: g("name"), stage: g("stage"), message: g("message"), consent: f.get("consent") === "on", utm: pickUtm(Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].map((k) => [k, g(k)]))) }, g("website"));
  } catch (e: any) { return redirect("/acceso-anticipado?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa tu correo y acepta la política de privacidad." : e.message)); }
  redirect("/gracias");
}
