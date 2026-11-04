import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Flash } from "@/lib/ui";
import { LeadForm } from "@/lib/leadform";
import { Attribution } from "./tracking/attribution";
import { AFILIADOS_PAGE, COMISIONES, GESTIONADO_PAGE } from "./config/caminos";
import { LandingHeader } from "./components/Header";
import { Footer } from "./components/Footer";
import { Estatus, SectionHead } from "./components/ui";
import "./funnel.css";

/** Camino B: lista de INTERÉS de afiliados. No hay inscripción, enlaces, atribución ni comisiones (todavía no se implementa): solo se recogen datos de contacto con consentimiento. */
export function AffiliatePage({ error }: { error?: string }) {
  return (<div className="lp fx"><Attribution track="visita" /><LandingHeader canBuy={false} /><main id="contenido" className="lp-main">
    <section className="fx-pagehero" aria-labelledby="h1"><div className="lp-wrap" style={{ maxWidth: 900 }}><span className="lp-badge"><Icon name="trend" size={15} />{AFILIADOS_PAGE.estado}</span>
      <h1 id="h1" style={{ fontSize: "clamp(2rem,5vw,3.1rem)", lineHeight: 1.08, margin: "20px 0" }}><span className="ln">{AFILIADOS_PAGE.titulo[0]}</span><span className="ln lp-grad">{AFILIADOS_PAGE.titulo[1]}</span></h1><p className="lp-lead">{AFILIADOS_PAGE.lead}</p><p><Estatus de="afiliados" /></p></div></section>
    <section className="lp-section fx-alt" aria-labelledby="pr-t"><div className="lp-wrap"><SectionHead id="pr-t" eyebrow="Principios" titulo="Lo que ya sabemos que queremos" /><div className="fx-tiers" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>{AFILIADOS_PAGE.principios.map(([t, d]) => <article key={t} className="fx-tier"><h3 style={{ fontSize: "1.1rem" }}>{t}</h3><p className="muted" style={{ minHeight: 0 }}>{d}</p></article>)}</div></div></section>
    <section className="lp-section" id="comisiones" aria-labelledby="com-t"><div className="lp-wrap"><SectionHead id="com-t" eyebrow="Comisiones" titulo={COMISIONES.titulo} /><p className="fx-pricenote" role="note" data-testid="aff-aviso" style={{ marginTop: 16 }}><Icon name="clock" size={16} /><span>{COMISIONES.aviso}</span></p>
      <div className="fx-comm" data-testid="aff-comisiones">{COMISIONES.items.map(([t, d, c]) => <div key={t} className={c}><b>{t}</b><span>{d}</span></div>)}</div></div></section>
    <section className="lp-section fx-alt" id="interes" aria-labelledby="int-t"><div className="lp-wrap" style={{ maxWidth: 680 }}><SectionHead id="int-t" eyebrow="Lista de interés" titulo="Avísame cuando el programa esté listo" lead="Solo guardamos tu contacto para avisarte. No es una inscripción ni te da enlace ni comisión todavía." />
      <Flash sp={{ error }} /><LeadForm landing="/afiliados" title="Quiero ser afiliado" intro="Déjanos tu correo y te avisamos cuando el programa esté listo." submit="Avisarme del programa" /></div></section>
    <p className="lp-center"><Link href="/">← Volver a la landing principal</Link></p></main><Footer /></div>);
}
/** Servicio secundario: solicitud de diagnóstico (contacto). No es una tercera plataforma ni un proceso definido. */
export function ManagedPage({ error }: { error?: string }) {
  return (<div className="lp fx"><Attribution track="visita" /><LandingHeader canBuy={false} /><main id="contenido" className="lp-main">
    <section className="fx-pagehero" aria-labelledby="h1"><div className="lp-wrap" style={{ maxWidth: 900 }}><span className="lp-badge">Servicio secundario</span><h1 id="h1" style={{ fontSize: "clamp(2rem,5vw,3.1rem)", lineHeight: 1.08, margin: "20px 0" }}>{GESTIONADO_PAGE.titulo}</h1><p className="lp-lead">{GESTIONADO_PAGE.lead}</p><p className="fx-small">{GESTIONADO_PAGE.nota}</p></div></section>
    <section className="lp-section fx-alt" id="diagnostico" aria-labelledby="dg-t"><div className="lp-wrap" style={{ maxWidth: 680 }}><SectionHead id="dg-t" eyebrow="Diagnóstico" titulo="Solicita tu diagnóstico" /><Flash sp={{ error }} /><LeadForm kind="demo" landing="/servicio-gestionado" title="Solicitar diagnóstico" intro="Cuéntanos de tu negocio y te contactamos. Sin costo ni compromiso." submit="Solicitar diagnóstico" /></div></section>
    <p className="lp-center"><Link href="/">← Volver a la landing principal</Link></p></main><Footer /></div>);
}
