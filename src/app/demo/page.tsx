import Link from "next/link";
import { LeadForm } from "@/lib/leadform";
import { Flash } from "@/lib/ui";
export const metadata = { title: "Pide una demostración — Crea tu Oficina IA", description: "Mira la plataforma funcionando con un negocio de ejemplo. Sin costo ni compromiso." };
export default async function Demo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (<div className="auth" style={{ maxWidth: 640 }}><p><Link href="/">← Volver</Link></p>
    <h1>Pide una demostración</h1>
    <div className="card"><b>Qué verás</b><ul><li>Cómo creas tu agencia y eliges qué servicios ofrecer.</li><li>Cómo contratas empleados digitales y los ves trabajar en una oficina de ejemplo.</li><li>Cómo apruebas (o rechazas) lo que quieren hacer antes de que pase.</li></ul>
      <p className="muted">La demostración usa datos inventados. No te prometemos ganancias ni clientes: te mostramos la herramienta tal como es hoy.</p></div>
    <Flash sp={{ error: sp.error }} /><LeadForm kind="demo" /></div>);
}
