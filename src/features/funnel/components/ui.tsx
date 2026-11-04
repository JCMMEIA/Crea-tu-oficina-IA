import { ESTADO_LABEL, estadoDe, type Estado } from "../config/disponibilidad";

/** Etiqueta honesta de disponibilidad. Acepta una clave de FEATURES o un estado directo. */
export function Estatus({ de, estado }: { de?: string; estado?: Estado }) {
  const e = estado ?? estadoDe(de ?? ""); return <span className={`fx-status s-${e}`} data-estado={e}>{ESTADO_LABEL[e]}</span>;
}
export function SectionHead({ id, eyebrow, titulo, lead, center = true }: { id: string; eyebrow: string; titulo: string; lead?: string; center?: boolean }) {
  return (<div className={center ? "lp-center" : undefined} style={{ maxWidth: center ? 780 : undefined, margin: center ? "0 auto" : undefined }}><span className="lp-eyebrow">{eyebrow}</span><h2 id={id} className="fx-h2">{titulo}</h2>{lead && <p className="lp-sub fx-lead">{lead}</p>}</div>);
}
