import { COMPARACION, COMPARACION_NOTA } from "../config/comparacion";
import { Estatus, SectionHead } from "./ui";

export function Comparison() {
  return (<section className="lp-section" id="comparacion" aria-labelledby="cmp-t"><div className="lp-wrap">
    <SectionHead id="cmp-t" eyebrow="¿Y por qué no solo un chat de IA?" titulo="Una conversación general y una oficina, comparadas con justicia" lead="Los chats de IA son muy capaces. La diferencia está en cómo se organiza el trabajo del día a día." />
    <div className="fx-table-wrap"><table className="fx-cmp" data-testid="comparacion"><caption className="sr-only">Comparación entre una conversación general de IA y Crea tu Oficina IA</caption><thead><tr><th scope="col">Tema</th><th scope="col">Conversación general de IA</th><th scope="col" className="us">Crea tu Oficina IA</th></tr></thead>
      <tbody>{COMPARACION.map((f) => <tr key={f.tema}><th scope="row">{f.tema}</th><td>{f.general}</td><td className="us">{f.nosotros} <Estatus de={f.feature} /></td></tr>)}</tbody></table></div>
    <p className="fx-fair lp-center">{COMPARACION_NOTA}</p></div></section>);
}
