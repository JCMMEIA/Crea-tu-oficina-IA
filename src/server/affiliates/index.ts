import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Db } from "../db";
import { newId } from "../db";
import { audit } from "../auth/audit";
import { assertOperator, type Operator } from "../commercial/admin";

/**
 * PROGRAMA DE AFILIADOS. Reglas (borrador, requieren revisión legal antes de publicarse): 20 % recurrente sobre el cobro NETO elegible, hasta 12 cobros por cliente referido,
 * con retención antes de aprobar (ventana de reembolsos), ajustes por reembolsos y contracargos, y pagos mensuales auditables.
 * Aislamiento: el afiliado solo ve sus enlaces y cifras agregadas; nunca correos, conversaciones, documentos ni datos de las oficinas de sus referidos.
 */
export const AFFILIATE_TERMS = { version: "borrador-2026-11", rate: 0.2, maxMonths: 12, holdDays: 30, minPayoutCents: 50_000, currency: "mxn", cookieDays: 30 } as const;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
/** Normaliza correos para comparar (minúsculas, sin +alias; en Gmail sin puntos) y detectar autorreferidos. */
export function canonicalEmail(raw: string): string { const [l0, d0] = raw.trim().toLowerCase().split("@"); if (!d0) return raw.trim().toLowerCase(); let l = l0.split("+")[0]; const d = d0 === "googlemail.com" ? "gmail.com" : d0; if (d === "gmail.com") l = l.replace(/\./g, ""); return `${l}@${d}`; }
export const maskEmail = (e: string) => { const [l, d] = e.split("@"); return `${(l ?? "").slice(0, 1)}***@${d ?? ""}`; };

const applySchema = z.object({ email: z.string().trim().toLowerCase().email().max(160), name: z.string().trim().min(2).max(120), channel: z.string().trim().max(300).default(""), acceptTerms: z.literal(true, { message: "Debes aceptar las condiciones del programa." }), website: z.string().max(0).optional() });
/** Solicitud pública: NO crea acceso ni código; queda «solicitada» hasta que una persona la apruebe. Honeypot y tope por hora contra spam. */
export async function applyAffiliate(db: Db, input: unknown): Promise<{ status: string }> {
  const v = applySchema.parse(input);
  const n = Number((await db.query("SELECT count(*) n FROM affiliates WHERE created_at > now() - interval '1 hour'"))[0].n); if (n >= 40) throw new Error("Hay muchas solicitudes en este momento. Inténtalo más tarde.");
  const ex = (await db.query("SELECT status FROM affiliates WHERE email=$1", [v.email]))[0]; if (ex) return { status: ex.status as string };
  await db.query("INSERT INTO affiliates(id,email,name,channel,terms_version,terms_accepted_at) VALUES($1,$2,$3,$4,$5,now())", [newId(), v.email, v.name, v.channel, AFFILIATE_TERMS.version]); return { status: "solicitada" };
}
async function uniqueCode(db: Db) { for (let i = 0; i < 8; i++) { const c = genCode(); if (!(await db.query("SELECT 1 FROM affiliates WHERE code=$1", [c])).length) return c; } throw new Error("No se pudo generar un código único."); }
export async function approveAffiliate(db: Db, op: Operator | null, id: string) {
  assertOperator(op); const a = (await db.query("SELECT * FROM affiliates WHERE id=$1", [id]))[0]; if (!a) throw new Error("Afiliado no encontrado.");
  if (a.status === "aprobada") return; const code = a.code ?? (await uniqueCode(db));
  await db.query("UPDATE affiliates SET status='aprobada', code=$2, approved_at=now() WHERE id=$1", [id, code]); await audit(db, { userId: op.userId }, "affiliate.approve", id);
}
export async function inviteAffiliate(db: Db, op: Operator | null, email: string, name: string) {
  assertOperator(op); const e = z.string().email().parse(email.trim().toLowerCase()); const ex = (await db.query("SELECT id FROM affiliates WHERE email=$1", [e]))[0];
  const id = ex?.id ?? newId(); if (!ex) await db.query("INSERT INTO affiliates(id,email,name,invited,terms_version) VALUES($1,$2,$3,true,$4)", [id, e, name.trim().slice(0, 120), AFFILIATE_TERMS.version]);
  await approveAffiliate(db, op, id); await audit(db, { userId: op.userId }, "affiliate.invite", id); return id as string;
}
export async function setAffiliateStatus(db: Db, op: Operator | null, id: string, status: "suspendida" | "rechazada" | "aprobada", note = "") {
  assertOperator(op); if (status === "aprobada") return approveAffiliate(db, op, id);
  await db.query("UPDATE affiliates SET status=$2, note=$3 WHERE id=$1", [id, status, note.slice(0, 300)]); await audit(db, { userId: op.userId }, `affiliate.${status}`, id);
}
export const isApprovedAffiliate = async (db: Db, email: string) => (await db.query("SELECT 1 FROM affiliates WHERE email=$1 AND status='aprobada'", [email.trim().toLowerCase()])).length > 0;
export const affiliateByCode = async (db: Db, code: string) => (await db.query("SELECT id,email,status FROM affiliates WHERE code=$1", [code.trim().toUpperCase()]))[0] ?? null;
export const affiliateByEmail = async (db: Db, email: string) => (await db.query("SELECT * FROM affiliates WHERE email=$1", [email.trim().toLowerCase()]))[0] ?? null;

/** Atribuye un pedido al afiliado del enlace. Solo PRIMERA compra, afiliado aprobado y sin autorreferido (mismo correo canónico) ni cliente ya existente. Corre dentro de la transacción de entrega. */
export async function attributeOrder(db: Db, orderId: string, i: { code?: string | null; kind: string; email: string; userId?: string | null }) {
  if (!i.code) return; const a = await affiliateByCode(db, i.code); if (!a) { await db.query("UPDATE orders SET affiliate_flag='codigo_desconocido' WHERE id=$1", [orderId]); return; }
  let flag: string | null = null;
  if (a.status !== "aprobada") flag = "afiliado_no_aprobado";
  else if (i.kind !== "primera") flag = "no_es_primera_compra";
  else if (canonicalEmail(a.email) === canonicalEmail(i.email)) flag = "autorreferido";
  else if ((await db.query("SELECT 1 FROM orders WHERE lower(email)=$1 AND id<>$2 AND status<>'error' LIMIT 1", [i.email.toLowerCase(), orderId])).length) flag = "cliente_existente";
  if (flag) await db.query("UPDATE orders SET affiliate_flag=$2 WHERE id=$1", [orderId, flag]); else await db.query("UPDATE orders SET affiliate_id=$2 WHERE id=$1", [orderId, a.id]);
}

// ---------- Comisiones ----------
/** Genera comisiones PENDIENTES desde las facturas pagadas de pedidos atribuidos. Idempotente (índice único por factura) y con tope de 12 cobros por cliente. */
export async function accrueCommissions(db: Db): Promise<number> {
  const rows = await db.query(`SELECT i.id invoice_id, i.amount_paid, i.currency, o.id order_id, o.affiliate_id FROM invoices i JOIN orders o ON o.stripe_subscription_id = i.subscription_id
    WHERE i.status='paid' AND o.affiliate_id IS NOT NULL AND i.amount_paid > 0 AND NOT EXISTS (SELECT 1 FROM affiliate_commissions c WHERE c.invoice_id=i.id AND c.kind='comision') ORDER BY i.created_at, i.id`); let n = 0;
  for (const r of rows) {
    const done = Number((await db.query("SELECT count(*) n FROM affiliate_commissions WHERE order_id=$1 AND kind='comision'", [r.order_id]))[0].n); if (done >= AFFILIATE_TERMS.maxMonths) continue;
    const aff = (await db.query("SELECT status FROM affiliates WHERE id=$1", [r.affiliate_id]))[0]; if (!aff || aff.status === "rechazada") continue;
    const net = Number(r.amount_paid); const amount = Math.floor(net * AFFILIATE_TERMS.rate);
    const ins = await db.query(`INSERT INTO affiliate_commissions(id,affiliate_id,order_id,invoice_id,month_index,net_cents,rate,amount_cents,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`, [newId(), r.affiliate_id, r.order_id, r.invoice_id, done + 1, net, AFFILIATE_TERMS.rate, amount, (r.currency ?? "mxn").toLowerCase()]); if (ins.length) n++;
  }
  return n;
}
/** Pasa a «aprobada» lo que ya cumplió la retención y cuyo afiliado sigue aprobado. */
export async function approveDueCommissions(db: Db, now = new Date()): Promise<number> {
  const r = await db.query(`UPDATE affiliate_commissions c SET status='aprobada', approved_at=$2 WHERE c.status='pendiente' AND c.kind='comision' AND c.created_at <= $2::timestamptz - ($1 || ' days')::interval
    AND EXISTS (SELECT 1 FROM affiliates a WHERE a.id=c.affiliate_id AND a.status='aprobada') RETURNING c.id`, [String(AFFILIATE_TERMS.holdDays), now.toISOString()]); return r.length;
}
/** Reembolso o contracargo de una factura: revierte la comisión (si no se pagó) o crea un ajuste NEGATIVO que se descuenta del siguiente pago. */
export async function reverseCommission(db: Db, op: Operator | null, invoiceId: string, reason: string, refundedCents?: number) {
  assertOperator(op); const c = (await db.query("SELECT * FROM affiliate_commissions WHERE invoice_id=$1 AND kind='comision'", [invoiceId]))[0]; if (!c) throw new Error("Esa factura no tiene comisión.");
  const portion = refundedCents === undefined ? 1 : Math.min(1, Math.max(0, refundedCents / Number(c.net_cents))); const back = Math.round(Number(c.amount_cents) * portion);
  if (c.status === "pagada") { await db.query("INSERT INTO affiliate_commissions(id,affiliate_id,order_id,invoice_id,month_index,net_cents,rate,amount_cents,currency,kind,status,reason) VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,'ajuste','aprobada',$9)", [newId(), c.affiliate_id, c.order_id, c.month_index, -(refundedCents ?? Number(c.net_cents)), c.rate, -back, c.currency, reason.slice(0, 200)]); }
  else if (portion >= 1) await db.query("UPDATE affiliate_commissions SET status='revertida', reason=$2 WHERE id=$1", [c.id, reason.slice(0, 200)]);
  else await db.query("UPDATE affiliate_commissions SET amount_cents = amount_cents - $2, net_cents = net_cents - $3, reason=$4 WHERE id=$1", [c.id, back, refundedCents ?? 0, reason.slice(0, 200)]);
  await audit(db, { userId: op.userId }, "affiliate.reverse", c.id, { invoiceId, back });
}
/** Liquidación mensual: suma lo APROBADO (comisiones y ajustes) por afiliado. Respeta el mínimo de pago; lo que no llega al mínimo se acumula al mes siguiente. Una liquidación por afiliado y mes. */
export async function buildPayouts(db: Db, op: Operator | null, period: string): Promise<number> {
  assertOperator(op); if (!/^\d{4}-\d{2}-01$/.test(period)) throw new Error("Periodo no válido (usa AAAA-MM-01)."); let n = 0;
  const aff = await db.query("SELECT affiliate_id, sum(amount_cents)::bigint total FROM affiliate_commissions WHERE status='aprobada' AND payout_id IS NULL GROUP BY affiliate_id");
  for (const a of aff) { const total = Number(a.total); if (total < AFFILIATE_TERMS.minPayoutCents) continue; const id = newId();
    const ins = await db.query("INSERT INTO affiliate_payouts(id,affiliate_id,period,total_cents) VALUES($1,$2,$3,$4) ON CONFLICT (affiliate_id, period) DO NOTHING RETURNING id", [id, a.affiliate_id, period, total]); if (!ins.length) continue;
    await db.query("UPDATE affiliate_commissions SET payout_id=$1 WHERE affiliate_id=$2 AND status='aprobada' AND payout_id IS NULL", [id, a.affiliate_id]); n++; }
  await audit(db, { userId: op.userId }, "affiliate.payouts.build", period, { n }); return n;
}
export async function markPayoutPaid(db: Db, op: Operator | null, payoutId: string, reference: string) {
  assertOperator(op); if (!reference.trim()) throw new Error("Escribe la referencia del pago (transferencia, folio).");
  await db.tx(async (t) => { const r = await t.query("UPDATE affiliate_payouts SET status='pagado', reference=$2, paid_at=now() WHERE id=$1 AND status='borrador' RETURNING id", [payoutId, reference.slice(0, 120)]); if (!r.length) throw new Error("Liquidación no encontrada o ya pagada."); await t.query("UPDATE affiliate_commissions SET status='pagada' WHERE payout_id=$1", [payoutId]); });
  await audit(db, { userId: op.userId }, "affiliate.payout.paid", payoutId, { reference: reference.slice(0, 40) });
}
export async function commissionsCsv(db: Db, op: Operator | null): Promise<string> {
  assertOperator(op); const rows = await db.query("SELECT c.id,a.code,c.order_id,c.invoice_id,c.month_index,c.net_cents,c.rate,c.amount_cents,c.currency,c.kind,c.status,c.payout_id,c.created_at FROM affiliate_commissions c JOIN affiliates a ON a.id=c.affiliate_id ORDER BY c.created_at");
  const h = "id,codigo,pedido,factura,mes,neto_centavos,tasa,comision_centavos,moneda,tipo,estado,liquidacion,fecha"; return [h, ...rows.map((r: any) => [r.id, r.code, r.order_id, r.invoice_id ?? "", r.month_index, r.net_cents, r.rate, r.amount_cents, r.currency, r.kind, r.status, r.payout_id ?? "", new Date(r.created_at).toISOString()].join(","))].join("\n"); }

/** Lo ÚNICO que ve un afiliado: su enlace y cifras agregadas. Los clientes aparecen como «Cliente N» (sin correo, sin oficina, sin conversaciones). */
export async function affiliateDashboard(db: Db, affiliateId: string) {
  const a = (await db.query("SELECT id,name,code,status,terms_version FROM affiliates WHERE id=$1", [affiliateId]))[0]; if (!a) throw new Error("Afiliado no encontrado.");
  const refs = await db.query("SELECT o.id, o.plan, o.created_at, (SELECT count(*) FROM affiliate_commissions c WHERE c.order_id=o.id AND c.kind='comision' AND c.status<>'revertida')::int cobros FROM orders o WHERE o.affiliate_id=$1 ORDER BY o.created_at", [affiliateId]);
  const sums = (await db.query("SELECT coalesce(sum(CASE WHEN status='pendiente' THEN amount_cents END),0)::bigint pend, coalesce(sum(CASE WHEN status='aprobada' THEN amount_cents END),0)::bigint apro, coalesce(sum(CASE WHEN status='pagada' THEN amount_cents END),0)::bigint pag FROM affiliate_commissions WHERE affiliate_id=$1", [affiliateId]))[0];
  const clicks = Number((await db.query("SELECT count(*) n FROM events WHERE name='ref_visita' AND props->>'code'=$1", [a.code ?? ""]))[0].n);
  const payouts = await db.query("SELECT period,total_cents,status,paid_at FROM affiliate_payouts WHERE affiliate_id=$1 ORDER BY period DESC", [affiliateId]);
  return { affiliate: a, clicks, referidos: refs.map((r: any, i: number) => ({ etiqueta: `Cliente ${i + 1}`, plan: r.plan, desde: r.created_at, cobros: r.cobros })), pendiente: Number(sums.pend), aprobada: Number(sums.apro), pagada: Number(sums.pag), payouts };
}
