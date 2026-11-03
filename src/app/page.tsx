import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { LeadForm } from "@/lib/leadform";
import { CtaLink } from "@/lib/attribution";

export const metadata = { title: "Crea tu Oficina IA — tu propia agencia de inteligencia artificial", description: "Plataforma de marca blanca: ofrece servicios de inteligencia artificial a tus clientes con empleados digitales, sin programar. Pide una demostración." };

export default async function Home() {
  const { actor, agency } = await currentActor();
  if (agency) redirect("/agencia");
  if (actor) redirect("/oficina");
  const faq: [string, string][] = [
    ["¿Necesito saber de tecnología?", "No. Todo se hace tocando tarjetas y contestando preguntas sencillas. Si te atoras, hay una guía y un asistente que te orienta."],
    ["¿Me garantizan clientes o ganancias?", "No. Te damos las herramientas para armar y probar tu negocio. Los clientes y los ingresos dependen de ti."],
    ["¿Puedo probarlo sin conectar nada?", "Sí. Hay una prueba con un negocio inventado. Si la inteligencia artificial todavía no está activada, verás un ejemplo claramente marcado como ilustrativo."],
    ["¿Se publica o se envía algo sin mi permiso?", "Nunca. Publicar, enviar mensajes o cambiar precios siempre espera tu permiso."],
    ["¿Qué aplicaciones puedo conectar?", "Estamos preparando WhatsApp, Telegram, Instagram, Facebook, Shopify, Google Drive, Gmail y Calendario. Cada una dice su estado real: ninguna se presenta como lista si aún no lo está."],
    ["¿Cuánto cuesta?", "Ahora estamos en acceso anticipado y no cobramos nada. Ya puedes ver los planes y sus límites en la página de planes; los precios y la compra todavía no están abiertos. Te avisamos antes de cobrar cualquier cosa."],
    ["¿Puedo ver una demostración antes de decidir?", "Sí. Pídela en el formulario y una persona del equipo te la muestra. También puedes crear una cuenta de prueba y explorar por tu cuenta."],
  ];
  return (<div className="land">
    <header><b>🏛️ Crea tu Oficina IA</b><span className="row"><Link href="/planes">Planes</Link><Link href="/ayuda/tutoriales">Ayuda</Link><Link href="/login">Entrar</Link><CtaLink className="btn" href="/demo" cta="header-demo">Pedir demostración</CtaLink></span></header>
    <section style={{ paddingBottom: 20 }}><h1>Crea tu propia agencia de inteligencia artificial, aunque nunca hayas programado</h1>
      <p className="sub">Elige qué servicios ofrecer, arma tu equipo digital y prepara soluciones para tus futuros clientes. Nosotros ponemos la tecnología.</p>
      <p className="row"><CtaLink className="btn big" href="/demo" cta="hero-demo" testId="cta-demo">Pedir una demostración</CtaLink><CtaLink className="btn ghost big" href="/registro" cta="hero-registro" testId="cta-registro">Crear cuenta de prueba</CtaLink><a className="btn ghost big" href="#como">Ver cómo funciona</a></p>
      <p className="muted">Sin tarjeta · Sin cobros · Sin promesas de ganancias</p></section>

    <section id="como" style={{ paddingTop: 10 }}><h2>Así de fácil</h2><div className="cols">
      {[["1", "🛍️", "Elige qué ofrecer", "Anuncios, mensajes, inventarios, ventas… toca las tarjetas que quieras."], ["2", "🧑‍💼", "Arma tu equipo", "Cada empleado digital te explica qué hace y qué entrega."], ["3", "🧪", "Haz una prueba", "Míralo trabajar con un negocio inventado, sin conectar nada."]].map(([n, i, t, d]) => <div className="card" key={n}><span className="num">{n}</span><div style={{ fontSize: "2rem" }} aria-hidden="true">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>

    <section><h2>Así se ve por dentro</h2><p className="muted">Capturas de la aplicación real, con datos de demostración.</p>
      <div className="cols"><figure style={{ margin: 0 }}><img className="shot" src="/demo/servicios.png" alt="Tarjetas para elegir qué servicios ofrecer" loading="lazy" /><figcaption className="muted">Eliges con tarjetas, sin formularios.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/empleados.png" alt="Empleados explicados en cuatro frases sencillas" loading="lazy" /><figcaption className="muted">Cada empleado se explica en palabras de todos los días.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/inicio.png" alt="Pantalla de inicio con botones grandes" loading="lazy" /><figcaption className="muted">Botones grandes que hacen una cosa.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/oficina.png" alt="La oficina con sus empleados" loading="lazy" /><figcaption className="muted">Tu oficina, con tus empleados, en un mapa.</figcaption></figure></div></section>

    <section><h2>¿Para quién es?</h2><div className="cols">
      {[["💡", "Para quien quiere empezar", "No necesitas experiencia: te vamos guiando."], ["📣", "Para quien ya vende servicios", "Suma empleados digitales a lo que ya haces."], ["🤝", "Para quien tiene clientes", "Cada cliente tiene su propia oficina, separada de las demás."]].map(([i, t, d]) => <div className="card" key={t}><div style={{ fontSize: "2rem" }} aria-hidden="true">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>

    <section><h2>Qué incluye de verdad</h2><div className="cols">
      <div className="card"><h3>✅ Ya funciona</h3><ul><li>Crear tu negocio paso a paso</li><li>Elegir y enseñar a tus empleados</li><li>Una oficina por cada cliente</li><li>Preparar propuestas</li><li>Pedir permiso antes de cambios importantes</li></ul></div>
      <div className="card"><h3>🔧 Estamos terminando</h3><ul><li>Conectar WhatsApp, Instagram, Shopify y otras aplicaciones</li><li>Que los empleados trabajen con inteligencia artificial real en tu instalación</li><li>Cobros y planes (todavía no se cobra nada)</li></ul></div></div></section>

    <section><h2>¿Prefieres que te avisemos?</h2><p className="muted">Si todavía no quieres una demostración, deja tu correo y te avisamos cuando abramos más lugares. ¿Quieres hablar con alguien? <Link href="/demo">Pide una demostración</Link>.</p><LeadForm /></section>
    <section><h2>Preguntas frecuentes</h2>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</section>
    <footer><Link href="/planes">Planes</Link> · <Link href="/ayuda/tutoriales">Ayuda</Link> · <Link href="/privacidad">Política de privacidad</Link> · {process.env.NEXT_PUBLIC_CONTACT_EMAIL && <><a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL}</a> · </>} Crea tu Oficina IA. Los resultados dependen de cada persona; no se garantizan ganancias.</footer></div>);
}
