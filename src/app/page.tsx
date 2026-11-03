import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { LeadForm } from "@/lib/leadform";
import { pickUtm } from "@/server/leads";
import { INDUSTRIES } from "@/server/agency/industries";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { actor, agency } = await currentActor();
  if (agency) redirect("/agencia");
  if (actor) redirect("/oficina");
  const utm = pickUtm(await searchParams);
  const faq: [string, string][] = [
    ["¿Qué es Crea tu Oficina IA?", "Una plataforma para que construyas tu propia agencia de servicios de IA: eliges servicios, personalizas agentes, creas una oficina independiente por cliente y supervisas tareas, costos y resultados."],
    ["¿Necesito saber programar?", "No. El asistente guía la creación de la agencia, de los servicios y de las oficinas de cliente. Necesitas criterio comercial y saber explicar el valor a tus clientes."],
    ["¿Me garantizan ingresos o clientes?", "No. La plataforma es una herramienta de trabajo. No prometemos ingresos ni resultados: depende de tu oferta, tu venta y la calidad de tu servicio."],
    ["¿Qué integraciones funcionan hoy?", "Estamos construyendo las conexiones con Composio y con las APIs oficiales. Hasta que cada una esté verificada con una cuenta real, se marca como pendiente en la plataforma. Los empleados ya funcionan sin conexiones para tareas de redacción, análisis y planificación."],
    ["¿Mis clientes ven la plataforma o mi marca?", "Cada oficina de cliente muestra tu nombre, logo y color. Los dominios propios y la reventa bajo licencia están en el plan de trabajo y aún no están disponibles."],
    ["¿Los datos de mis clientes están separados?", "Sí: cada cliente tiene su oficina aislada y una agencia nunca puede consultar los clientes de otra. El aislamiento se aplica en el servidor y está cubierto por pruebas automatizadas."],
    ["¿Un agente puede publicar o enviar mensajes por su cuenta?", "No por defecto. Las acciones que modifican algo (presupuestos, publicaciones, mensajes) quedan como solicitudes que tú o tu cliente aprueban, y se registra la evidencia de lo ejecutado."],
    ["¿Cuánto cuesta?", "En esta etapa de acceso anticipado no hay cobros. Los planes y precios se anunciarán antes de cualquier cobro, y nunca se cobrará sin tu autorización."],
    ["¿Cuánto cuesta la IA?", "La plataforma estima el costo de IA por servicio, cliente y agente, y permite fijar presupuestos y límites. Son estimaciones calculadas con las tarifas del proveedor de modelos."],
  ];
  return (<div className="land">
    <header><b>🏛️ Crea tu Oficina IA</b><span className="row"><Link href="/login">Entrar</Link><a className="btn" href="#acceso">Acceso anticipado</a></span></header>
    <section><h1>Crea tu propia agencia de inteligencia artificial sin empezar desde cero</h1>
      <p className="sub">Elige servicios, personaliza agentes y prepara soluciones de inteligencia artificial para ofrecerlas a negocios desde una sola plataforma.</p>
      <p className="row"><a className="btn big" href="#acceso">Quiero acceso anticipado</a><a className="btn ghost big" href="#demo">Ver el producto</a></p>
      <p className="muted">Sin tarjeta, sin cobros, sin promesas de ingresos.</p></section>
    <section id="demo"><h2>El producto real</h2><p className="muted">Capturas de la aplicación en funcionamiento (datos de demostración). Lo que ves es lo que existe hoy.</p>
      <div className="cols"><figure style={{ margin: 0 }}><img className="shot" src="/demo/panel-agencia.png" alt="Panel de agencia con clientes, servicios y consumo de IA" /><figcaption className="muted">Panel de agencia: clientes, servicios, costos y tu camino de lanzamiento.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/servicios.png" alt="Catálogo de servicios con precios y costo de IA estimado" /><figcaption className="muted">Catálogo de servicios con precios y estimación de costo de IA.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/oficina-cliente.png" alt="Oficina de un cliente con marca de la agencia" /><figcaption className="muted">La oficina de cada cliente, con la marca de tu agencia.</figcaption></figure>
        <figure style={{ margin: 0 }}><img className="shot" src="/demo/propuesta.png" alt="Propuesta comercial generada" /><figcaption className="muted">Propuesta comercial lista para copiar o imprimir.</figcaption></figure></div></section>
    <section><h2>Beneficios</h2><div className="cols">
      {[["Empieza con una base lista", "41 empleados de IA en 7 departamentos, con skills iniciales que puedes adaptar."], ["Tu método, reutilizable", "Personaliza una skill una vez y úsala en cada cliente nuevo; cada cliente la ajusta sin afectar a los demás."], ["Una oficina por cliente", "Datos, conexiones y tareas aislados. Una agencia nunca ve a los clientes de otra."], ["Tú controlas lo importante", "Las acciones sensibles esperan aprobación y dejan evidencia. Nada se simula."], ["Costos bajo control", "Estimación por servicio, presupuesto por cliente y por agencia, y topes de ejecución."], ["Tu marca, no la nuestra", "Nombre, logo y color de tu agencia en la oficina que ven tus clientes."]].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>
    <section><h2>Cómo funciona</h2><div className="cols">
      {[["Crea tu agencia", "Nombre, especialidad, logo y color."], ["Arma tu catálogo", "Elige servicios o parte de una plantilla por industria y fija tus precios."], ["Configura tus agentes", "Adapta las skills a tu método de trabajo."], ["Agrega un cliente", "Se crea su oficina independiente y despliegas el servicio."], ["Personaliza y conecta", "Ajusta los agentes al negocio y conecta sus aplicaciones, con su autorización."], ["Supervisa", "Tareas, costos, aprobaciones y resultados desde tu panel."]].map(([t, d], i) => <div className="card" key={t}><span className="num">{i + 1}</span><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>
    <section><h2>Ejemplos de servicios que podrías ofrecer</h2><p className="muted">Son ejemplos de paquetes. Los precios los defines tú; las plantillas incluyen precios sugeridos editables, sin garantía de resultados.</p>
      <div className="cols">{INDUSTRIES.flatMap((i) => i.services.map((s) => ({ ...s, ind: i.name }))).slice(0, 8).map((s) => <div className="card" key={s.name}><span className="chip">{s.ind}</span><h3>{s.name}</h3><p className="muted">{s.description}</p></div>)}</div></section>
    <section><h2>Qué es real hoy y qué viene</h2><div className="cols">
      <div className="card"><h3>Disponible en la plataforma</h3><ul><li>Agencias, clientes y oficinas aisladas</li><li>Catálogo, skills reutilizables y versiones</li><li>Tareas, historial y aprobaciones</li><li>Propuestas y estimación de costos</li><li>Límites de consumo</li></ul></div>
      <div className="card"><h3>En construcción</h3><ul><li>Conexiones con aplicaciones (en verificación)</li><li>Cobros y suscripciones</li><li>Dominios propios y reventa con licencia</li><li>Chat con los agentes y app móvil</li></ul></div></div></section>
    <section><LeadForm utm={utm} /></section>
    <section><h2>Preguntas frecuentes</h2>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</section>
    <footer><Link href="/privacidad">Política de privacidad</Link> · © Crea tu Oficina IA. Los resultados dependen de cada agencia; no se garantizan ingresos.</footer></div>);
}
