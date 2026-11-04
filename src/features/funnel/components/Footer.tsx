import Link from "next/link";
import { BrandMark } from "@/components/Icon";
export function Footer() {
  const contacto = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (<footer className="lp-footer"><div className="lp-wrap" style={{ display: "grid" }}>
    <div><Link href="/" className="lp-logo"><BrandMark size={34} />Crea tu Oficina IA</Link><p style={{ marginTop: 14 }}>Oficinas de empleados de inteligencia artificial para tu negocio. Los resultados dependen de cada persona; no se garantizan ganancias.</p></div>
    <div><h4>Producto</h4><ul><li><Link href="/panel-demo/inicio">Ver panel por dentro</Link></li><li><a href="#oferta">Oferta</a></li><li><Link href="/oficinas">Acceso al panel</Link></li></ul></div>
    <div><h4>Soporte</h4><ul><li><Link href="/ayuda/tutoriales">Ayuda</Link></li><li>{contacto ? <a href={`mailto:${contacto}`}>Contacto</a> : <Link href="/ayuda/tutoriales#soporte">Contacto</Link>}</li><li><Link href="/recuperar">Iniciar sesión</Link></li></ul></div>
    <div><h4>Legal</h4><ul><li><Link href="/privacidad">Política de privacidad</Link></li><li><span className="soon" title="Se publicarán antes de abrir las ventas">Términos y condiciones (próximamente)</span></li></ul></div>
    <div className="lp-copy">© {new Date().getFullYear()} Crea tu Oficina IA.</div></div></footer>);
}
