import { LEVEL_LABEL, type Readiness } from "../readiness";

const cls = (l: string) => (l === "si" ? "ok" : l === "parcial" ? "warn" : l === "na" ? "" : "bad");
/** Tres estados separados y honestos. «Operativo» solo es Sí cuando está configurado, conectado y la IA fue verificada. */
export function ReadinessStepper({ r }: { r: Readiness }) {
  const rows: [string, { level: string; detail: string }][] = [["Configurado", r.configurado], ["Conectado", r.conectado], ["Operativo", r.operativo]];
  return (<ol className="emp-ready" data-testid="readiness" aria-label="Estado del empleado">{rows.map(([t, v]) => <li key={t}><span className={`state ${cls(v.level)}`}>{t}: {LEVEL_LABEL[v.level as keyof typeof LEVEL_LABEL]}</span><small>{v.detail}</small></li>)}</ol>);
}
