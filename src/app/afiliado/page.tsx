import { requireUser, when } from "@/lib/session";
import { affiliateByEmail, affiliateDashboard, AFFILIATE_TERMS } from "@/server/affiliates";

export const dynamic = "force-dynamic"; export const metadata = { title: "Panel de afiliado", robots: { index: false } };
const mx = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`;
export default async function PanelAfiliado() {
  const { db, user } = await requireUser(); const a = await affiliateByEmail(db, user.email);
  if (!a || a.status !== "aprobada") return (<div className="land" style={{ maxWidth: 760 }}><h1>Panel de afiliado</h1><div className="card"><p>Esta cuenta no tiene un programa de afiliados activo. {a?.status === "solicitada" ? "Tu solicitud está en revisión." : "Si recibiste una invitación, entra con el correo de la invitación."}</p></div></div>);
  const d = await affiliateDashboard(db, a.id); const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return (<div className="land" style={{ maxWidth: 900 }}><h1>Panel de afiliado</h1><p className="muted">Aquí solo ves tu enlace y cifras agregadas. Por privacidad nunca verás datos, correos ni conversaciones de los clientes que referiste.</p>
    <div className="card" data-testid="aff-enlace"><h2>Tu enlace</h2><p><code>{site}/r/{d.affiliate.code}</code></p><p className="muted">Visitas por tu enlace: {d.clicks}. Se guarda una cookie de {AFFILIATE_TERMS.cookieDays} días; la comisión aplica a la primera compra de quien no era cliente.</p></div>
    <div className="grid" style={{ marginTop: 12 }}><div className="card"><h3>Pendiente</h3><p style={{ fontSize: "1.4rem" }}>{mx(d.pendiente)}</p><p className="muted">En espera de {AFFILIATE_TERMS.holdDays} días por posibles reembolsos.</p></div><div className="card"><h3>Aprobada</h3><p style={{ fontSize: "1.4rem" }}>{mx(d.aprobada)}</p><p className="muted">Se paga en la liquidación mensual (mínimo {mx(AFFILIATE_TERMS.minPayoutCents)}).</p></div><div className="card"><h3>Pagada</h3><p style={{ fontSize: "1.4rem" }}>{mx(d.pagada)}</p></div></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Clientes referidos ({d.referidos.length})</h2>{d.referidos.length ? <table><thead><tr><th>Cliente</th><th>Plan</th><th>Desde</th><th>Cobros comisionados</th></tr></thead><tbody>{d.referidos.map((r) => <tr key={r.etiqueta}><td>{r.etiqueta}</td><td>{r.plan}</td><td>{when(r.desde)}</td><td>{r.cobros} de {AFFILIATE_TERMS.maxMonths}</td></tr>)}</tbody></table> : <p className="muted">Aún no hay clientes referidos.</p>}</div>
    <div className="card" style={{ marginTop: 12 }}><h2>Liquidaciones</h2>{d.payouts.length ? <table><tbody>{d.payouts.map((p: any) => <tr key={String(p.period)}><td>{String(p.period).slice(0, 7)}</td><td>{mx(Number(p.total_cents))}</td><td>{p.status}</td></tr>)}</tbody></table> : <p className="muted">Todavía no hay liquidaciones.</p>}</div></div>);
}
