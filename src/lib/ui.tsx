import { STATUS_LABEL } from "./session";
export function Flash({ sp }: { sp: { error?: string; ok?: string } }) {
  if (sp.error) return <div className="notice bad" role="alert">{sp.error}</div>;
  if (sp.ok) return <div className="notice ok" role="status" style={{ wordBreak: "break-all" }}>{sp.ok}</div>;
  return null;
}
export function StatusChip({ s }: { s: string }) { const [l, c] = STATUS_LABEL[s] ?? [s, ""]; return <span className={`chip ${c}`}>{l}</span>; }
export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }
