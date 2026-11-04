import { Db } from "../db";
import { billingStatus } from "../commercial/billing";
import { isPlanKey, planPriceInfo, PlanKey } from "../agency/plans";
import { emailReady } from "./mail";
import { ModelProvider, getProvider } from "../models";

export const offerPlan = (): PlanKey => { const p = process.env.OFFER_PLAN || "emprendedor"; return (isPlanKey(p) && p !== "prueba" ? p : "emprendedor") as PlanKey; };
export const newOfficePlan = (): PlanKey => { const p = process.env.NEW_OFFICE_PLAN; return (p && isPlanKey(p) && p !== "prueba" ? p : offerPlan()) as PlanKey; };

/** Verificación REAL de la IA: una llamada mínima al modelo; solo cuenta si responde texto y el proveedor reporta tokens. Guarda el resultado (no el contenido). */
export async function verifyAi(db: Db, provider: ModelProvider | null = getProvider()): Promise<{ ok: boolean; detail: string }> {
  let ok = false, detail = "";
  if (!provider) detail = "No hay clave de IA configurada.";
  else if (!provider.pricing()) detail = "Faltan las tarifas del modelo (MODEL_INPUT/OUTPUT_USD_PER_MTOK).";
  else try {
    const r = await provider.complete({ system: "Responde con una sola palabra.", messages: [{ role: "user", content: "Responde exactamente: OK" }], tools: [], maxTokens: 20 });
    ok = r.text.trim().length > 0 && r.inputTokens > 0 && r.outputTokens > 0; detail = ok ? `${provider.id}: respondió (${r.inputTokens}+${r.outputTokens} tokens)` : "El modelo respondió vacío o sin tokens medidos.";
  } catch (e: any) { detail = `Falló la llamada: ${String(e?.message ?? e).slice(0, 160)}`; }
  await db.query("INSERT INTO system_checks(name,ok,detail,checked_at) VALUES('ai',$1,$2,now()) ON CONFLICT (name) DO UPDATE SET ok=$1, detail=$2, checked_at=now()", [ok, detail]);
  return { ok, detail };
}
export interface Gate { open: boolean; reasons: string[] }
/** ¿Se puede VENDER? Todo debe estar listo: cobros activos con pasarela, precio en pesos, correo transaccional y IA verificada recientemente. Si no, no se abre. */
export async function purchasesOpen(db: Db): Promise<Gate> {
  const reasons: string[] = []; const b = billingStatus();
  if (!b.enabled) reasons.push("Cobros apagados (BILLING_ENABLED o pasarela sin configurar).");
  const pr = planPriceInfo(offerPlan()); if (!pr || pr.currency !== "MXN") reasons.push(`Falta el precio en pesos del plan ${offerPlan()} (PLAN_PRICE_MXN_…).`);
  if (!emailReady()) reasons.push("Falta el correo transaccional (RESEND_API_KEY y MAIL_FROM): el comprador no recibiría su acceso.");
  const maxH = Number(process.env.AI_VERIFY_MAX_AGE_H) || 48;
  const c = (await db.query("SELECT ok, checked_at > now() - ($1 || ' hours')::interval fresh FROM system_checks WHERE name='ai'", [String(maxH)]))[0];
  if (!c || !c.ok) reasons.push("La IA no está verificada (ejecuta «Verificar IA» en el panel de operador)."); else if (!c.fresh) reasons.push(`La última verificación de IA tiene más de ${maxH} h.`);
  return { open: reasons.length === 0, reasons };
}
