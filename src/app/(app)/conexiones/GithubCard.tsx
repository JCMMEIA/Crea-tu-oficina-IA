import { when } from "@/lib/session";
import { Tip } from "@/lib/ui";
import { githubAction } from "../../github_actions";
import { DEFAULT_FILTERS } from "@/server/github/filters";
import { GitHubClient, githubConfig, githubOverview, getClient } from "@/server/github";
import type { Db } from "@/server/db";
import type { Actor } from "@/server/auth";
import { can } from "@/server/auth";

const OP = ({ op, label, cls = "ghost", note }: { op: string; label: string; cls?: string; note?: string }) => (
  <form action={githubAction}><input type="hidden" name="op" value={op} /><button className={cls} title={note} data-testid={`gh-${op}`}>{label}</button></form>);

/** Tarjeta «Conectar GitHub»: solo lectura, con repositorios elegidos por el cliente. El estado mostrado es el real. */
export async function GithubCard({ db, actor }: { db: Db; actor: Actor }) {
  const o = await githubOverview(db, actor), manage = can(actor, "connections:manage"), connected = o.conn?.status === "conectado";
  let available: { full_name: string }[] = [], listError = "";
  if (connected && manage) { try { available = await (getClient() as GitHubClient).listRepos(o.conn!.external_id); } catch (e: any) { listError = e.message; } }
  const chosen = new Map(o.sources.map((s: any) => [s.repo as string, (s.path_filters as string[]).join("\n")]));
  const state = !o.configured ? ["warn", "🔧 Necesita que la activen"] : connected ? ["ok", "✅ Conectada"] : o.conn?.status === "error" ? ["warn", "⚠️ Con problema"] : ["", "👉 Lista para conectar"];
  return (<div className="card" id="github" data-testid="app-github" data-state={!o.configured ? "necesita" : connected ? "conectada" : "lista"}>
    <div className="ic" aria-hidden="true">🐙</div><h3>GitHub (documentación)</h3><span className={`state ${state[0]}`}>{state[1]}</span>
    <p><b>Para qué sirve:</b> que tus empleados consulten la documentación de tu negocio guardada en tus repositorios (por ejemplo manuales y procesos en Markdown o TXT).</p>
    <p><b>Qué permisos pide:</b> solo lectura de los repositorios que tú elijas al instalar la App. No puede cambiar, borrar ni subir nada. Se omiten claves, contraseñas, archivos .env y archivos que no son texto.</p>
    {o.conn?.account_label && <p><b>Cuenta:</b> {o.conn.account_label}</p>}
    {o.conn?.last_sync && <p className="muted">Última sincronización: {when(o.conn.last_sync)}</p>}
    {o.conn?.last_error && <p className="bad">⚠️ {o.conn.last_error}</p>}
    {!o.configured && <div className="notice"><b>Para activarla</b> (lo hace quien instaló la plataforma): crear la GitHub App de solo lectura y guardar sus claves en el servidor. Pasos en <code>docs/GITHUB_CONEXION.md</code>.</div>}
    {o.configured && !connected && manage && <OP op="connect" label="Conectar GitHub" cls="big" />}
    {connected && <>
      {o.sources.length > 0 && <table data-testid="gh-sources"><thead><tr><th>Repositorio</th><th>Estado</th><th>Documentos</th><th>Última vez</th></tr></thead><tbody>{o.sources.map((s: any) => <tr key={s.repo}><td>{s.repo}<div className="muted">{(s.path_filters as string[]).join(", ")}</div></td><td>{s.status}{s.last_error && <div className="bad">{s.last_error}</div>}</td><td>{s.files}{s.skipped > 0 && <div className="muted">{s.skipped} omitidos</div>}</td><td>{when(s.last_sync)}</td></tr>)}</tbody></table>}
      {manage && <>
        <form action={githubAction} data-testid="gh-select"><input type="hidden" name="op" value="select" />
          <h4>1. Elige repositorios y carpetas</h4>{listError && <p className="bad">⚠️ {listError}</p>}
          {available.length === 0 && !listError && <p className="muted">No hay repositorios autorizados todavía: añádelos en GitHub (Settings → Applications → configurar).</p>}
          {available.map((r) => <div key={r.full_name}><label style={{ fontWeight: 400 }}><input type="checkbox" name="repo" value={r.full_name} defaultChecked={chosen.has(r.full_name)} style={{ width: "auto" }} /> {r.full_name}</label>
            <textarea name={`paths:${r.full_name}`} rows={2} placeholder={`Carpetas o archivos, uno por línea. Vacío = ${DEFAULT_FILTERS.join(", ")}`} defaultValue={chosen.get(r.full_name) ?? ""} aria-label={`Documentación de ${r.full_name}`} /></div>)}
          <p><button>Guardar selección</button></p></form>
        <form action={githubAction} data-testid="gh-access"><input type="hidden" name="op" value="access" /><h4>2. ¿Qué empleados pueden consultarla?</h4>
          {o.employees.map((e: any) => <label key={e.id} style={{ fontWeight: 400, display: "block" }}><input type="checkbox" name="employee" value={e.id} defaultChecked={o.access.includes(e.id)} style={{ width: "auto" }} /> {e.name} — {e.role_title}</label>)}
          <p><button>Guardar empleados</button></p></form>
        <div className="row"><OP op="sync" label="🔄 Sincronizar ahora" cls="big" /><OP op="delete_knowledge" label="Borrar lo importado" /></div>
        <details style={{ marginTop: 8 }}><summary>Desconectar</summary><div className="row"><OP op="disconnect" label="Solo desconectar" /><OP op="disconnect_delete" label="Desconectar y borrar lo importado" /></div><p className="muted">Al desconectar, tus empleados dejan de usarla al instante y quitamos la App de tu cuenta de GitHub.</p></details></>}
      <Tip>Lo que lee tu equipo de GitHub se trata como información interna de tu empresa y cada respuesta indica de qué repositorio, archivo y revisión salió.</Tip></>}
  </div>);
}
