import type { Metadata } from "next";
import { AffiliatePage } from "@/features/funnel/InfoPages";

export const metadata: Metadata = { title: "Quiero ser afiliado", description: "Programa de afiliados de Crea tu Oficina IA: en preparación. Deja tu interés y te avisamos." };
export default async function Afiliados({ searchParams }: { searchParams: Promise<{ error?: string }> }) { return <AffiliatePage error={(await searchParams).error} />; }
