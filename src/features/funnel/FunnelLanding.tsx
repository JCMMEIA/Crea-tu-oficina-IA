import { Icon } from "@/components/Icon";
import { getDb } from "@/server/db";
import { planPriceInfo } from "@/server/agency/plans";
import { offerPlan, purchasesOpen } from "@/server/commerce/gate";
import { Attribution } from "./tracking/attribution";
import { AVISOS_COMPRA } from "./config/content";
import { LandingHeader } from "./components/Header";
import { Hero } from "./components/Hero";
import { Benefits } from "./components/Benefits";
import { HowItWorks } from "./components/HowItWorks";
import { ProductDemo } from "./components/ProductDemo";
import { Testimonials } from "./components/Testimonials";
import { OfficesCta } from "./components/OfficesCta";
import { Offer } from "./components/Offer";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";

/** Landing completa (9 secciones). Ruta: «/» (src/app/page.tsx solo decide a quién redirigir y la monta). */
export async function FunnelLanding({ compra, demo }: { compra?: string; demo?: string }) {
  const db = await getDb(); const open = (await purchasesOpen(db)).open; const plan = offerPlan(); const price = planPriceInfo(plan);
  return (<div className="lp"><Attribution track="visita" /><LandingHeader canBuy={open} />
    <main id="contenido" className="lp-main">
      {compra && AVISOS_COMPRA[compra] && <div className="lp-wrap"><div className="tip lp-alert" role="alert" data-testid="buy-notice"><Icon name="help" size={18} /><span>{AVISOS_COMPRA[compra]}</span></div></div>}
      <Hero open={open} price={price} /><Benefits /><HowItWorks /><ProductDemo /><Testimonials preview={demo === "testimonios"} /><OfficesCta /><Offer open={open} plan={plan} price={price} /><FinalCta open={open} />
    </main><Footer /></div>);
}
