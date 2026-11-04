import type { Metadata } from "next";
import { ManagedPage } from "@/features/funnel/InfoPages";

export const metadata: Metadata = { title: "Nosotros administramos tu oficina", description: "Solicita un diagnóstico: revisamos tu caso y te decimos qué podemos hacer por tu negocio." };
export default async function Gestionado({ searchParams }: { searchParams: Promise<{ error?: string }> }) { return <ManagedPage error={(await searchParams).error} />; }
