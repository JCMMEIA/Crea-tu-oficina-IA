import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { LeadForm } from "@/lib/leadform";
import { Attribution, BuyLink } from "@/lib/attribution";
import { getDb } from "@/server/db";
import { formatPrice, planOf, planPriceInfo } from "@/server/agency/plans";
import { offerPlan, purchasesOpen } from "@/server/commerce/gate";

export const metadata = { title: "Crea tu Oficina IA — tu propia oficina de empleados de inteligencia artificial", description: "Compra, recibe tu acceso por correo y configura tu oficina IA en minutos: empleados digitales que preparan anuncios, mensajes, inventarios y más. Tú apruebas todo." };
export const dynamic = "force-dynamic";
const AVISO: Record<string, string> = { cerrada: "Las compras todavía no están abiertas. Déjanos tu correo y te avisamos.", cancelada: "Cancelaste el pago: no se cobró nada. Cuando quieras, vuelve a intentarlo.", error: "No pudimos abrir el pago. No se cobró nada. Inténtalo de nuevo en unos minutos." };

export default async function Home({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  const { actor, agency } = await currentActor();
  if (agency) redirect("/oficinas"); if (actor) redirect("/oficina");
  const sp = await searchParams; const db = await getDb(); const open = (await purchasesOpen(db)).open;
  const plan = offerPlan(); const p = planOf(plan); const price = planPriceInfo(plan);
  const faq: [string, string][] = [
    ["¿Qué recibo exactamente al pagar?", `Una oficina IA propia y privada (plan ${p.label}): hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados digitales, con su panel, sus aprobaciones y su tope de uso de IA. Te llega un correo con tu enlace de acceso; no creas cuenta ni contraseña.`],
    ["¿Tengo que saber de tecnología?", "No. Al entrar te guiamos paso a paso: nombre, tipo de negocio, plantilla y empleados, con valores ya sugeridos. No hay juntas ni demostraciones: todo es autoservicio."],
    ["¿Se publica o se envía algo sin mi permiso?", "Nunca. Publicar, enviar mensajes o cambiar precios siempre espera tu aprobación."],
    ["¿Puedo tener más de una oficina?", "Sí. Desde tu panel creas otra oficina (con su propia suscripción), y entras a cualquiera con un clic. Cada una tiene sus propios datos."],
    ["¿Puedo cancelar?", "Sí, desde «Mis oficinas»: se cancela al final del periodo ya pagado y tus datos se conservan. También puedes pausar una oficina sin afectar las demás."],
    ["¿Me garantizan clientes o ganancias?", "No. Te damos una herramienta de trabajo; los resultados dependen de ti."],
    ["¿Qué pasa si no me llega el correo?", "Revisa «Spam» y pide otro enlace en «Recuperar mi acceso» con el correo que usaste al pagar."],
  ];
  const Cta = ({ where }: { where: string }) => open ? <BuyLink cta={where} className="btn big" testId={`cta-comprar-${where}`}>Crear mi oficina IA</BuyLink> : <a className="btn big" href="#avisame">Avísame cuando abran</a>;
  return (<div className="land"><Attribution track="visita" />
    <header><b>🏛️ Crea tu Oficina IA</b><span className="row"><Link href="/ayuda/tutoriales">Ayuda</Link><Link href="/recuperar">Ya compré</Link></span></header>
    {sp.compra && AVISO[sp.compra] && <div className="tip" role="alert" data-testid="buy-notice">{AVISO[sp.compra]}</div>}
    <section style={{ paddingBottom: 20 }}><h1>Tu oficina de empleados de inteligencia artificial, lista en minutos</h1>
      <p className="sub">Pagas, recibes tu acceso por correo y configuras tu oficina con pasos guiados: anuncios, mensajes, inventarios y más. Tú apruebas todo antes de que se haga.</p>
      <p className="row"><Cta where="hero" />{open && price && <span style={{ fontSize: "1.2rem" }} data-testid="hero-precio"><b>{formatPrice(price)}</b></span>}</p>
      <p className="muted">Sin juntas · Sin demostraciones · Sin registro previo · Pago seguro con Stripe · Cancelas al final del periodo</p></section>

    <section id="como"><h2>Así funciona</h2><div className="cols">
      {[["1", "💳", "Pagas", "Un solo pago seguro. No necesitas crear cuenta antes."], ["2", "✉️", "Recibes tu acceso", "Te enviamos un enlace por correo y tu oficina se crea sola."], ["3", "🧭", "Configuras en minutos", "Nombre, tipo de negocio, plantilla y empleados con valores sugeridos."], ["4", "✅", "Pides tu primera tarea", "Tus empleados trabajan; tú apruebas lo importante."]].map(([n, i, t, d]) => <div className="card" key={n}><span className="num">{n}</span><div style={{ fontSize: "2rem" }} aria-hidden="true">{i}</div><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>

    <section><h2>Así se ve por dentro</h2><p className="muted">Capturas de la aplicación real, con un negocio de ejemplo (los datos son inventados).</p>
      <div className="cols"><figure style={{ margin: 0 }}><img className="shot" src="/demo/servicios.png" alt="Tarjetas para elegir qué servicios ofrecer" loading="lazy" /><figcaption className="muted">Eliges con tarjetas, sin formularios.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/empleados.png" alt="Empleados explicados en cuatro frases sencillas" loading="lazy" /><figcaption className="muted">Cada empleado se explica en palabras de todos los días.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/oficina.png" alt="La oficina con sus empleados" loading="lazy" /><figcaption className="muted">Tu oficina, con tus empleados, en un mapa.</figcaption></figure></div></section>

    <section><h2>Ejemplos de pedidos que puedes hacer</h2><div className="cols">
      {[["📣", "«Escribe 3 anuncios para el desayuno del fin de semana»"], ["📦", "«¿Qué productos se acaban esta semana?»"], ["💬", "«Un cliente preguntó por un reembolso: redacta una respuesta amable»"]].map(([i, t]) => <div className="card" key={t}><div style={{ fontSize: "1.6rem" }} aria-hidden="true">{i}</div><p>{t}</p></div>)}</div>
      <p className="muted">Son ejemplos de lo que puedes pedir. Los resultados dependen de la información que cargues y no se garantizan ganancias.</p></section>

    <section id="oferta"><h2>Tu oficina IA</h2>
      <div className="card" style={{ maxWidth: 520 }} data-testid="oferta"><h3>Plan {p.label}</h3>
        <p style={{ fontSize: "1.8rem", margin: "6px 0" }}><b>{open || price ? formatPrice(price) : "Próximamente"}</b></p>
        <ul><li>Oficina propia y <b>privada</b>, separada de las demás</li><li>Hasta <b>{p.maxClients}</b> clientes y <b>{p.maxEmployees}</b> empleados IA</li><li>Aprobaciones antes de publicar, enviar o gastar</li><li>Tope mensual de uso de IA propio, sin sorpresas</li><li>Acceso por correo: sin contraseña ni registro</li><li>Puedes crear más oficinas, cada una con su suscripción</li></ul>
        <p><Cta where="oferta" /></p></div></section>

    {!open && <section id="avisame"><h2>Avísame cuando abran las compras</h2><p className="muted">Dejas tu correo y te avisamos. No hay llamadas ni demostraciones.</p><LeadForm /></section>}
    <section><h2>Preguntas frecuentes</h2>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</section>
    <footer><Link href="/ayuda/tutoriales">Ayuda</Link> · <Link href="/privacidad">Política de privacidad</Link> · {process.env.NEXT_PUBLIC_CONTACT_EMAIL && <><a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL}</a> · </>}Crea tu Oficina IA. Los resultados dependen de cada persona; no se garantizan ganancias.</footer></div>);
}
