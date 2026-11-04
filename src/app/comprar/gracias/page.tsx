import Link from "next/link";
export const metadata = { title: "¡Pago recibido! — Crea tu Oficina IA", robots: { index: false } };
export default function Gracias() {
  return (<div className="auth"><h1>¡Gracias por tu compra! 🎉</h1>
    <p data-testid="thanks-buy">Estamos preparando tu oficina IA. En unos minutos recibirás un <b>correo con tu enlace de acceso</b> (vale 30 minutos y se usa una sola vez). No necesitas crear cuenta ni contraseña.</p>
    <div className="card"><b>¿No te llega?</b><ul><li>Revisa «Spam» o «Promociones».</li><li>Espera 2–3 minutos: el correo sale al confirmarse el pago.</li><li>Pide otro enlace con el correo que usaste al pagar: <Link href="/recuperar">Recuperar mi acceso</Link>.</li></ul></div>
    <p className="muted">Si algo no funciona, escríbenos desde <Link href="/ayuda/tutoriales#soporte">soporte</Link>.</p></div>);
}
