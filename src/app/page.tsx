import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { LeadForm } from "@/lib/leadform";
import { Attribution, BuyLink } from "@/lib/attribution";
import { Icon, IconName, BrandMark } from "@/components/Icon";
import { LandingHeader } from "@/components/landing/Header";
import { Laptop } from "@/components/landing/Laptop";
import { getDb } from "@/server/db";
import { formatPrice, planOf, planPriceInfo } from "@/server/agency/plans";
import { offerPlan, purchasesOpen } from "@/server/commerce/gate";
import { TESTIMONIALS } from "@/content/testimonials";
import { DEMO_VIEWS } from "@/lib/demo_data";

export const metadata = { title: { absolute: "Crea tu Oficina IA — crea tu oficina de empleados de inteligencia artificial" }, description: "Crea tu oficina de empleados de inteligencia artificial y automatiza tu negocio. Compra, recibe tu acceso por correo y configúrala en minutos. Sin reuniones ni instalaciones complicadas.", alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";
const AVISO: Record<string, string> = { cerrada: "Las compras todavía no están abiertas. Déjanos tu correo y te avisamos.", cancelada: "Cancelaste el pago: no se cobró nada. Cuando quieras, vuelve a intentarlo.", error: "No pudimos abrir el pago. No se cobró nada. Inténtalo de nuevo en unos minutos." };
const BENEFICIOS: [IconName, string, string][] = [
  ["bolt", "Automatiza tu operación", "Delega tareas de marketing, ventas y atención a empleados IA. Tú apruebas lo importante."],
  ["sparkle", "Configura tu oficina fácilmente", "Eliges tu negocio, una plantilla y tus empleados, con valores ya sugeridos."],
  ["users", "Sin reuniones ni instalaciones complicadas", "Pagas, recibes tu acceso por correo y todo se hace desde el navegador."],
  ["layers", "Administra múltiples oficinas", "Crea otras oficinas para otros negocios, cada una con sus datos y su suscripción."],
];
const PASOS: [IconName, string, string][] = [
  ["cursor", "Descubres Crea tu Oficina IA", "Conoces cómo funciona y ves el panel por dentro, sin registrarte."],
  ["card", "Realizas tu compra", "Un solo pago seguro con Stripe. No necesitas crear cuenta antes."],
  ["building", "Se crea automáticamente tu oficina", "Al confirmarse el pago, tu oficina privada se crea sola."],
  ["mail", "Recibes acceso seguro por correo", "Un enlace temporal de un solo uso. Sin contraseñas que recordar."],
  ["settings", "Configuras tus empleados y empiezas", "Nombre, negocio, plantilla y equipo, paso a paso."],
];
const VISTAS: Record<string, string> = { inicio: "inicio", "nueva-oficina": "nueva-oficina", "mis-oficinas": "mis-oficinas", empleados: "empleados", departamentos: "departamentos", automatizaciones: "automatizaciones", configuracion: "configuracion", facturacion: "facturacion" };

export default async function Home({ searchParams }: { searchParams: Promise<{ compra?: string; demo?: string }> }) {
  const { actor, agency } = await currentActor();
  if (agency) redirect("/oficinas"); if (actor) redirect("/oficina");
  const sp = await searchParams; const db = await getDb(); const open = (await purchasesOpen(db)).open;
  const plan = offerPlan(); const p = planOf(plan); const price = planPriceInfo(plan);
  const faq: [string, string][] = [
    ["¿Qué recibo exactamente al pagar?", `Una oficina IA propia y privada (plan ${p.label}): hasta ${p.maxClients} clientes y ${p.maxEmployees} empleados IA, con su panel, sus aprobaciones y su tope de uso de IA. Te llega un correo con tu enlace de acceso; no creas cuenta ni contraseña.`],
    ["¿Los empleados IA ya están trabajando?", "Cada empleado trabaja cuando tu oficina tiene la IA activa y conectas tus aplicaciones. Antes de publicar, enviar o gastar, siempre te pide tu permiso. Te decimos con claridad el estado de cada conexión."],
    ["¿Tengo que saber de tecnología?", "No. Al entrar te guiamos paso a paso con valores sugeridos. No hay juntas ni demostraciones: todo es autoservicio."],
    ["¿Puedo tener más de una oficina?", "Sí. Desde tu panel creas otra oficina (con su propia suscripción) y entras a cualquiera con un clic. Cada una tiene sus propios datos."],
    ["¿Puedo cancelar o pausar?", "Sí, desde «Mis oficinas»: cancelas una oficina al final del periodo pagado, o la pausas, sin afectar las demás. Tus datos se conservan."],
    ["¿Me garantizan clientes o ganancias?", "No. Te damos una herramienta de trabajo; los resultados dependen de ti."],
    ["¿Qué pasa si no me llega el correo?", "Revisa «Spam» y pide otro enlace en «Iniciar sesión» con el correo que usaste al pagar."],
  ];
  const Cta = ({ where, label = "Crear mi oficina IA" }: { where: string; label?: string }) => open
    ? <BuyLink cta={where} className="btn" testId={`cta-comprar-${where}`}>{label} <Icon name="arrow" size={18} /></BuyLink>
    : <a className="btn" href="#avisame" data-testid={`cta-avisame-${where}`}>Avísame cuando abran</a>;
  const contacto = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (<div className="lp"><Attribution track="visita" />
    <LandingHeader canBuy={open} />
    <main id="contenido" className="lp-main">
      {sp.compra && AVISO[sp.compra] && <div className="lp-wrap"><div className="tip lp-alert" role="alert" data-testid="buy-notice"><Icon name="help" size={18} /><span>{AVISO[sp.compra]}</span></div></div>}

      {/* 2 · HERO */}
      <section className="lp-hero" aria-labelledby="h1"><div className="lp-wrap lp-hero-grid">
        <div><span className="lp-badge"><Icon name="bolt" size={15} />Tu oficina IA, lista para configurar en minutos</span>
          <h1 id="h1"><span className="ln">Crea tu oficina de empleados</span> <span className="ln">de inteligencia artificial</span> <span className="ln lp-grad">y automatiza tu negocio</span></h1>
          <p className="lp-lead">Configura una oficina con empleados IA especializados para ayudarte con tareas de marketing, ventas, atención al cliente y más, desde un solo lugar.</p>
          <div className="lp-cta"><Cta where="hero" />
            <Link className="btn ghost" href="/panel-demo/inicio" data-testid="ver-panel"><Icon name="play" size={15} />Ver panel por dentro</Link></div>
          {open && price && <p className="lp-priceline" data-testid="hero-precio"><b>{formatPrice(price)}</b> · una sola suscripción, sin permanencia</p>}
          <div className="lp-trust"><span><Icon name="card" size={18} />Pago seguro (Stripe)</span><span><Icon name="bolt" size={18} />Activación automática</span><span><Icon name="users" size={18} />Sin reuniones</span><span><Icon name="shield" size={18} />Sin permanencia</span></div></div>
        <div><Laptop src="/landing/panel.webp" alt="Panel de Crea tu Oficina IA: resumen de oficinas, empleados y estados (datos de ejemplo)" priority /></div></div></section>

      {/* 3 · BENEFICIOS */}
      <section className="lp-section" style={{ paddingTop: 0 }} aria-label="Beneficios"><div className="lp-wrap"><div className="lp-grid c4">
        {BENEFICIOS.map(([i, t, d]) => <article className="lp-card lp-benefit" key={t}><span className="icon-box"><Icon name={i} size={24} /></span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></div></section>

      {/* 4 · CÓMO FUNCIONA */}
      <section className="lp-section" id="como" aria-labelledby="como-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">Del clic a tu oficina</span><h2 id="como-t">Cómo funciona</h2><p className="lp-sub">Cinco pasos, sin reuniones ni instalaciones.</p></div>
        <ol className="lp-steps" style={{ listStyle: "none", padding: 0, paddingLeft: undefined }}>{PASOS.map(([i, t, d], n) => <li className="lp-step" key={t}><span className="n" aria-hidden="true">{n + 1}</span><span className="icon-box"><Icon name={i} size={22} /></span><h3>{t}</h3><p>{d}</p></li>)}</ol>
        <div className="lp-note" role="note"><Icon name="shield" size={18} /><span>Cada empleado trabaja cuando conectas la IA y tus aplicaciones, y siempre te pide permiso antes de publicar, enviar o gastar. Te mostramos el estado real de cada conexión.</span></div></div></section>

      {/* 5 · VISTA DEL PRODUCTO */}
      <section className="lp-section" id="panel" aria-labelledby="panel-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">El panel por dentro</span><h2 id="panel-t">Conoce tu panel antes de comprar</h2><p className="lp-sub">Recorre la interfaz real con datos de ejemplo. Sin registro ni pago, sin información real.</p>
        <p style={{ marginTop: 24 }}><Link className="btn" href="/panel-demo/inicio" data-testid="ver-panel-2"><Icon name="play" size={15} />Ver panel por dentro</Link></p></div>
        <div className="lp-views">{DEMO_VIEWS.map((v) => <Link key={v.slug} href={`/panel-demo/${v.slug}`} className="lp-card lp-view" data-testid={`vista-${v.slug}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/landing/vista-${VISTAS[v.slug]}.webp`} alt={`Vista «${v.label}» del panel (datos de ejemplo)`} width={800} height={500} loading="lazy" decoding="async" />
          <div><h3><Icon name={v.icon as IconName} size={18} />{v.label}</h3><p>{v.desc}</p></div></Link>)}</div></div></section>

      {/* 6 · TESTIMONIOS (solo reales; vista previa rotulada con ?demo=testimonios) */}
      {(TESTIMONIALS.length > 0 || sp.demo === "testimonios") && <section className="lp-section" id="testimonios" aria-labelledby="test-t"><div className="lp-wrap"><div className="lp-center"><h2 id="test-t">Lo que dicen nuestros usuarios</h2>
        {TESTIMONIALS.length === 0 && <p><span className="lp-ribbon" data-testid="demo-ribbon">Diseño de demostración · no son testimonios reales</span></p>}</div>
        <div className="lp-grid c3" style={{ marginTop: 32 }}>{(TESTIMONIALS.length ? TESTIMONIALS : [0, 1, 2].map(() => ({ name: "Nombre del cliente", role: "Cargo · Empresa", quote: "Aquí irá el testimonio real de un cliente, con su permiso." }))).map((t, i) =>
          <figure className="lp-card lp-quote" key={i} style={{ margin: 0 }}><blockquote>“{t.quote}”</blockquote><footer><span className="lp-avatar" aria-hidden="true"><Icon name="user" size={22} /></span><span><b style={{ color: "#fff", display: "block" }}>{t.name}</b>{t.role}</span></footer></figure>)}</div></div></section>}

      {/* 7 · OFICINAS DEL CLIENTE */}
      <section className="lp-section" aria-label="Oficinas del cliente" style={{ paddingTop: 0 }}><div className="lp-wrap"><div className="lp-offices">
        <div><span className="lp-eyebrow">Tu oficina IA, a tu medida</span><h2>Crea, gestiona y escala tus oficinas IA</h2><p>Lanza nuevas oficinas y administra todas desde un solo panel, cada una con sus propios datos, plan y límites.</p></div>
        <Link href="/oficinas/nueva" className="lp-office" data-testid="card-nueva-oficina"><span className="icon-box fill"><Icon name="plus" size={26} /></span><span><h3>Nueva oficina IA</h3><p>Configura y compra otra oficina desde tu cuenta, con negocio, plantilla y empleados.</p><small>Requiere iniciar sesión</small></span></Link>
        <Link href="/oficinas" className="lp-office" data-testid="card-mis-oficinas"><span className="icon-box"><Icon name="layers" size={26} /></span><span><h3>Mis oficinas</h3><p>Entra, administra, pausa y cambia entre todas tus oficinas con un clic.</p><small>Requiere iniciar sesión</small></span></Link></div></div></section>

      {/* 8 · OFERTA Y CONVERSIÓN */}
      <section className="lp-section" id="oferta" aria-labelledby="oferta-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">Oferta</span><h2 id="oferta-t">Tu oficina IA</h2><p className="lp-sub">Una suscripción mensual. Sin letras chiquitas ni contratos largos.</p></div>
        <div className="lp-offer"><div className="lp-plan" data-testid="oferta"><h3>Plan {p.label}</h3>
          <p className="lp-price">{price ? formatPrice(price).replace("/mes", "") : "Próximamente"}{price && <small> / mes</small>}</p>
          <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: ".92rem" }}>{price ? "Es tu primer pago y tu mensualidad: se cobra al confirmar y cada mes." : "El precio se publica al abrir las compras."}</p>
          <ul className="lp-list"><li><Icon name="check" size={18} /><span>Oficina propia y <b>privada</b>, separada de las demás</span></li><li><Icon name="check" size={18} /><span>Hasta <b>{p.maxClients}</b> clientes y <b>{p.maxEmployees}</b> empleados IA</span></li><li><Icon name="check" size={18} /><span>Aprobación antes de publicar, enviar o gastar</span></li><li><Icon name="check" size={18} /><span>Tope mensual de uso de IA propio, sin sorpresas</span></li><li><Icon name="check" size={18} /><span>Acceso por correo: sin contraseña ni registro previo</span></li><li><Icon name="check" size={18} /><span>Crea más oficinas, cada una con su suscripción</span></li></ul>
          <div className="lp-cta" style={{ margin: 0 }}><Cta where="oferta" /></div></div>
          <div className="lp-faq" aria-label="Preguntas frecuentes"><h3 style={{ margin: "0 0 16px", fontSize: "1.2rem" }}>Preguntas frecuentes</h3>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>
        {!open && <div id="avisame" style={{ maxWidth: 640, margin: "56px auto 0" }}><div className="lp-center"><h2 style={{ fontSize: "1.6rem" }}>Avísame cuando abran las compras</h2><p className="lp-sub">Dejas tu correo y te avisamos. No hay llamadas ni demostraciones.</p></div><LeadForm /></div>}</div></section>

      <section className="lp-final" aria-labelledby="final-t"><div className="lp-wrap"><h2 id="final-t" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>Crea hoy tu oficina de empleados de IA</h2><p className="lp-sub">Automatiza tu negocio, gana tiempo y escala sin complicaciones.</p>
        <div className="lp-cta"><Cta where="final" /><Link className="btn ghost" href="/panel-demo/inicio"><Icon name="play" size={15} />Ver panel por dentro</Link></div></div></section>
    </main>

    {/* 9 · FOOTER */}
    <footer className="lp-footer"><div className="lp-wrap" style={{ display: "grid" }}>
      <div><Link href="/" className="lp-logo"><BrandMark size={34} />Crea tu Oficina IA</Link><p style={{ marginTop: 14 }}>Oficinas de empleados de inteligencia artificial para tu negocio. Los resultados dependen de cada persona; no se garantizan ganancias.</p></div>
      <div><h4>Producto</h4><ul><li><Link href="/panel-demo/inicio">Ver panel por dentro</Link></li><li><a href="#oferta">Oferta</a></li><li><Link href="/oficinas">Acceso al panel</Link></li></ul></div>
      <div><h4>Soporte</h4><ul><li><Link href="/ayuda/tutoriales">Ayuda</Link></li><li>{contacto ? <a href={`mailto:${contacto}`}>Contacto</a> : <Link href="/ayuda/tutoriales#soporte">Contacto</Link>}</li><li><Link href="/recuperar">Iniciar sesión</Link></li></ul></div>
      <div><h4>Legal</h4><ul><li><Link href="/privacidad">Política de privacidad</Link></li><li><span className="soon" title="Se publicarán antes de abrir las ventas">Términos y condiciones (próximamente)</span></li></ul></div>
      <div className="lp-copy">© {new Date().getFullYear()} Crea tu Oficina IA.</div></div></footer></div>);
}
