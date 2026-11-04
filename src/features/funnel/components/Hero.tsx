import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatPrice, PriceInfo } from "@/server/agency/plans";
import { HERO } from "../config/content";
import { BuyButton } from "./BuyButton";
import { Laptop } from "./Laptop";
export function Hero({ open, price }: { open: boolean; price: PriceInfo | null }) {
  return (<section className="lp-hero" aria-labelledby="h1"><div className="lp-wrap lp-hero-grid">
    <div><span className="lp-badge"><Icon name="bolt" size={15} />{HERO.badge}</span>
      <h1 id="h1">{HERO.lineas.map((l, i) => <span key={l}>{i > 0 && " "}<span className={`ln${i === HERO.lineas.length - 1 ? " lp-grad" : ""}`}>{l}</span></span>)}</h1>
      <p className="lp-lead">{HERO.lead}</p>
      <div className="lp-cta"><BuyButton open={open} where="hero" /><Link className="btn ghost" href="/panel-demo/inicio" data-testid="ver-panel"><Icon name="play" size={15} />Ver panel por dentro</Link></div>
      {open && price && <p className="lp-priceline" data-testid="hero-precio"><b>{formatPrice(price)}</b> · una sola suscripción, sin permanencia</p>}
      <div className="lp-trust">{HERO.trust.map(([i, t]) => <span key={t}><Icon name={i} size={18} />{t}</span>)}</div></div>
    <div><Laptop src="/landing/panel.webp" alt={HERO.laptopAlt} priority /></div></div></section>);
}
