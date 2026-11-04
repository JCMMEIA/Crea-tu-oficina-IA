import type { Metadata } from "next";
import { AffiliateLanding } from "@/features/funnel/AffiliateLanding";

export const metadata: Metadata = { title: "Programa de afiliados", description: "Recomienda Crea tu Oficina IA y recibe comisión recurrente. Programa en preparación, por invitación o solicitud aprobada." };
export default async function Afiliados({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) { const sp = await searchParams; return <AffiliateLanding ok={sp.ok} error={sp.error} />; }
