import Link from "next/link";
import { SERVICE_CARDS, employeesForServices, allPlainEmployees, getCard } from "@/server/guide/services";
import { getToolkit } from "@/server/connectors/catalog";
import { EmptyState } from "@/lib/ui";

/** Galería para «Agregar empleado»: empleados recomendados por tipo de trabajo, explicados en 4 frases. Un botón = una acción real. */
export function HireGallery({ basePath, query, hired, action, hidden, tab }: { basePath: string; query: string; hired: Set<string>; action: (f: FormData) => Promise<void>; hidden: Record<string, string>; tab: string }) {
  const known = new Set(SERVICE_CARDS.flatMap((c) => c.employees));
  const list = tab === "mas" ? allPlainEmployees().filter((p) => !known.has(p.key)) : employeesForServices([tab]);
  const link = (t: string) => `${basePath}?${query}${query ? "&" : ""}servicio=${t}`;
  return (<div>
    <div className="row" role="tablist" aria-label="Tipo de trabajo" style={{ marginBottom: 12 }}>
      {SERVICE_CARDS.map((c) => <Link key={c.id} role="tab" aria-selected={tab === c.id} className={`chip ${tab === c.id ? "ok" : ""}`} style={{ fontSize: "1rem", padding: "8px 14px" }} href={link(c.id)}>{c.icon} {c.title}</Link>)}
      <Link role="tab" aria-selected={tab === "mas"} className={`chip ${tab === "mas" ? "ok" : ""}`} style={{ fontSize: "1rem", padding: "8px 14px" }} href={link("mas")}>➕ Más empleados</Link></div>
    {tab !== "mas" && <p className="lead">{getCard(tab)?.plain}</p>}
    {list.length ? <div className="grid">{list.map((p) => (<div className="card" key={p.key} data-testid={`card-${p.key}`}><div className="ic" style={{ fontSize: "2rem" }} aria-hidden="true">🧑‍💼</div><h3>{p.name}</h3>
      <p><b>Qué hace:</b> {p.que}</p><p><b>Para qué sirve:</b> {p.paraQue}</p><p><b>Qué necesita:</b> {p.necesita}</p><p><b>Qué entrega:</b> {p.entrega}</p>
      {p.needsApps.length > 0 && <p className="muted">Podrás conectarle: {p.needsApps.map((a) => getToolkit(a)?.label ?? a).join(", ")}.</p>}
      <form action={action}>{Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}<input type="hidden" name="empleado" value={p.key} />
        <button className="big" style={{ width: "100%" }} data-testid={`add-${p.key}`}>{hired.has(p.key) ? "➕ Agregar otro igual" : "➕ Agregar empleado"}</button></form>
      {hired.has(p.key) && <p><span className="state ok">✅ Ya tienes uno</span></p>}</div>))}</div>
      : <EmptyState icon="🎉" title="Ya los viste todos" text="No hay más empleados en esta lista." />}
  </div>);
}
