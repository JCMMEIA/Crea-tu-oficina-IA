import Link from "next/link";
import { TrackLead } from "@/lib/meta";
export const metadata = { title: "¡Gracias! — Crea tu Oficina IA", robots: { index: false } };
export default function Gracias() {
  return (<div className="auth"><TrackLead /><h1>¡Gracias! 🎉</h1><p>Recibimos tu solicitud de acceso anticipado. Te escribiremos al correo que dejaste cuando haya cupo.</p>
    <p className="muted">Mientras tanto, no hemos cobrado nada ni lo haremos sin tu autorización expresa.</p><p><Link className="btn" href="/">Volver al inicio</Link></p></div>);
}
