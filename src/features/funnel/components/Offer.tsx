import { Icon } from "@/components/Icon";
import { LeadForm } from "@/lib/leadform";
import { formatPrice, planOf, PlanKey, PriceInfo } from "@/server/agency/plans";
import { ofertaBullets, promoText } from "../config/content";
import { BuyButton } from "./BuyButton";
import { SectionHead } from "./ui";

/** La oferta REAL que se puede comprar hoy (plan OFFER_PLAN, precio PLAN_PRICE_MXN_*) y, si la tienda está cerrada, la lista de espera funcional. Los tres niveles de «Planes» no están conectados al cobro. */
export function Offer({ open, plan, price }: { open: boolean; plan: PlanKey; price: PriceInfo | null }) {
  const p = planOf(plan); const promo = promoText();
  return (<section className="lp-section" id="oferta" aria-labelledby="oferta-t"><div className="lp-wrap">
    <SectionHead id="oferta-t" eyebrow={open ? "Oferta disponible hoy" : "Lista de espera"} titulo={open ? "Tu oficina IA, lista para empezar" : "Las compras aún no están abiertas"} lead={open ? "Una suscripción mensual. Se crea tu oficina automáticamente y recibes tu acceso por correo." : "Estamos terminando de verificar el sistema de pagos y la IA antes de abrir. No fingimos que se puede comprar: déjanos tu correo y te avisamos."} />
    {promo && <p className="lp-center"><span className="lp-ribbon" data-testid="promo">{promo}</span></p>}
    <div className="fx-offer">
      <div className="lp-plan" data-testid="oferta"><h3>Plan {p.label}</h3>
        <p className="lp-price">{price ? formatPrice(price).replace("/mes", "") : "Por confirmar"}{price && <small> / mes</small>}</p>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".92rem" }}>{price ? "Es tu primer pago y tu mensualidad: se cobra al confirmar y cada mes." : "El precio se publica al abrir las compras."}</p>
        <ul className="lp-list">{ofertaBullets(p).map((b) => <li key={b.t}><Icon name="check" size={18} /><span>{b.t}</span></li>)}</ul>
        <div className="lp-cta" style={{ margin: 0 }}><BuyButton open={open} where="oferta" /></div></div>
      {!open && <div id="avisame" className="fx-wait"><h3>Avísame cuando abran las compras</h3><p className="muted">Dejas tu correo y te avisamos. No hay llamadas ni demostraciones.</p><LeadForm /></div>}</div></div></section>);
}
