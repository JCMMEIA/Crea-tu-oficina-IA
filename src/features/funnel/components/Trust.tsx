import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TESTIMONIALS } from "@/content/testimonials";
import { CONFIANZA } from "../config/content";
import { SectionHead } from "./ui";

/** Confianza SIN inventar: solo hechos verificables de la plataforma; testimonios únicamente reales (src/content/testimonials.ts). */
export function Trust({ preview = false }: { preview?: boolean }) {
  const hay = TESTIMONIALS.length > 0;
  return (<section className="lp-section fx-alt" id="confianza" aria-labelledby="conf-t"><div className="lp-wrap">
    <SectionHead id="conf-t" eyebrow="Confianza" titulo="Lo que puedes verificar hoy" lead="No inventamos clientes, cifras ni certificaciones. Esto es lo que sí puedes comprobar." />
    <div className="fx-trust"><div className="fx-trust-col"><h3>Seguridad</h3><ul className="fx-checks compact">{CONFIANZA.seguridad.map(([t, d]) => <li key={t}><span className="fx-ck"><Icon name="lock" size={14} /></span><div><b>{t}</b><span>{d}</span></div></li>)}</ul><p className="fx-small">{CONFIANZA.sinCertificaciones}</p></div>
      <div className="fx-trust-col"><h3>Demostraciones que puedes recorrer</h3><ul className="fx-demos">{CONFIANZA.demos.map(([t, d, href]) => <li key={t}><Link href={href}><b>{t}</b><span>{d}</span><Icon name="arrow" size={16} /></Link></li>)}</ul>
        <h3 style={{ marginTop: 22 }}>Casos de uso</h3><ul className="fx-cases">{CONFIANZA.casos.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul><p className="fx-small">{CONFIANZA.casosNota}</p></div>
      <div className="fx-trust-col"><h3>Testimonios</h3>{hay ? <ul className="fx-quotes">{TESTIMONIALS.map((t) => <li key={t.name}><blockquote>“{t.quote}”</blockquote><footer><b>{t.name}</b> · {t.role}</footer></li>)}</ul> : <p className="fx-empty" data-testid="sin-testimonios">{CONFIANZA.testimoniosVacio}</p>}
        {preview && !hay && <p><span className="lp-ribbon" data-testid="demo-ribbon">Vista previa del diseño · no son testimonios reales</span></p>}</div></div></div></section>);
}
