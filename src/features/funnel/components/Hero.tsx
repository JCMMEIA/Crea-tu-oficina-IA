import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatPrice, PriceInfo } from "@/server/agency/plans";
import { HERO } from "../config/content";
import { BuyButton } from "./BuyButton";
import { Laptop } from "./Laptop";
import { Reveal } from "./Reveal";

export function Hero({ open, price }: { open: boolean; price: PriceInfo | null }) {
  return (<section className="lp-hero fx-hero" aria-labelledby="h1"><div className="lp-wrap lp-hero-grid">
    <div><span className="lp-badge"><Icon name="bolt" size={15} />{HERO.badge}</span>
      <h1 id="h1">{HERO.lineas.map((l, i) => <span key={l}>{i > 0 && " "}<span className={`ln${i === HERO.lineas.length - 1 ? " lp-grad" : ""}`}>{l}</span></span>)}</h1>
      <p className="lp-lead">{HERO.lead}</p>
      <div className="lp-cta"><BuyButton open={open} where="hero" /><a className="btn ghost" href="#como" data-testid="conocer-como"><Icon name="play" size={15} />Conocer cómo funciona</a></div>
      {open && price && <p className="lp-priceline" data-testid="hero-precio"><b>{formatPrice(price)}</b> · una sola suscripción, sin permanencia</p>}
      <p className="fx-demo-link"><Link href="/panel-demo/inicio" data-testid="ver-panel">Ver el panel por dentro, sin registrarte <Icon name="arrow" size={14} /></Link></p>
      <div className="lp-trust">{HERO.trust.map(([i, t]) => <span key={t}><Icon name={i} size={18} />{t}</span>)}</div></div>
    <Reveal><div className="fx-hero-visual"><Laptop src="/landing/panel.webp" alt={HERO.laptopAlt} priority />
      <div className="fx-float f1" aria-hidden="true"><Icon name="users" size={16} /><span><b>41 puestos</b><small>para contratar</small></span></div>
      <div className="fx-float f2" aria-hidden="true"><Icon name="shield" size={16} /><span><b>Tú apruebas</b><small>antes de publicar</small></span></div></div></Reveal></div></section>);
}
