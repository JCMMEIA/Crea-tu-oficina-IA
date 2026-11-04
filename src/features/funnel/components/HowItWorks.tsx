import { PASOS, PASOS_NOTA } from "../config/content";
import { Icon } from "@/components/Icon";
import { Reveal } from "./Reveal";
import { SectionHead } from "./ui";

export function HowItWorks() {
  return (<section className="lp-section fx-alt" id="como" aria-labelledby="como-t"><div className="lp-wrap">
    <SectionHead id="como-t" eyebrow="Cómo funciona" titulo="De elegir un plan a tu primer resultado" lead="Siete pasos, todos desde el navegador. No necesitas conocimientos técnicos." />
    <ol className="fx-timeline">{PASOS.map((p, n) => <li key={p.titulo}><Reveal delay={n * 30}><div className="fx-tstep"><span className="fx-tn" aria-hidden="true">{n + 1}</span><div><h3>{p.titulo}</h3><p>{p.texto}</p></div></div></Reveal></li>)}</ol>
    <div className="lp-note" role="note"><Icon name="shield" size={18} /><span>{PASOS_NOTA}</span></div></div></section>);
}
