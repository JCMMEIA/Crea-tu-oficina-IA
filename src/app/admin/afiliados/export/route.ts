import { requireOperator } from "@/lib/session";
import { commissionsCsv } from "@/server/affiliates";
export const dynamic = "force-dynamic";
/** CSV de auditoría de comisiones (sin correos). Solo operadores. */
export async function GET() { const { db, op } = await requireOperator(); return new Response(await commissionsCsv(db, op), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="comisiones-afiliados.csv"', "Cache-Control": "private, no-store" } }); }
