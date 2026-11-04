import { requireOperator, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { assertOperator } from "@/server/commercial/admin";
import { checkDns, classifyMailError, diagnoseEmail, maskEmail } from "@/server/commerce/email_health";
import { KIND_LABEL, mailConfig, EmailKind } from "@/server/commerce/mail";
import { Badge } from "@/components/shell/AppShell";
import { processEmailsAction, retryEmailAction, retryFailedAction } from "../../admin_actions";

export const dynamic = "force-dynamic";
const ENTREGA: Record<string, [string, "ok" | "warn" | "bad" | undefined]> = { delivered: ["Entregado", "ok"], aceptado: ["Aceptado por el proveedor (sin confirmar)", undefined], sent: ["Enviado por el proveedor", undefined], delivery_delayed: ["Demorado", "warn"], bounced: ["Rebotó", "bad"], complained: ["Marcado como spam", "bad"], failed: ["Falló en el proveedor", "bad"] };
export default async function Correos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const { db, op } = await requireOperator(); assertOperator(op);
  const d = await diagnoseEmail(db); const c = mailConfig(); const dnsRes = sp.dns && c.fromDomain ? await checkDns(c.fromDomain) : null;
  const rows = await db.query("SELECT id,to_email,kind,status,attempts,last_error,provider_status,delivery_status,delivery_detail,delivery_at,created_at,sent_at,manual_retries FROM emails ORDER BY created_at DESC LIMIT 100");
  const n = (k: string) => d.stats[k] ?? 0;
  return (<><h1>Correos y notificaciones</h1><Flash sp={sp} />
    <div className="tip" role="status" data-testid="mail-estado"><b>Proveedor:</b>&nbsp;{d.configured ? `Resend configurado · remitente de ${c.fromDomain}` : "NO configurado"} · <b>&nbsp;Estado de entrega real:</b>&nbsp;{c.webhookSecretSet ? "activo (webhook)" : "inactivo"}</div>
    <p className="muted">«Enviado» significa que el proveedor <b>aceptó</b> el mensaje, no que llegó al buzón. La entrega real (entregado/rebotó) la confirma el webhook del proveedor.</p>
    <div className="kpis" data-testid="mail-kpis"><div className="card kpi"><b>{n("enviado")}</b><span>Enviados (aceptados)</span></div><div className="card kpi"><b>{n("en_cola")}</b><span>Pendientes</span></div><div className="card kpi"><b>{n("error")}</b><span>Fallidos</span></div><div className="card kpi"><b>{n("entrega_delivered")}</b><span>Entrega confirmada</span></div></div>
    <h2>Diagnóstico</h2>{d.issues.length ? d.issues.map((i) => <div className="card" key={i.titulo} style={{ marginBottom: 10, borderColor: i.nivel === "critico" ? "var(--bad)" : undefined }} data-testid={`issue-${i.nivel}`}><b>{i.nivel === "critico" ? "Crítico: " : "Aviso: "}{i.titulo}</b><p className="muted" style={{ margin: "6px 0" }}>{i.detalle}</p><p style={{ margin: 0 }}><b>Qué hacer:</b> {i.solucion}</p></div>) : <div className="card" data-testid="sin-problemas">Sin problemas detectados en la configuración ni en los envíos recientes.</div>}
    <div className="row" style={{ margin: "14px 0" }}><form action={processEmailsAction} className="inline"><button className="ghost">Enviar pendientes ahora</button></form><form action={retryFailedAction} className="inline"><button className="ghost" data-testid="retry-failed">Reintentar fallidos</button></form>{c.fromDomain && <a className="btn ghost" href="/admin/correos?dns=1" data-testid="check-dns">Revisar DNS de {c.fromDomain}</a>}</div>
    {dnsRes && <div className="card" data-testid="dns-result"><h3>DNS de {c.fromDomain} (lectura en vivo)</h3><table><tbody>{dnsRes.map((r) => <tr key={r.registro}><td><Badge tone={r.estado === "ok" ? "ok" : r.estado === "aviso" ? "warn" : "bad"}>{r.estado === "ok" ? "OK" : r.estado === "aviso" ? "Aviso" : "Falta"}</Badge></td><td>{r.registro}</td><td className="muted">{r.detalle}</td></tr>)}</tbody></table><p className="muted">Los valores exactos los muestra Resend en Domains; aquí solo se comprueba que existan. No borres ni cambies tus registros actuales de correo.</p></div>}
    <h2 style={{ marginTop: 18 }}>Últimos correos</h2>
    {rows.length ? <table data-testid="mail-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Destinatario</th><th>Estado</th><th>Entrega</th><th>Intentos</th><th></th></tr></thead><tbody>{rows.map((r: any) => { const e = ENTREGA[r.delivery_status ?? ""]; const k = classifyMailError(r.last_error); return (<tr key={r.id}><td>{when(r.created_at)}</td><td>{KIND_LABEL[r.kind as EmailKind] ?? r.kind}</td><td>{maskEmail(r.to_email)}</td>
      <td><Badge tone={r.status === "enviado" ? "ok" : r.status === "error" ? "bad" : "warn"}>{r.status === "enviado" ? "Enviado" : r.status === "error" ? "Fallido" : "Pendiente"}</Badge>{r.last_error && <div className="muted" style={{ fontSize: ".78rem", maxWidth: 300 }}>{r.last_error}{k && <><br /><b>{k.causa}</b></>}</div>}</td>
      <td>{r.status === "enviado" ? (e ? <Badge tone={e[1]}>{e[0]}</Badge> : "—") : "—"}{r.delivery_detail && <div className="muted" style={{ fontSize: ".78rem" }}>{r.delivery_detail}</div>}</td><td>{r.attempts}{r.manual_retries ? ` (+${r.manual_retries} manual)` : ""}</td>
      <td>{r.status === "error" && r.manual_retries < 3 && <form action={retryEmailAction}><input type="hidden" name="id" value={r.id} /><button className="ghost" style={{ minHeight: 34 }}>Reintentar</button></form>}</td></tr>); })}</tbody></table> : <p className="muted">Todavía no se ha generado ningún correo.</p>}
    <p className="muted" style={{ marginTop: 14 }}>Este panel no guarda enlaces ni tokens: el enlace de acceso se arma al enviar y no se registra. Los destinatarios se muestran enmascarados.</p></>);
}
