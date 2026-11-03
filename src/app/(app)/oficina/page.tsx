import Link from "next/link";
import { requireActor, money, when } from "@/lib/session";
import { StatusChip, EmptyState, BigAction, Tip } from "@/lib/ui";
import { usageSummary } from "@/server/usage";
import { getProvider } from "@/server/models";
import { companyScene } from "@/server/office3d";
import { IsoSvg } from "@/components/office3d/iso";
import { Toast } from "@/lib/guide";

export const metadata = { title: "Mi oficina" };
export default async function Oficina({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor(); const c = actor.companyId;
  const n = async (sql: string) => Number((await db.query<{ n: string }>(sql, [c]))[0].n);
  const emps = await n("SELECT count(*) n FROM employees WHERE company_id=$1"); const done = await n("SELECT count(*) n FROM tasks WHERE company_id=$1 AND status='completed'");
  const pend = await n("SELECT count(*) n FROM tasks WHERE company_id=$1 AND status IN ('requested','in_progress')"); const auth = await n("SELECT count(*) n FROM approvals WHERE company_id=$1 AND status='pending'");
  const u = await usageSummary(db, c); const scene = await companyScene(db, actor);
  const recent = await db.query("SELECT t.id,t.title,t.status,t.created_at,e.name en FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 ORDER BY t.created_at DESC LIMIT 6", [c]);
  return (<><h1>Mi oficina</h1><p className="lead">Todo lo que pasa en tu oficina, en un solo lugar.</p>{sp.ok && <Toast message={sp.ok} />}
    {auth > 0 && <div className="hero-card" style={{ borderColor: "var(--warn)" }}><h2>✋ Hay {auth} cosa(s) esperando tu permiso</h2><p>Tus empleados no hacen cambios importantes sin tu sí.</p><Link className="btn big" href="/aprobaciones">Revisar ahora</Link></div>}
    {emps === 0 && <div className="hero-card"><h2>🧑‍💼 ¡Vamos a contratar a tu primer empleado!</h2><p>Elige qué trabajo quieres que haga.</p><Link className="btn big" href="/agregar-empleado">Elegir empleado</Link></div>}
    <div className="actions"><BigAction href="/agregar-empleado" icon="➕" title="Agregar empleado" text="Contrata a alguien para un trabajo." /><BigAction href="/departamentos" icon="📝" title="Crear tarea" text="Elige un empleado y pídele algo." testId="office-task" />
      <BigAction href="/oficina-3d" icon="🏢" title="Ver mi oficina" text="Mira a tu equipo en un mapa." /><BigAction href="/conexiones" icon="🔌" title="Conecta tus aplicaciones" text="WhatsApp, Instagram, Shopify…" /></div>
    {!getProvider() && <Tip icon="ℹ️">Tus empleados todavía no pueden trabajar de verdad: falta activar la inteligencia artificial en esta instalación.</Tip>}
    <div className="stats">{[["🧑‍💼", "Empleados", emps], ["✅", "Trabajos listos", done], ["⏳", "En marcha", pend], ["✋", "Por aprobar", auth]].map(([ic, l, v]) => <div className="card stat" key={String(l)}><b>{ic} {v}</b><span>{l}</span></div>)}</div>
    <div className="grid"><div className="card"><h2>📋 Trabajo reciente</h2>{recent.length ? <table><tbody>{recent.map((t) => <tr key={t.id}><td><Link href={`/actividad/${t.id}`}>{t.title}</Link><div className="muted">{t.en} · {when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <EmptyState icon="🌱" title="Aún no hay trabajo" text="Pídele una tarea a un empleado y aquí verás cómo va." href="/departamentos" cta="Crear tarea" />}</div>
      <div className="card o3d-card"><div style={{ height: 150 }}><IsoSvg scene={scene} showLabels={false} label="Mapa de tu oficina" /></div><div><h2>Mi oficina</h2><p className="muted">{emps ? `${emps} empleado(s) en ${scene.stats.zones} área(s).` : "Aquí aparecerá tu equipo."}</p><Link className="btn" href="/oficina-3d">Ver mi oficina</Link></div></div>
      <div className="card"><h2>💸 Consumo de inteligencia artificial</h2><p>Este mes: <b>{money(u.spent)}</b> de {money(u.budget)} permitidos.</p><div style={{ background: "var(--chip)", borderRadius: 4 }}><div className="bar" style={{ width: `${Math.min(100, (u.spent / u.budget) * 100)}%` }} /></div></div></div></>);
}
