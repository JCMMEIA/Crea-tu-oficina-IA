import { Icon } from "@/components/Icon";
import { getDb } from "@/server/db";
import { identityFor } from "@/features/employees/catalog";
import { planPriceInfo } from "@/server/agency/plans";
import { offerPlan, purchasesOpen } from "@/server/commerce/gate";
import { Attribution } from "./tracking/attribution";
import { AVISOS_COMPRA } from "./config/content";
import { TAREAS } from "./config/tareas";
import { LandingHeader } from "./components/Header";
import { Hero } from "./components/Hero";
import { PathsSection } from "./components/PathsSection";
import { Problem } from "./components/Problem";
import { ProductDemo } from "./components/ProductDemo";
import { EmployeesSection } from "./components/EmployeesSection";
import { BrainSection } from "./components/BrainSection";
import { TasksSection } from "./components/TasksSection";
import { WorkflowsSection } from "./components/WorkflowsSection";
import { ResultsSection } from "./components/ResultsSection";
import { HowItWorks } from "./components/HowItWorks";
import { Comparison } from "./components/Comparison";
import { Plans } from "./components/Plans";
import { Offer } from "./components/Offer";
import { Trust } from "./components/Trust";
import { Faq } from "./components/Faq";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";
import type { Quien } from "./components/TasksExplorer";
import "./funnel.css";

/** Landing completa. Ruta: «/» (src/app/page.tsx solo decide a quién redirigir y la monta). Orden de secciones = orden del funnel. Medición y textos: ver docs/funnel/ y docs/landing/. */
export async function FunnelLanding({ compra, demo }: { compra?: string; demo?: string }) {
  const db = await getDb(); const open = (await purchasesOpen(db)).open; const plan = offerPlan(); const price = planPriceInfo(plan);
  const quien: Record<string, Quien> = {}; for (const t of TAREAS) { const i = identityFor(t.empleadoKey); quien[t.empleadoKey] = { nombre: i?.nombre ?? t.empleadoKey, puesto: i?.puesto ?? "" }; }
  return (<div className="lp fx"><Attribution track="visita" /><LandingHeader canBuy={open} />
    <main id="contenido" className="lp-main">
      {compra && AVISOS_COMPRA[compra] && <div className="lp-wrap"><div className="tip lp-alert" role="alert" data-testid="buy-notice"><Icon name="help" size={18} /><span>{AVISOS_COMPRA[compra]}</span></div></div>}
      <Hero open={open} price={price} /><PathsSection open={open} /><Problem /><ProductDemo /><EmployeesSection /><BrainSection /><TasksSection /><WorkflowsSection /><ResultsSection quien={quien} /><HowItWorks /><Comparison />
      <Plans open={open} /><Offer open={open} plan={plan} price={price} /><Trust preview={demo === "testimonios"} /><Faq plan={plan} /><FinalCta open={open} />
    </main><Footer /></div>);
}
