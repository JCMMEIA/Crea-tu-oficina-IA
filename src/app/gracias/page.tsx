import Link from "next/link";
import { TrackLead } from "@/lib/meta";
export const metadata = { title: "¡Gracias! — Crea tu Oficina IA", robots: { index: false } };
export default async function Gracias({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const demo = (await searchParams).tipo === "demo";
  return (<div className="auth"><TrackLead /><h1>¡Gracias! 🎉</h1>
    {demo ? <><p data-testid="thanks-demo">Recibimos tu solicitud de demostración. Una persona del equipo te escribirá al correo que dejaste para coordinar el día y la hora.</p>
      <p className="muted">Todavía no tenemos respuestas automáticas: la revisamos a mano. Mientras tanto puedes explorar sin costo.</p>
      <p className="row"><Link className="btn" href="/registro">Crear mi cuenta de prueba</Link><Link className="btn ghost" href="/ayuda/tutoriales">Ver tutoriales</Link></p></>
      : <><p>Recibimos tu solicitud de acceso anticipado. Te escribiremos al correo que dejaste cuando haya cupo.</p>
        <p className="row"><Link className="btn" href="/demo">Prefiero una demostración</Link><Link className="btn ghost" href="/ayuda/tutoriales">Ver tutoriales</Link></p></>}
    <p className="muted">No hemos cobrado nada ni lo haremos sin tu autorización expresa.</p><p><Link href="/">Volver al inicio</Link></p></div>);
}
