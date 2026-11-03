import Link from "next/link";
import { requireUser, when } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { channelStatus } from "@/server/messaging/runtime";
import { listOwnIdentities, listAgencyIdentities } from "@/server/messaging/link";
import { accessibleCompanies } from "@/server/messaging/access";
import { listMessagingTasks } from "@/server/messaging/history";
import { getSettings } from "@/server/messaging/settings";
import { EMPLOYEES } from "@/server/catalog/data";
import { agencyCan } from "@/server/auth";
import { StatusChip } from "@/lib/ui";
import { LinkPanel } from "./LinkPanel";
import { prefsAction, revokeAction, settingsAction } from "./actions";

export const metadata = { title: "Mi oficina en el celular" };
export const dynamic = "force-dynamic";
export default async function Celular({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, user, agency } = await requireUser();
  const status = channelStatus();
  const mine = await listOwnIdentities(db, user.userId);
  const companies = await accessibleCompanies(db, user.userId);
  const tasks = await listMessagingTasks(db, user.userId, agency);
  const people = agency ? await listAgencyIdentities(db, agency) : [];
  const settings = agency ? await getSettings(db, agency.agencyId) : null;
  const names = new Map(companies.map((c) => [c.id, c.name]));
  const home = agency ? "/agencia" : "/oficina";
  return (<div className="land" style={{ maxWidth: 1000 }}>
    <header><b>📱 Mi oficina en el celular</b><Link href={home}>← Volver a la aplicación</Link></header>
    <p className="muted">Habla con tus empleados de IA por Telegram o WhatsApp: envía una idea, asigna tareas, consulta avances, recibe resultados y aprueba acciones. Solo se aceptan órdenes de chats que vinculaste aquí.</p>
    <Flash sp={sp} />
    <div className="grid">
      <LinkPanel channel="telegram" label="Telegram" configured={status.telegram} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? ""} waNumber="" />
      <LinkPanel channel="whatsapp" label="WhatsApp" configured={status.whatsapp} botUsername="" waNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""} />
    </div>
    <div className="notice">Estado de los canales en este servidor: Telegram {status.telegram ? "configurado" : "sin configurar"} · WhatsApp {status.whatsapp ? "configurado" : "sin configurar"}. «Configurado» significa que hay credenciales; no que ya se probó un envío real.</div>

    <section className="card" style={{ marginTop: 12 }}><h2>Mis vinculaciones y avisos</h2>
      {mine.length ? mine.map((i) => (<div key={i.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
        <b>{i.channel === "telegram" ? "Telegram" : "WhatsApp"}</b> {i.display} <span className={`chip ${i.status === "active" ? "ok" : "bad"}`}>{i.status === "active" ? "conectado" : "revocado"}</span>
        <div className="muted">Última actividad: {when(i.last_inbound_at)}{i.active_company_id ? ` · empresa activa: ${names.get(i.active_company_id) ?? "—"}` : ""}</div>
        {i.status === "active" && (<div className="row" style={{ alignItems: "flex-start" }}>
          <form action={prefsAction} className="row"><input type="hidden" name="id" value={i.id} />
            {([["task_done", "Tareas terminadas"], ["errors", "Errores"], ["approvals", "Aprobaciones pendientes"], ["alerts", "Alertas"]] as const).map(([k, l]) => <label key={k} style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name={k} defaultChecked={i.prefs[k]} style={{ width: "auto" }} /> {l}</label>)}
            <label style={{ fontWeight: 400, margin: 0 }}>Resumen <select name="digest" defaultValue={i.prefs.digest} style={{ width: "auto" }}><option value="off">no</option><option value="daily">diario</option></select></label><button className="ghost">Guardar</button></form>
          <form action={revokeAction}><input type="hidden" name="id" value={i.id} /><button className="danger">Desconectar y revocar acceso</button></form></div>)}
      </div>)) : <Empty>Aún no has conectado Telegram ni WhatsApp.</Empty>}
      <p className="muted">Respetamos la ventana de 24 h de WhatsApp: fuera de ella solo se envían avisos con plantilla aprobada, si existe. Escribe «baja» en el chat para apagar los avisos.</p></section>

    <section className="card" style={{ marginTop: 12 }}><h2>Agencias y empresas vinculadas</h2>
      {companies.length ? <table><tbody>{companies.map((c) => <tr key={c.id}><td>{c.name}<div className="muted">{c.agencyName}</div></td><td><span className="chip">{c.via === "agencia" ? "como agencia" : "como miembro"}</span><span className="chip">{c.role}</span></td></tr>)}</tbody></table> : <Empty>Tu cuenta no tiene empresas vinculadas.</Empty>}
      <p className="muted">Por chat solo puedes tratar con estas empresas y solo hacer lo que tu rol permite.</p></section>

    {agency && <section className="card" style={{ marginTop: 12 }}><h2>Usuarios autorizados de tu agencia</h2>
      {people.length ? <table><tbody>{people.map((p: any) => <tr key={p.id}><td>{p.email}<div className="muted">{p.channel === "telegram" ? "Telegram" : "WhatsApp"} {p.display} · última actividad {when(p.last_inbound_at)}</div></td><td><span className={`chip ${p.status === "active" ? "ok" : "bad"}`}>{p.status === "active" ? "conectado" : "revocado"}</span></td>
        <td>{p.status === "active" && agencyCan(agency, "agency:clients") && <form action={revokeAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="scope" value="agency" /><button className="ghost">Revocar</button></form>}</td></tr>)}</tbody></table> : <Empty>Nadie de tu agencia ha conectado un canal.</Empty>}</section>}

    <section className="card" style={{ marginTop: 12 }}><h2>Historial de tareas iniciadas por mensajes</h2>
      {tasks.length ? <table><tbody>{tasks.map((t: any) => <tr key={t.id}><td><Link href={`/actividad/${t.id}`}>{t.title}</Link><div className="muted">{t.company_name} · {t.who} · {t.channel === "telegram" ? "Telegram" : "WhatsApp"} · {when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <Empty>Todavía no has iniciado tareas por mensaje.</Empty>}</section>

    {agency && settings && <section className="card" style={{ marginTop: 12 }}><h2>Tu asistente (marca blanca)</h2>
      <div className="notice">En esta versión todas las agencias comparten el bot de Telegram y el número de WhatsApp de la plataforma: el nombre y los textos del asistente son los tuyos, pero la cuenta remitente <b>no</b> lleva tu marca. Bots y números propios por agencia: fase posterior (la base para guardar sus credenciales cifradas ya existe).</div>
      <form action={settingsAction}><div className="grid"><div><label>Nombre visible del asistente</label><input name="assistantName" defaultValue={settings.assistantName} placeholder={`Asistente de ${settings.agencyName}`} maxLength={60} /></div>
        <div><label>Tono</label><select name="tone" defaultValue={settings.tone}><option value="cercano">Cercano (tú)</option><option value="formal">Formal</option></select></div>
        <div><label>Máx. avisos por persona al día</label><input type="number" name="maxPerDay" defaultValue={settings.maxNotificationsPerDay} min={1} max={200} /></div></div>
        <label>Mensaje de bienvenida</label><textarea name="welcome" rows={2} defaultValue={settings.welcome} maxLength={500} />
        <label style={{ fontWeight: 400 }}><input type="checkbox" name="allowDigest" defaultChecked={settings.allowDigest} style={{ width: "auto" }} /> Permitir resúmenes diarios</label>
        <details><summary>Empleados asignables por mensaje ({settings.allowedTemplateKeys.length ? `${settings.allowedTemplateKeys.length} elegidos` : "todos"})</summary><div style={{ columns: "220px" }}>{EMPLOYEES.map((e) => <label key={e.key} style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name="allowed" value={e.key} defaultChecked={settings.allowedTemplateKeys.includes(e.key)} style={{ width: "auto" }} /> {e.name}</label>)}</div><p className="muted">Sin ninguno marcado, todos los empleados son asignables.</p></details>
        <p><button>Guardar asistente</button></p></form></section>}
  </div>);
}
