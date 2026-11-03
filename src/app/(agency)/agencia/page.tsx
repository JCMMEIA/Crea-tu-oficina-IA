import Link from "next/link";
import { requireAgency, money, when } from "@/lib/session";
import { Empty } from "@/lib/ui";
import { agencyMetrics, getAgency } from "@/server/agency";
import { getProvider } from "@/server/models";
import { agencyScene } from "@/server/office3d";
import { IsoSvg } from "@/components/office3d/iso";

export default async function Panel() {
  const { db, agency } = await requireAgency(); const id = agency.agencyId;
  const ag = await getAgency(db, agency); const m = await agencyMetrics(db, agency);
  const n = async (q: string) => Number((await db.query<{ n: string }>(q, [id]))[0].n);
  const svc = await n("SELECT count(*) n FROM agency_services WHERE agency_id=$1"), pub = await n("SELECT count(*) n FROM agency_services WHERE agency_id=$1 AND status='publicado'");
  const skills = await n("SELECT count(*) n FROM agency_skill_templates WHERE agency_id=$1");
  const dep = await n("SELECT count(*) n FROM client_services WHERE agency_id=$1");
  const edited = await n("SELECT count(*) n FROM skill_versions sv JOIN companies c ON c.id=sv.company_id WHERE c.agency_id=$1 AND sv.version>1");
  const conn = await n("SELECT count(*) n FROM connections k JOIN companies c ON c.id=k.company_id WHERE c.agency_id=$1 AND k.status='conectado'");
  const done = m.tasksByStatus.completed ?? 0;
  const steps: [boolean, string, string][] = [[true, "Crear tu agencia", "/agencia"], [!!(ag.brand?.tagline || ag.brand?.logo), "Elegir identidad (logo y color)", "/agencia/identidad"], [svc > 0, "Seleccionar servicios a comercializar", "/agencia/servicios"], [skills > 0, "Configurar skills reutilizables", "/agencia/skills"], [pub > 0, "Publicar tu catálogo comercial", "/agencia/servicios"], [m.clients.length > 0, "Agregar una empresa cliente", "/agencia/clientes"], [dep > 0, "Crear su oficina y desplegar un servicio", "/agencia/clientes"], [edited > 0, "Personalizar los agentes del cliente", "/agencia/clientes"], [conn > 0, "Conectar aplicaciones autorizadas del cliente", "/agencia/clientes"], [done > 0, "Ejecutar una tarea real y ver el resultado", "/agencia/clientes"]];
  const scene = await agencyScene(db, agency);
  const next = steps.findIndex((s) => !s[0]);
  return (<><h1>Panel de agencia</h1><p className="muted">Plan {ag.planInfo.label} · hasta {ag.planInfo.maxClients} clientes y {ag.planInfo.maxEmployees} empleados de IA. Sin cobros activados.</p>
    {!getProvider() && <div className="notice">⚠️ La IA no está configurada en este servidor (<code>ANTHROPIC_API_KEY</code>): ninguna oficina puede ejecutar tareas todavía. No se muestran resultados simulados.</div>}
    <div className="stats">{[["Clientes", m.clients.length], ["Servicios publicados", `${pub}/${svc}`], ["Tareas completadas", done], ["Tareas fallidas", m.tasksByStatus.failed ?? 0], ["Aprobaciones pendientes", m.pendingApprovals], ["Costo de IA del mes", money(m.spend)]].map(([l, v]) => <div className="card stat" key={String(l)}><b>{v}</b><span>{l}</span></div>)}</div>
    {next !== -1 && <div className="card"><h2>Tu camino ({steps.filter((s) => s[0]).length}/10)</h2>{steps.map(([ok, t, h], i) => <div key={t}>{ok ? "✅" : i === next ? "👉" : "⬜"} {ok ? t : <Link href={h}>{t}</Link>}</div>)}</div>}
    <div className="grid" style={{ marginTop: 12 }}>
      <div className="card"><h2>Clientes</h2>{m.clients.length ? <table><tbody>{m.clients.map((c: any) => <tr key={c.id}><td><Link href={`/agencia/clientes/${c.id}`}>{c.name}</Link><div className="muted">{c.employees} empleados · {c.tasks} tareas</div></td><td>{money(c.month_cost)}<div className="muted">de US$ {c.budget}</div></td></tr>)}</tbody></table> : <Empty>Aún no tienes clientes. <Link href="/agencia/clientes">Agrega el primero</Link>.</Empty>}</div>
      <div className="card"><h2>Servicios</h2>{m.services.length ? <table><tbody>{m.services.map((s: any) => <tr key={s.id}><td>{s.name}</td><td>{s.deployments} clientes</td></tr>)}</tbody></table> : <Empty>Sin servicios. <Link href="/agencia/servicios">Crea tu catálogo</Link>.</Empty>}</div>
      <div className="card"><h2>Presupuesto de IA de la agencia</h2><p><b>{money(m.spend)}</b> de US$ {Number(m.budget).toFixed(2)} este mes</p><div style={{ background: "var(--chip)", borderRadius: 4 }}><div className="bar" style={{ width: `${Math.min(100, (m.spend / m.budget) * 100)}%` }} /></div><p className="muted">Costos estimados con las tarifas configuradas. Al llegar al tope, ninguna oficina ejecuta más tareas.</p></div></div>
    <div className="card o3d-card" style={{ marginTop: 12 }}><div style={{ height: 170 }}><IsoSvg scene={scene} showLabels={false} label="Miniatura de tu agencia" /></div>
      <div><h2>Visualiza tu Oficina 3D</h2><p className="muted">{scene.stats.zones ? `Tu agencia hoy: ${scene.stats.zones} cliente(s) y ${scene.stats.employees} empleado(s) de IA.` : "Agrega clientes y despliega servicios: tu agencia aparecerá aquí."}</p><Link className="btn" href="/agencia/oficina-3d">Abrir en 3D</Link></div></div>
    <p className="muted">Hora del servidor: {when(new Date())}</p></>);
}
