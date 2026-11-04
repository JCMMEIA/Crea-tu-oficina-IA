import { faqItems } from "../config/content";
import type { PlanKey } from "@/server/agency/plans";
export function Faq({ plan }: { plan: PlanKey }) {
  return (<div className="lp-faq" aria-label="Preguntas frecuentes"><h3 style={{ margin: "0 0 16px", fontSize: "1.2rem" }}>Preguntas frecuentes</h3>{faqItems(plan).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>);
}
