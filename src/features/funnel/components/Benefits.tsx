import { Icon } from "@/components/Icon";
import { BENEFICIOS } from "../config/content";
export function Benefits() {
  return (<section className="lp-section" style={{ paddingTop: 0 }} aria-label="Beneficios"><div className="lp-wrap"><div className="lp-grid c4">
    {BENEFICIOS.map(([i, t, d]) => <article className="lp-card lp-benefit" key={t}><span className="icon-box"><Icon name={i} size={24} /></span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></div></section>);
}
