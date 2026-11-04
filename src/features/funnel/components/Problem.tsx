import { Icon } from "@/components/Icon";
import { PROBLEMAS, PROBLEMA_CIERRE } from "../config/content";
import { Reveal } from "./Reveal";
import { SectionHead } from "./ui";

export function Problem() {
  return (<section className="lp-section fx-problem" id="problema" aria-labelledby="problema-t"><div className="lp-wrap">
    <div className="fx-split"><div className="fx-sticky"><SectionHead center={false} id="problema-t" eyebrow="El problema" titulo="Eres el director, el vendedor, el community manager y el que contesta mensajes" lead="La mayoría de los negocios no fallan por falta de ganas, sino por falta de manos. Cada día se decide a qué le dedicas tu tiempo, y casi siempre gana lo urgente." />
      <p className="fx-pull">{PROBLEMA_CIERRE}</p></div>
      <ul className="fx-pains">{PROBLEMAS.map((p, i) => <li key={p.titulo}><Reveal delay={i * 40}><div className="fx-pain"><span className="fx-pain-ic"><Icon name={p.icon} size={20} /></span><div><h3>{p.titulo}</h3><p>{p.texto}</p></div></div></Reveal></li>)}</ul></div></div></section>);
}
