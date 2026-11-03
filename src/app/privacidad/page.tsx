import Link from "next/link";
export const metadata = { title: "Política de privacidad — Crea tu Oficina IA" };
export default function Privacidad() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "el correo de contacto publicado en este sitio";
  return (<div className="auth" style={{ maxWidth: 760 }}><p><Link href="/">← Volver</Link></p><h1>Política de privacidad</h1>
    <p className="muted">Última actualización: 3 de noviembre de 2026. <b>Borrador:</b> debe ser revisado por un asesor legal y completado con la razón social y los datos de contacto antes de recibir tráfico de pago.</p>
    <h2>Qué datos recogemos</h2><p>En el formulario de acceso anticipado: nombre (opcional), correo, etapa, mensaje (opcional) y el consentimiento. Si llegas desde un anuncio, guardamos los parámetros de campaña (<code>utm_*</code>, <code>fbclid</code>). En la plataforma: los datos de tu cuenta y los que tú cargas.</p>
    <h2>Para qué los usamos</h2><p>Para responder tu solicitud, avisarte del acceso anticipado y medir qué campañas funcionan. No vendemos tus datos.</p>
    <h2>Cookies y Meta</h2><p>Podemos usar el píxel de Meta para medir campañas. <b>Solo se carga si lo aceptas</b> en el aviso de cookies y puedes rechazarlo. Si lo aceptas, Meta recibe datos de navegación según su propia política.</p>
    <h2>Conservación y derechos</h2><p>Conservamos tus datos mientras sea necesario para el acceso anticipado. Puedes pedir acceso, corrección o eliminación escribiendo a {contact}.</p>
    <h2>Datos dentro de la plataforma</h2><p>Cada agencia y cada empresa cliente tienen sus datos aislados. Los textos que envías a los empleados de IA se procesan con un proveedor de modelos de IA para generar resultados; las contraseñas se guardan con hash y no almacenamos credenciales de aplicaciones de terceros.</p></div>);
}
