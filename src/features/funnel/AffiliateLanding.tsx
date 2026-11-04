import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Attribution } from "./tracking/attribution";
import { AFF } from "./config/afiliados";
import { LandingHeader } from "./components/Header";
import { Footer } from "./components/Footer";
import { Estatus, SectionHead } from "./components/ui";
import { Reveal } from "./components/Reveal";
import { applyAffiliateAction } from "@/app/afiliados_actions";
import "./funnel.css";

/** Landing del camino B: programa de afiliados. Ruta «/afiliados». El formulario solo crea una SOLICITUD que una persona revisa; no hay inscripción automática. */
export function AffiliateLanding({ ok, error }: { ok?: string; error?: string }) {
  return (<div className="lp fx"><Attribution track="visita" /><LandingHeader canBuy={false} anchorBase="/" />
    <main id="contenido" className="lp-main">
      <section className="lp-hero fx-hero" aria-labelledby="h1"><div className="lp-wrap" style={{ maxWidth: 980 }}><span className="lp-badge"><Icon name="trend" size={15} />{AFF.hero.estado}</span>
        <h1 id="h1" style={{ fontSize: "clamp(2rem,5vw,3.2rem)", lineHeight: 1.08, margin: "20px 0" }}><span className="ln">{AFF.hero.titulo[0]}</span><span className="ln lp-grad">{AFF.hero.titulo[1]}</span></h1><p className="lp-lead">{AFF.hero.lead}</p>
        <div className="lp-cta"><a className="btn" href="#solicitud" data-testid="aff-cta-solicitud">Solicitar mi invitación</a><a className="btn ghost" href="#como-afiliados">Cómo funciona</a></div><p className="fx-small">Este programa es de recomendación. No vendemos licencias para crear plataformas propias. No prometemos ingresos.</p></div></section>
      <section className="lp-section fx-alt" id="modelo" aria-labelledby="mod-t"><div className="lp-wrap"><SectionHead id="mod-t" eyebrow="El modelo" titulo="Comisión recurrente, con reglas claras" lead="Propuesta inicial del programa: las condiciones definitivas se publicarán tras su revisión." />
        <div className="fx-tiers" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>{AFF.modelo.map(([t, d]) => <article key={t} className="fx-tier" data-testid="aff-modelo"><h3 style={{ fontSize: "1.05rem" }}>{t}</h3><p className="muted" style={{ minHeight: 0 }}>{d}</p></article>)}</div></div></section>
      <section className="lp-section" id="como-afiliados" aria-labelledby="coma-t"><div className="lp-wrap"><SectionHead id="coma-t" eyebrow="Cómo funciona" titulo="De la solicitud al primer pago" />
        <ol className="fx-timeline">{AFF.pasos.map(([t, d], n) => <li key={t}><Reveal><div className="fx-tstep"><span className="fx-tn" aria-hidden="true">{n + 1}</span><div><h3>{t}</h3><p>{d}</p></div></div></Reveal></li>)}</ol></div></section>
      <section className="lp-section fx-alt" aria-labelledby="prom-t"><div className="lp-wrap"><SectionHead id="prom-t" eyebrow="Qué recomiendas" titulo="Una oficina de IA para distintas áreas de un negocio" lead={AFF.promueves} /><p className="lp-center"><Estatus de="tareasGuiadas" /> <span className="fx-small">Las funciones se describen con su estado real; no prometas lo que aún no está disponible.</span></p></div></section>
      <section className="lp-section" aria-labelledby="priv-t"><div className="lp-wrap fx-split"><div><SectionHead center={false} id="priv-t" eyebrow="Privacidad" titulo="Tú recomiendas; los datos de los clientes son de ellos" /><ul className="fx-checks">{AFF.privacidad.map((p) => <li key={p}><span className="fx-ck"><Icon name="lock" size={14} /></span><div><span>{p}</span></div></li>)}</ul></div>
        <div><h3>Reglas del programa</h3><ul className="fx-cases">{AFF.reglas.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul></div></div></section>
      <section className="lp-section fx-alt" id="solicitud" aria-labelledby="sol-t"><div className="lp-wrap" style={{ maxWidth: 680 }}><SectionHead id="sol-t" eyebrow="Solicitud" titulo="Solicita tu invitación" lead="Revisamos cada solicitud de forma manual. Aprobarla no es automático." />
        {ok && <div className="notice ok" role="status" data-testid="aff-ok">{ok}</div>}{error && <div className="notice bad" role="alert">{error}</div>}
        <form action={applyAffiliateAction} className="card" data-testid="aff-form"><label htmlFor="af-n">Tu nombre</label><input id="af-n" name="name" required minLength={2} maxLength={120} autoComplete="name" /><label htmlFor="af-e">Tu correo</label><input id="af-e" name="email" type="email" required autoComplete="email" /><label htmlFor="af-c">¿Dónde recomendarías la plataforma? (opcional)</label><textarea id="af-c" name="channel" rows={3} maxLength={300} placeholder="Tu comunidad, tu canal, tus clientes…" />
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} /><label style={{ fontWeight: 400 }}><input type="checkbox" name="acceptTerms" required style={{ width: "auto" }} /> Acepto las condiciones del programa (borrador) y entiendo que mi solicitud será revisada.</label><p><button className="big" data-testid="aff-enviar">Enviar solicitud</button></p></form>
        <details className="card" style={{ marginTop: 12 }}><summary><b>Condiciones del programa (borrador)</b></summary><p className="fx-small">Resumen: comisión sobre cobros netos elegibles, durante un máximo de cobros por cliente; retención antes de aprobar; ajuste por reembolsos y contracargos; sin autorreferidos; prácticas prohibidas; sin acceso a datos de clientes; pagos mensuales. Texto completo en revisión legal antes de publicarse.</p></details></div></section>
      <section className="lp-section" id="faq" aria-labelledby="faq-t"><div className="lp-wrap"><SectionHead id="faq-t" eyebrow="Preguntas frecuentes" titulo="Lo que más preguntan los afiliados" /><div className="lp-faq fx-faq">{AFF.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>
      <section className="lp-final"><div className="lp-wrap"><h2 className="fx-h2">¿Prefieres usar la IA en tu propio negocio?</h2><p className="lp-sub">Conoce la oficina de empleados IA para las distintas áreas de tu empresa.</p><div className="lp-cta"><Link className="btn" href="/">Crear mi Oficina IA</Link></div></div></section>
    </main><Footer base="/" /></div>);
}
