import { Icon } from "@/components/Icon";
import { LeadForm } from "@/lib/leadform";
import { formatPrice, planOf, PlanKey, PriceInfo } from "@/server/agency/plans";
import { ofertaBullets, promoText } from "../config/content";
import { BuyButton } from "./BuyButton";
import { Faq } from "./Faq";
/** Oferta + precio (configurable con PLAN_PRICE_MXN_*) + límites del plan + preguntas frecuentes. Tienda cerrada → lista de espera. */
export function Offer({ open, plan, price }: { open: boolean; plan: PlanKey; price: PriceInfo | null }) {
  const p = planOf(plan); const promo = promoText();
  return (<section className="lp-section" id="oferta" aria-labelledby="oferta-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">Oferta</span><h2 id="oferta-t">Tu oficina IA</h2><p className="lp-sub">Una suscripción mensual. Sin letras chiquitas ni contratos largos.</p>{promo && <p><span className="lp-ribbon" data-testid="promo">{promo}</span></p>}</div>
    <div className="lp-offer"><div className="lp-plan" data-testid="oferta"><h3>Plan {p.label}</h3>
      <p className="lp-price">{price ? formatPrice(price).replace("/mes", "") : "Próximamente"}{price && <small> / mes</small>}</p>
      <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: ".92rem" }}>{price ? "Es tu primer pago y tu mensualidad: se cobra al confirmar y cada mes." : "El precio se publica al abrir las compras."}</p>
      <ul className="lp-list">{ofertaBullets(p).map((b) => <li key={b.t}><Icon name="check" size={18} /><span>{b.t}</span></li>)}</ul>
      <div className="lp-cta" style={{ margin: 0 }}><BuyButton open={open} where="oferta" /></div></div>
      <Faq plan={plan} /></div>
    {!open && <div id="avisame" style={{ maxWidth: 640, margin: "56px auto 0" }}><div className="lp-center"><h2 style={{ fontSize: "1.6rem" }}>Avísame cuando abran las compras</h2><p className="lp-sub">Dejas tu correo y te avisamos. No hay llamadas ni demostraciones.</p></div><LeadForm /></div>}</div></section>);
}
