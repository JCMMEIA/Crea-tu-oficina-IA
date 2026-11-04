import { Icon } from "@/components/Icon";
import { CtaLink } from "../tracking/attribution";
import { FILAS, PLANES_APROBADOS, PLANES_PREGUNTAS, TIERS } from "../config/planes";
import { Estatus, SectionHead } from "./ui";

const fmt = (n: number | null) => (n === null ? "Por definir" : `$${n.toLocaleString("es-MX")} MXN/mes`);
/** Starter · Pro · Business. Configuración central en config/planes.ts. Sin aprobación comercial NO se publican precios ni cantidades. */
export function Plans({ open }: { open: boolean }) {
  const ok = PLANES_APROBADOS;
  return (<section className="lp-section fx-alt" id="planes" aria-labelledby="planes-t"><div className="lp-wrap">
    <SectionHead id="planes-t" eyebrow="Planes" titulo="Elige el tamaño de tu oficina" lead="Tres niveles pensados para crecer contigo. Todos incluyen las mismas reglas de seguridad: tus datos separados y tu aprobación antes de actuar." />
    {!ok && <div className="fx-pricenote" role="note" data-testid="planes-aviso"><Icon name="clock" size={16} /><span><b>Precios y límites por confirmar.</b> Los publicaremos cuando abramos las ventas. {open ? "Mientras tanto, la oferta disponible hoy está más abajo." : "Déjanos tu correo y te avisamos."}</span></div>}
    <div className="fx-tiers">{TIERS.map((t) => <article key={t.key} className={`fx-tier${t.destacado ? " hot" : ""}`} data-testid={`plan-${t.key}`}>{t.destacado && <span className="fx-pop">Recomendado para empezar a trabajar en serio</span>}<h3>{t.nombre}</h3><p className="muted">{t.para}</p>
      <ul className="fx-ideal">{t.ideal.map((x) => <li key={x}><Icon name="check" size={15} /><span>{x}</span></li>)}</ul><p className="fx-tprice">{ok ? fmt(t.precioMxn) : "Precio mensual: por confirmar"}</p>
      <CtaLink href={open ? "#oferta" : "#avisame"} cta={`plan-${t.key}`} className={`btn${t.destacado ? "" : " ghost"}`} testId={`plan-cta-${t.key}`}>{open ? "Ver la oferta disponible" : "Quiero este plan"}</CtaLink></article>)}</div>
    <div className="fx-table-wrap"><table className="fx-cmp plans" data-testid="plan-tabla"><caption className="sr-only">Comparación detallada de Starter, Pro y Business</caption><thead><tr><th scope="col">Qué incluye</th>{TIERS.map((t) => <th scope="col" key={t.key} className={t.destacado ? "us" : ""}>{t.nombre}</th>)}</tr></thead>
      <tbody>{FILAS.map((f) => <tr key={f.fila}><th scope="row">{f.fila}{f.ayuda && <small>{f.ayuda}</small>}{f.feature && <Estatus de={f.feature} />}</th>{TIERS.map((t) => { const v = f.valores[t.key]; return <td key={t.key} className={t.destacado ? "us" : ""}>{ok || f.feature ? (v ?? "Por definir") : "Por definir"}</td>; })}</tr>)}</tbody></table></div>
    <div className="fx-qa">{PLANES_PREGUNTAS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>);
}
