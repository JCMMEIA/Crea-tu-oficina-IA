import { requireActor, when } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { listConnections } from "@/server/connectors";
import { connectAction } from "../../actions";
export default async function Conexiones({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const list = await listConnections(db, actor); const cats = [...new Set(list.map((l) => l.category))];
  const btn = (k: string, op: string, label: string, cls = "") => <form className="inline" action={connectAction}><input type="hidden" name="toolkit" value={k} /><input type="hidden" name="op" value={op} /><button className={cls}>{label}</button></form>;
  return (<><h1>Conecta tu empresa</h1><Flash sp={sp} />
    {!list[0].providerConfigured && <div className="notice">Composio no está configurado (<code>COMPOSIO_API_KEY</code>), así que ninguna conexión puede iniciarse todavía. Ver la guía en Ayuda. Las conexiones son de tu empresa y están aisladas de las demás.</div>}
    {cats.map((c) => (<section key={c} style={{ marginBottom: 16 }}><h2>{c}</h2><div className="grid">{list.filter((l) => l.category === c).map((l) => (<div className="card" key={l.key}><h3>{l.label}</h3>
      <p><span className={`chip ${l.status === "conectado" ? "ok" : l.status === "error" ? "bad" : l.status === "pendiente" ? "warn" : ""}`}>{l.status}</span><span className="chip">{l.availability === "no-disponible" ? "no disponible aún" : l.availability === "composio" ? "vía Composio" : "API oficial (pendiente)"}</span></p>
      <p className="muted">{l.note}</p>
      {l.account && <p>Cuenta: {l.account}</p>}{l.lastSync && <p className="muted">Última sincronización: {when(l.lastSync)}</p>}{l.lastError && <p className="bad">{l.lastError}</p>}
      {l.usedBy.length > 0 && <p className="muted">Usada por: {l.usedBy.join(", ")}</p>}
      <div className="row">{l.status === "desconectado" ? (l.canConnect ? btn(l.key, "connect", "Conectar") : <button disabled>No disponible</button>) : <>{btn(l.key, "test", "Probar conexión", "ghost")}{btn(l.key, "disconnect", "Desconectar", "ghost")}</>}</div></div>))}</div></section>))}</>);
}
