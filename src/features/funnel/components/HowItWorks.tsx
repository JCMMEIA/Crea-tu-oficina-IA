import { Icon } from "@/components/Icon";
import { PASOS, PASOS_NOTA } from "../config/content";
export function HowItWorks() {
  return (<section className="lp-section" id="como" aria-labelledby="como-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">Del clic a tu oficina</span><h2 id="como-t">Cómo funciona</h2><p className="lp-sub">Cinco pasos, sin reuniones ni instalaciones.</p></div>
    <ol className="lp-steps" style={{ listStyle: "none", padding: 0 }}>{PASOS.map(([i, t, d], n) => <li className="lp-step" key={t}><span className="n" aria-hidden="true">{n + 1}</span><span className="icon-box"><Icon name={i} size={22} /></span><h3>{t}</h3><p>{d}</p></li>)}</ol>
    <div className="lp-note" role="note"><Icon name="shield" size={18} /><span>{PASOS_NOTA}</span></div></div></section>);
}
