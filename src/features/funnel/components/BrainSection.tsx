import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CEREBRO } from "../config/content";
import { Estatus, SectionHead } from "./ui";
import { Reveal } from "./Reveal";

/** Explica el Cerebro Empresarial con capturas REALES del módulo /cerebro (datos de ejemplo). El módulo está en revisión (PR #3): la etiqueta sale de disponibilidad.ts. */
export function BrainSection() {
  return (<section className="lp-section fx-alt" id="cerebro" aria-labelledby="cerebro-t"><div className="lp-wrap">
    <SectionHead id="cerebro-t" eyebrow={CEREBRO.eyebrow} titulo={CEREBRO.titulo} lead={CEREBRO.lead} />
    <div className="fx-brain"><div><ul className="fx-checks">{CEREBRO.items.map(([t, d]) => <li key={t}><span className="fx-ck"><Icon name="check" size={16} /></span><div><b>{t}</b><span>{d}</span></div></li>)}</ul>
      <p className="fx-note"><Icon name="shield" size={18} /><span>{CEREBRO.control}</span></p><p className="fx-small">{CEREBRO.cuidado}</p>
      <div className="fx-status-row"><span><Estatus de="fichaNegocio" /> Ficha del negocio y documentos</span><span><Estatus de="cerebro" /> Uso de ese contexto por los empleados en cada tarea</span></div></div>
      <Reveal><div className="fx-shots"><figure className="fx-shot"><img src="/landing/cerebro-negocio.webp" width={960} height={600} loading="lazy" alt="Pantalla Cerebro de mi empresa con la ficha del negocio completa, datos de ejemplo" /><figcaption>Módulo «Cerebro de mi empresa» · datos de ejemplo</figcaption></figure>
        <figure className="fx-shot b"><img src="/landing/cerebro-marca.webp" width={960} height={600} loading="lazy" alt="Pantalla con propuesta de valor, tono de marca y reglas de lo que nunca debe prometerse, datos de ejemplo" /><figcaption>Identidad, tono y límites de tu marca</figcaption></figure></div></Reveal></div>
    <p className="lp-center fx-small" style={{ marginTop: 18 }}>Capturas del módulo en revisión, con un negocio de ejemplo. <Link href="/panel-demo/inicio">Recorre el panel de demostración</Link>.</p></div></section>);
}
