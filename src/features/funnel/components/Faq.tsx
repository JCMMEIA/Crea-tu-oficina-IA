import { faqItems } from "../config/content";
import type { PlanKey } from "@/server/agency/plans";
import { SectionHead } from "./ui";

export function Faq({ plan }: { plan: PlanKey }) {
  const items = faqItems(plan);
  return (<section className="lp-section" id="faq" aria-labelledby="faq-t"><div className="lp-wrap"><SectionHead id="faq-t" eyebrow="Preguntas frecuentes" titulo="Lo que más nos preguntan" />
    <div className="lp-faq fx-faq" aria-label="Preguntas frecuentes">{items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>);
}
