import Link from "next/link";
import { requireAgency, when } from "@/lib/session";
import { Flash, EmptyState } from "@/lib/ui";
import { listProposals, listServices, listClients } from "@/server/agency";
import { proposalCreateAction } from "../../../agency_actions";
export default async function Propuestas({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const services = await listServices(db, agency); const clients = await listClients(db, agency); const props = await listProposals(db, agency);
  return (<><h1>Preparar propuesta</h1><p className="lead">Arma una oferta con tus servicios y precios. Te queda lista para copiar o imprimir: nosotros no la enviamos a nadie.</p><Flash sp={sp} />
    <div className="card"><h2>📄 Nueva propuesta</h2>{services.length ? <form action={proposalCreateAction}><div className="grid"><div><label>¿Cómo se llama la propuesta?</label><input name="title" required defaultValue="Propuesta de servicios de IA" /></div><div><label>¿Para quién es?</label><input name="clientName" required /></div>
      <div><label>¿Es un cliente que ya tienes? (opcional)</label><select name="companyId"><option value="">—</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
      <label>¿Qué servicios incluye?</label>{services.map((s: any) => <div key={s.id} className="row"><label style={{ fontWeight: 400, margin: 0, flex: 1 }}><input type="checkbox" name="serviceId" value={s.id} style={{ width: "auto" }} /> {s.name} — US$ {s.price}/{s.price_unit}</label><input type="number" name={`qty_${s.id}`} defaultValue={1} min={1} style={{ width: 70 }} aria-label="Cantidad" /></div>)}
      <label>Algo más que quieras decir (opcional)</label><textarea name="notes" rows={3} /><p><button className="big" data-testid="proposal-create">Crear propuesta</button></p></form> : <EmptyState icon="🛍️" title="Primero elige qué ofreces" text="Una propuesta se arma con tus servicios. Prepara tu lista y vuelve aquí." href="/agencia/servicios" cta="Elegir qué ofrezco" />}</div>
    <div className="card" style={{ marginTop: 12 }}><h2>📚 Mis propuestas</h2>{props.length ? <table><tbody>{props.map((p: any) => <tr key={p.id}><td><Link href={`/agencia/propuestas/${p.id}`}>{p.title}</Link><div className="muted">{p.client_name} · {when(p.created_at)}</div></td><td>US$ {p.total}</td><td><span className="chip">{p.status}</span></td></tr>)}</tbody></table> : <EmptyState icon="📄" title="Aún no preparas ninguna propuesta" text="Cuando crees una, la verás aquí." />}</div></>);
}
