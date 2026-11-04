import Link from "next/link";
import { BrandMark } from "@/components/Icon";
import { NAV } from "../config/content";

/** Todos los enlaces funcionan. Lo que aún no existe (términos) se muestra como texto «próximamente», no como enlace. */
export function Footer() {
  const contacto = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (<footer className="lp-footer"><div className="lp-wrap" style={{ display: "grid" }}>
    <div><Link href="/" className="lp-logo"><BrandMark size={34} />Crea tu Oficina IA</Link><p style={{ marginTop: 14 }}>Oficinas de empleados de inteligencia artificial para cada área de tu negocio. Los resultados dependen de cada persona; no se garantizan ganancias.</p></div>
    <div><h4>Explora</h4><ul>{NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}<li><Link href="/panel-demo/inicio">Panel de demostración</Link></li></ul></div>
    <div><h4>Tu cuenta</h4><ul><li><Link href="/recuperar">Iniciar sesión</Link></li><li><Link href="/oficinas">Acceso al panel</Link></li><li><a href="#avisame">Lista de espera</a></li></ul></div>
    <div><h4>Soporte y legal</h4><ul><li><Link href="/ayuda/tutoriales">Ayuda</Link></li>{contacto && <li><a href={`mailto:${contacto}`}>Contacto</a></li>}<li><Link href="/privacidad">Política de privacidad</Link></li><li><span className="soon" title="Se publicarán antes de abrir las ventas">Términos y condiciones (próximamente)</span></li></ul></div>
    <div className="lp-copy">© {new Date().getFullYear()} Crea tu Oficina IA.</div></div></footer>);
}
