import { requireOperator, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { conversionFunnel, recentOrders } from "@/server/commerce/funnel";
import { purchasesOpen } from "@/server/commerce/gate";
import { adSpendAction, grantRightAction, sendEmailsAction, verifyAiAction } from "../../admin_actions";

export default async function Conversion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const { db, op } = await requireOperator(); const days = [7, 30, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const f = await conversionFunnel(db, op, days); const g = await purchasesOpen(db); const orders = await recentOrders(db, op);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  const tile = (t: string, v: string | number, note = "", id = "") => <div className="card" data-testid={id}><div className="muted">{t}</div><div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{v}</div>{note && <div className="muted" style={{ fontSize: ".8rem" }}>{note}</div>}</div>;
  const mxn = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
  return (<><h1>Conversión</h1><Flash sp={sp} />
    <div className={g.open ? "tip" : "tip"} role="status" data-testid="gate">{g.open ? "✅ La tienda está ABIERTA (cobros, precio, correo e IA verificados)." : <>🔒 La tienda está CERRADA: <ul>{g.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>}</div>
    <div className="row"><form action={verifyAiAction} className="inline"><button data-testid="verify-ai">Verificar IA ahora</button></form><span className="muted">{f.ia ? `Última verificación: ${f.ia.ok ? "✅" : "❌"} ${f.ia.detail} (${when(f.ia.checked_at)})` : "La IA nunca se ha verificado."} Hace una llamada mínima y real al modelo (centavos).</span></div>
    <p className="row">Periodo: {[7, 30, 90].map((d) => <a key={d} href={`/admin/conversion?dias=${d}`} className={d === days ? "btn" : "btn ghost"}>{d} días</a>)}</p>
    <h2>Embudo (últimos {days} días)</h2>
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
      {tile("Visitantes", f.visitantes, "vistas de la landing; no son personas únicas", "c-visitantes")}{tile("Clics en «Crear mi oficina IA»", f.clics, `${pct(f.clics, f.visitantes)} de las visitas`, "c-clics")}{tile("Pagos iniciados", f.iniciados, `${pct(f.iniciados, f.clics)} de los clics`, "c-iniciados")}
      {tile("Pagos confirmados", f.pagos, `${pct(f.pagosPrimera, f.iniciados)} de los iniciados (primeras compras)`, "c-pagos")}{tile("Oficinas entregadas", f.entregadas, "creadas automáticamente", "c-entregadas")}{tile("Oficinas activadas", f.activadas, "≥1 empleado y ≥1 tarea completada", "c-activadas")}
      {tile("Costo de adquisición", f.cac === null ? "Sin datos" : mxn(f.cac), f.gasto > 0 ? `${mxn(f.gasto)} de gasto ÷ ${f.pagosPrimera} compras` : "registra tu gasto en anuncios abajo", "c-cac")}
      {tile("Ingresos", f.ingresos.length ? f.ingresos.map((r: any) => `${r.currency} ${r.total.toFixed(2)}`).join(" · ") : "Sin pagos", "según los pagos confirmados", "c-ingresos")}</div>
    {f.errores > 0 && <div className="tip" role="alert" data-testid="c-errores">⚠️ {f.errores} pago(s) confirmado(s) NO se pudieron entregar. Revisa la tabla de pedidos.</div>}
    <div className="muted">Correos: {f.correos.enviado ?? 0} enviados · {f.correos.en_cola ?? 0} en cola · {f.correos.error ?? 0} con error. <form action={sendEmailsAction} className="inline"><button className="ghost">Enviar los pendientes ahora</button></form></div>
    <div className="cols" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", marginTop: 14 }}>
      <div className="card"><h3>Pagos por fuente (primeras compras)</h3>{f.porFuente.length ? <table><thead><tr><th>Fuente</th><th>Pagos</th><th>Gasto</th><th>CAC</th></tr></thead><tbody>{f.porFuente.map((r: any) => <tr key={r.source}><td>{r.source}</td><td>{r.pagos}</td><td>{r.gasto ? mxn(r.gasto) : "—"}</td><td>{r.gasto ? mxn(r.gasto / r.pagos) : "Sin datos"}</td></tr>)}</tbody></table> : <p className="muted">Sin pagos todavía.</p>}</div>
      <div className="card"><h3>Registrar gasto en anuncios (MXN)</h3><form action={adSpendAction}><label htmlFor="d">Día</label><input id="d" name="day" type="date" required /><label htmlFor="s">Fuente</label><input id="s" name="source" defaultValue="meta" /><label htmlFor="a">Monto (MXN)</label><input id="a" name="amount" type="number" step="0.01" min="0" required data-testid="spend-amount" /><p><button data-testid="spend-save">Guardar gasto</button></p></form><p className="muted">Lo escribes tú desde Meta Ads: no hay conexión automática.</p></div>
      <div className="card"><h3>Cortesía: derecho de crear una oficina</h3><form action={grantRightAction}><label htmlFor="ge">Correo</label><input id="ge" name="email" type="email" required /><p><button className="ghost">Conceder derecho (sin cobro)</button></p></form></div></div>
    <h2 style={{ marginTop: 18 }}>Pedidos recientes</h2>{orders.length ? <table data-testid="orders"><thead><tr><th>Fecha</th><th>Correo</th><th>Oficina</th><th>Tipo</th><th>Monto</th><th>Fuente</th><th>Estado</th></tr></thead><tbody>{orders.map((o: any) => <tr key={o.id}><td>{when(o.created_at)}</td><td>{o.email}</td><td>{o.office ?? "—"}</td><td>{o.kind}</td><td>{o.amount_total != null ? `${String(o.currency).toUpperCase()} ${(Number(o.amount_total) / 100).toFixed(2)}` : "—"}</td><td>{o.source}</td><td>{o.status === "error" ? <span className="bad">⚠️ {o.last_error}</span> : o.status}</td></tr>)}</tbody></table> : <p className="muted">Aún no hay pedidos.</p>}</>);
}
