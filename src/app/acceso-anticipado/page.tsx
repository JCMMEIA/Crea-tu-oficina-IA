import Link from "next/link";
import { LeadForm } from "@/lib/leadform";
import { Flash } from "@/lib/ui";
import { pickUtm } from "@/server/leads";
export const metadata = { title: "Acceso anticipado — Crea tu Oficina IA" };
export default async function Acceso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (<div className="auth"><p><Link href="/">← Volver</Link></p><Flash sp={{ error: sp.error }} /><LeadForm utm={pickUtm(sp)} /></div>);
}
