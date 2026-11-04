import { requireAgency } from "@/lib/session";
import { agencyUsage } from "@/server/usage/report";

export const metadata = { title: "Consumo de la oficina" };
const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 4 : 2)}`; const num = (n: number) => n.toLocaleString("es-MX");
export default async function ConsumoOficina() {
  const { db, agency } = await requireAgency(); const u = await agencyUsage(db, agency.agencyId); const pct = Math.min(100, Math.round(u.pct * 100));
  return (<><h1>Consumo de la oficina</h1><p className="lead">Lo que consumió toda tu oficina este mes y cómo se reparte entre tus clientes.</p>
    {u.level === "bloqueado" && <div className="notice bad" role="alert" data-testid="limit-banner">La oficina completa alcanzó su límite mensual de IA: las nuevas tareas están bloqueadas hasta que se amplíe.</div>}
    <section className="card" data-testid="agency-usage"><p><b>Límite mensual de la oficina:</b> {usd(u.office.budget)} · <b>Costo estimado usado:</b> {usd(u.spent)} ({pct}%)</p><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Uso del límite de la oficina" style={{ height: 10, background: "rgba(128,128,128,.25)", borderRadius: 6 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: u.level === "bloqueado" ? "#dc2626" : u.level === "aviso" ? "#d97706" : "var(--brand,#6d4ad6)" }} /></div></section>
    <section className="card" style={{ marginTop: 12 }}><h2>Por cliente</h2><table><thead><tr><th>Cliente</th><th>Tokens</th><th>Costo estimado</th><th>Límite del cliente</th></tr></thead><tbody>{u.clients.map((c: any) => <tr key={c.id}><td>{c.is_demo ? "Oficina de práctica" : c.name}</td><td>{num(c.tin + c.tout)}</td><td>{usd(c.cost)}</td><td>{usd(c.budget)}</td></tr>)}</tbody></table></section></>);
}
