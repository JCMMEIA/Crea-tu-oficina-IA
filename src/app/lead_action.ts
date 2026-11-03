"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { addLead, pickUtm } from "@/server/leads";
export async function leadAction(f: FormData) {
  const g = (k: string) => String(f.get(k) ?? "");
  const kind = g("kind") === "demo" ? "demo" : "acceso";
  const back = kind === "demo" ? "/demo" : "/acceso-anticipado";
  try {
    await addLead(await getDb(), {
      email: g("email"), name: g("name"), kind, company: g("company"), phone: g("phone"), preferredTime: g("preferredTime"),
      interests: f.getAll("interests").map(String), stage: g("stage"), message: g("message"), consent: f.get("consent") === "on",
      source: g("source"), landing: g("landing"), utm: pickUtm(Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].map((k) => [k, g(k)]))),
    }, g("website"));
  } catch (e: any) { return redirect(back + "?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa tu correo y acepta la política de privacidad." : e.message)); }
  redirect(kind === "demo" ? "/gracias?tipo=demo" : "/gracias");
}
