import Link from "next/link";
import { SERVICE_CARDS, employeesForServices, allPlainEmployees, getCard } from "@/server/guide/services";
import { profileFor } from "@/features/employees/catalog";
import { EmployeeCard } from "@/features/employees/components/EmployeeCard";
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
    {list.length ? <div className="emp-grid">{list.map((pl) => { const p = profileFor(pl.key); if (!p) return null; const href = `${basePath}/${p.key}${query ? `?${query}` : ""}`;
      return (<EmployeeCard key={p.key} p={p} href={href} hired={hired.has(p.key)}>
        <form action={action}>{Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}<input type="hidden" name="empleado" value={p.key} />
          <button className="big" style={{ width: "100%" }} data-testid={`add-${p.key}`}>{hired.has(p.key) ? "Agregar otro igual" : "Agregar empleado"}</button></form></EmployeeCard>); })}</div>
      : <EmptyState icon="🎉" title="Ya los viste todos" text="No hay más empleados en esta lista." />}
  </div>);
}
