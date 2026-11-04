"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { applyAffiliate } from "@/server/affiliates";

/** Solicitud pública de afiliado: solo registra una solicitud «solicitada». No crea acceso ni código. */
export async function applyAffiliateAction(f: FormData) {
  let msg = "";
  try { await applyAffiliate(await getDb(), { email: String(f.get("email") ?? ""), name: String(f.get("name") ?? ""), channel: String(f.get("channel") ?? ""), acceptTerms: f.get("acceptTerms") === "on", website: String(f.get("website") ?? "") }); }
  catch (e: any) { if (e?.digest) throw e; return redirect("/afiliados?error=" + encodeURIComponent(e?.name === "ZodError" ? "Revisa tus datos y acepta las condiciones." : e.message) + "#solicitud"); }
  msg = "Recibimos tu solicitud. La revisamos de forma manual y te escribiremos al correo que indicaste si se aprueba."; redirect("/afiliados?ok=" + encodeURIComponent(msg) + "#solicitud");
}
