import Link from "next/link";
import { TASK_STATUS, friendlyError } from "./lang";

/** Mensaje de confirmación o error. Los errores se muestran SIEMPRE en lenguaje sencillo. */
export function Flash({ sp }: { sp: { error?: string; ok?: string } }) {
  if (sp.error) return <div className="notice bad" role="alert">😕 {friendlyError(sp.error)}</div>;
  if (sp.ok) return <div className="notice ok" role="status" style={{ wordBreak: "break-word" }}>✅ {friendlyError(sp.ok)}</div>;
  return null;
}
/** Estado de una tarea con icono + texto (nunca solo color). */
export function StatusChip({ s }: { s: string }) { const t = TASK_STATUS[s] ?? { icon: "•", text: s, tone: "" as const }; return <span className={`state ${t.tone}`}><span aria-hidden="true">{t.icon}</span> {t.text}</span>; }
/** Estado vacío útil: invita a hacer lo siguiente con un botón grande. */
export function EmptyState({ icon, title, text, href, cta, secondary }: { icon: string; title: string; text: string; href?: string; cta?: string; secondary?: { href: string; label: string } }) {
  return (<div className="empty-state"><div className="ic" aria-hidden="true">{icon}</div><h3>{title}</h3><p>{text}</p>
    <div className="row" style={{ justifyContent: "center" }}>{href && cta && <Link className="btn big" href={href}>{cta}</Link>}{secondary && <Link className="btn ghost" href={secondary.href}>{secondary.label}</Link>}</div></div>);
}
export const Empty = ({ children }: { children: React.ReactNode }) => <div className="empty">{children}</div>;
export function Tip({ children, icon = "💡" }: { children: React.ReactNode; icon?: string }) { return <div className="tip" role="note"><span aria-hidden="true">{icon}</span><span>{children}</span></div>; }
/** Ayuda junto a un campo. */
export const Help = ({ children }: { children: React.ReactNode }) => <span className="help">{children}</span>;
export function Steps({ labels, current }: { labels: readonly string[]; current: number }) {
  return (<div className="steps-bar" role="list" aria-label={`Paso ${current} de ${labels.length}`}>{labels.map((l, i) => <div key={l} role="listitem" className={`s ${i + 1 === current ? "on" : i + 1 < current ? "done" : ""}`} aria-current={i + 1 === current ? "step" : undefined}>{i + 1 < current ? "✓ " : `${i + 1}. `}{l}</div>)}</div>);
}
export function BigAction({ href, icon, title, text, testId }: { href: string; icon: React.ReactNode; title: string; text: string; testId?: string }) {
  return <Link className="action" href={href} data-testid={testId}><span className="ic" aria-hidden="true">{icon}</span><b>{title}</b><span className="t">{text}</span></Link>;
}
