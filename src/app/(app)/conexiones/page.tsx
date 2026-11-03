import Link from "next/link";
import { requireActor, when } from "@/lib/session";
import { Flash, Tip } from "@/lib/ui";
import { SIMPLE_APPS, OTHER_APPS, appView, AppView } from "@/server/connectors/simple";
import { ComposioAdapter } from "@/server/connectors";
import { channelStatus } from "@/server/messaging/runtime";
import { connectAction } from "../../actions";
import { appInterestAction } from "../../agency_actions";
import { can } from "@/server/auth";

export const metadata = { title: "Conecta tus aplicaciones" };
export default async function Conexiones({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; ayuda?: string }> }) {
  const sp = await searchParams; const { db, actor, agency } = await requireActor();
  const rows = await db.query("SELECT toolkit,status,account_label,last_sync,last_error FROM connections WHERE company_id=$1", [actor.companyId]);
  const connected = new Set(rows.filter((r) => r.status === "conectado").map((r) => r.toolkit as string));
  const env = { composioReady: new ComposioAdapter().configured(), channels: channelStatus(), connected };
  const canConnect = can(actor, "connections:manage");
  const card = (app: (typeof SIMPLE_APPS)[number]) => {
    const v: AppView = appView(app, env); const row = rows.find((r) => r.toolkit === app.toolkit); const open = sp.ayuda === app.id;
    const tone = v.state === "conectada" ? "ok" : v.state === "lista" ? "" : "warn";
    return (<div className="card app-card" key={app.id} data-testid={`app-${app.id}`} data-state={v.state}>
      <div className="ic" aria-hidden="true">{app.icon}</div><h3>{app.title}</h3><span className={`state ${tone}`}>{v.icon} {v.label}</span>
      <p><b>Para qué sirve:</b> {app.para}</p><p><b>Qué empleados la usan:</b> {v.employees.length ? v.employees.join(", ") : "—"}</p><p><b>Qué permisos pide:</b> {app.permisos}</p>
      {row?.last_error && <p className="bad">⚠️ {row.last_error}</p>}{row?.last_sync && <p className="muted">Última revisión: {when(row.last_sync)}</p>}
      {v.state === "lista" && app.channel && <Link className="btn big" href="/celular" data-testid={`btn-${app.id}`}>Conectar</Link>}
      {v.state === "lista" && !app.channel && canConnect && <form action={connectAction}><input type="hidden" name="toolkit" value={app.toolkit} /><input type="hidden" name="op" value="connect" /><button className="big" style={{ width: "100%" }} data-testid={`btn-${app.id}`}>Conectar</button></form>}
      {v.state === "conectada" && canConnect && <div className="row"><form action={connectAction}><input type="hidden" name="toolkit" value={app.toolkit} /><input type="hidden" name="op" value="test" /><button className="ghost">Probar conexión</button></form><form action={connectAction}><input type="hidden" name="toolkit" value={app.toolkit} /><input type="hidden" name="op" value="disconnect" /><button className="ghost">Desconectar</button></form></div>}
      {v.state === "necesita" && <Link className="btn big" href={`/conexiones?ayuda=${app.id}#${app.id}`} data-testid={`btn-${app.id}`}>Ver cómo activarla</Link>}
      {v.state === "proximamente" && <form action={appInterestAction}><input type="hidden" name="app" value={app.id} /><input type="hidden" name="back" value="/conexiones" /><input type="hidden" name="title" value={app.title} /><button className="ghost">Avísame cuando esté</button></form>}
      {open && v.state === "necesita" && <div className="notice" id={app.id} data-testid="steps"><b>Para activarla, hay que hacer esto (uno por uno):</b><ol>{v.steps.map((s) => <li key={s}>{s}</li>)}</ol><p className="muted">Esto lo hace quien instaló la plataforma. Mientras tanto, tus empleados siguen trabajando con lo que les cuentes.</p></div>}
    </div>);
  };
  return (<><h1>Conecta tus aplicaciones</h1><p className="lead">Conectar una aplicación deja que tus empleados vean datos reales (por ejemplo, tus pedidos). Es opcional y siempre con tu permiso.</p><Flash sp={sp} />
    <Tip>Cada tarjeta dice la verdad: si algo todavía no se puede conectar, lo verás como «Necesita que la activen» o «Próximamente». Nunca fingimos una conexión.</Tip>
    {agency && <p className="muted">Estás conectando las aplicaciones de este cliente. <Link href="/agencia/conexiones">Elegir otro cliente</Link></p>}
    <div className="grid" data-testid="apps">{SIMPLE_APPS.map(card)}</div>
    <details className="card" style={{ marginTop: 12 }}><summary><b>🧩 Otras aplicaciones</b></summary><div className="grid" style={{ marginTop: 10 }}>{OTHER_APPS.map(card)}</div></details></>);
}
