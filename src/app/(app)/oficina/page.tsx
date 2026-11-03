import Link from "next/link";
import { requireActor, money, when } from "@/lib/session";
import { StatusChip, Empty } from "@/lib/ui";
import { usageSummary } from "@/server/usage";
import { getProvider } from "@/server/models";
import { companyScene } from "@/server/office3d";
import { IsoSvg } from "@/components/office3d/iso";

export default async function Oficina() {
  const { db, actor } = await requireActor(); const c = actor.companyId;
  const n = async (sql: string) => Number((await db.query<{ n: string }>(sql, [c]))[0].n);
  const active = await n("SELECT count(*) n FROM employees WHERE company_id=$1 AND status='active'");
  const emps = await n("SELECT count(*) n FROM employees WHERE company_id=$1");
  const done = await n("SELECT count(*) n FROM tasks WHERE company_id=$1 AND status='completed'");
  const pend = await n("SELECT count(*) n FROM tasks WHERE company_id=$1 AND status IN ('requested','in_progress')");
  const errs = await n("SELECT count(*) n FROM tasks WHERE company_id=$1 AND status='failed'");
  const auth = await n("SELECT count(*) n FROM approvals WHERE company_id=$1 AND status='pending'");
  const conn = await n("SELECT count(*) n FROM connections WHERE company_id=$1 AND status='conectado'");
  const u = await usageSummary(db, c);
  const recent = await db.query("SELECT t.id,t.title,t.status,t.created_at,e.name en FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 ORDER BY t.created_at DESC LIMIT 6", [c]);
  const prof = (await db.query("SELECT profile FROM companies WHERE id=$1", [c]))[0].profile;
  const steps: [boolean, string, string][] = [[Object.keys(prof).length > 0, "Completa el perfil de tu negocio", "/construir?paso=1"], [emps > 0, "Contrata tu primer empleado", "/construir?paso=3"], [conn > 0, "Conecta una aplicación", "/conexiones"], [done > 0, "Asígnale una primera tarea", "/departamentos"]];
  const scene = await companyScene(db, actor);
  const max = Math.max(0.0001, ...u.byEmployee.map((e: any) => e.cost_usd));
  return (<><h1>Panel de dirección</h1>
    {!getProvider() && <div className="notice">⚠️ La IA no está configurada: los empleados no pueden ejecutar tareas. Falta <code>ANTHROPIC_API_KEY</code> (ver <Link href="/ayuda">Ayuda</Link>). No se muestran resultados simulados.</div>}
    {steps.some((s) => !s[0]) && <div className="card"><h2>Primeros pasos</h2>{steps.map(([ok, t, h]) => <div key={t}>{ok ? "✅" : "⬜"} {ok ? t : <Link href={h}>{t}</Link>}</div>)}</div>}
    <div className="stats">{[["Agentes activos", `${active}/${emps}`], ["Completadas", done], ["Pendientes", pend], ["Errores y bloqueos", errs], ["Autorizaciones", auth], ["Conexiones", conn]].map(([l, v]) => <div className="card stat" key={String(l)}><b>{v}</b><span>{l}</span></div>)}</div>
    <div className="grid"><div className="card"><h2>Consumo de IA este mes</h2><p><b>{money(u.spent)}</b> de US$ {u.budget.toFixed(2)} <span className="muted">(estimado con tarifas configuradas)</span></p>
      <div style={{ background: "var(--chip)", borderRadius: 4 }}><div className="bar" style={{ width: `${Math.min(100, (u.spent / u.budget) * 100)}%` }} /></div>
      {u.byEmployee.length ? <table><tbody>{u.byEmployee.map((e: any) => <tr key={e.name}><td>{e.name}</td><td>{e.calls} llamadas</td><td>{money(e.cost_usd)}<div className="bar" style={{ width: `${(e.cost_usd / max) * 100}%` }} /></td></tr>)}</tbody></table> : <p className="muted">Sin consumo todavía.</p>}</div>
      <div className="card"><h2>Actividad reciente</h2>{recent.length ? <table><tbody>{recent.map((t) => <tr key={t.id}><td><Link href={`/actividad/${t.id}`}>{t.title}</Link><div className="muted">{t.en} · {when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <Empty>Aún no hay actividad real. Asigna una tarea a un empleado.</Empty>}</div></div>
    <div className="card o3d-card" style={{ marginTop: 12 }}><div style={{ height: 170 }}><IsoSvg scene={scene} showLabels={false} label="Miniatura de tu oficina" /></div>
      <div><h2>Visualiza tu Oficina 3D</h2><p className="muted">{emps > 0 ? `Mira cómo se organizan tus ${emps} empleado(s) de IA en ${scene.stats.zones} área(s).` : "Contrata a tus primeros empleados y verás tu oficina tomar forma."}</p><Link className="btn" href="/oficina-3d">Abrir mi oficina 3D</Link></div></div>
    <p className="muted">Los indicadores empresariales (ventas, ROAS…) aparecerán cuando conectes tus aplicaciones; hoy no se muestran datos de ejemplo.</p></>);
}
