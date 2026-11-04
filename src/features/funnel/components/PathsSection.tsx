import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CtaLink } from "../tracking/attribution";
import { CAMINOS } from "../config/caminos";
import { FEATURE_NOMBRES } from "../config/content";
import { ESTADO_LABEL, FEATURES, type Estado } from "../config/disponibilidad";
import { Estatus, SectionHead } from "./ui";

const GRUPOS: { e: Estado; t: string; d: string }[] = [
  { e: "disponible", t: "Disponible hoy", d: "En la aplicación publicada y verificada." },
  { e: "en_revision", t: "En revisión", d: "Construido y probado con IA simulada; falta fusionarlo y verificarlo con la IA real." },
  { e: "proximamente", t: "Próximamente", d: "Todavía solo diseño o lista de interés." },
];
/** «¿Qué quieres hacer con la IA?»: los dos caminos + el servicio secundario + qué está disponible y qué no. Todo sale de config/caminos.ts y config/disponibilidad.ts. */
export function PathsSection({ open }: { open: boolean }) {
  const o = CAMINOS.oficina, a = CAMINOS.afiliado, g = CAMINOS.gestionado;
  return (<section className="lp-section" id="caminos" aria-labelledby="caminos-t"><div className="lp-wrap">
    <SectionHead id="caminos-t" eyebrow="Elige tu camino" titulo={CAMINOS.titulo} lead={CAMINOS.lead} />
    <div className="fx-paths">
      <article className="fx-path main" data-testid="camino-oficina"><span className="fx-path-ic"><Icon name="building" size={26} /></span><h3>{o.nombre}</h3><p className="fx-para">{o.para}</p><p>{o.texto}</p>
        <ul className="fx-ideal">{o.puntos.map((x) => <li key={x}><Icon name="check" size={15} /><span>{x}</span></li>)}</ul>
        <CtaLink href={open ? "#oferta" : "#avisame"} cta="camino-oficina" className="btn" testId="camino-oficina-cta">{open ? "Quiero mi Oficina IA" : "Quiero mi Oficina IA · avísame al abrir"} <Icon name="arrow" size={16} /></CtaLink><a className="fx-small" href="#empleados">o conoce primero a los empleados</a></article>
      <article className="fx-path" data-testid="camino-afiliado"><span className="fx-path-ic"><Icon name="trend" size={26} /></span><h3>{a.nombre}</h3><p className="fx-para">{a.para}</p><p>{a.texto}</p>
        <ul className="fx-ideal">{a.puntos.map((x) => <li key={x}><Icon name="check" size={15} /><span>{x}</span></li>)}</ul>
        <Link href="/afiliados" className="btn ghost" data-testid="camino-afiliado-cta">Quiero ser afiliado <Icon name="arrow" size={16} /></Link><span className="fx-small"><Estatus de="afiliados" /> Solo lista de interés</span></article></div>
    <div className="fx-managed" data-testid="camino-gestionado"><div><b>{g.nombre}</b><span className="fx-small"> · Servicio secundario</span><p>{g.texto}</p></div><Link href="/servicio-gestionado" className="btn ghost" data-testid="camino-gestionado-cta">Solicitar diagnóstico</Link></div>
    <div className="fx-avail" data-testid="disponibilidad" role="group" aria-label="Qué está disponible y qué no">{GRUPOS.map((x) => <div key={x.e}><h3><Estatus estado={x.e} /> {x.t}</h3><p className="fx-small">{x.d}</p><ul>{Object.keys(FEATURES).filter((k) => FEATURES[k] === x.e).map((k) => <li key={k}>{FEATURE_NOMBRES[k] ?? k}</li>)}</ul></div>)}</div>
    <p className="lp-center fx-small" style={{ marginTop: 10 }}>«{ESTADO_LABEL.en_revision}» significa que todavía no está en la aplicación publicada.</p></div></section>);
}
