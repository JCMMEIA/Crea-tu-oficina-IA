import Link from "next/link";
import { requireAgency, money, when } from "@/lib/session";
import { Flash, BigAction, StatusChip, EmptyState, Tip } from "@/lib/ui";
import { agencyMetrics, getAgency } from "@/server/agency";
import { getOnboarding, STEPS } from "@/server/onboarding";
import { getProvider } from "@/server/models";
import { agencyScene } from "@/server/office3d";
import { IsoSvg } from "@/components/office3d/iso";
import { Toast } from "@/lib/guide";

export const metadata = { title: "Mi oficina" };
export default async function Panel({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const id = agency.agencyId;
  const ag = await getAgency(db, agency); const m = await agencyMetrics(db, agency); const ob = await getOnboarding(db, agency); const scene = await agencyScene(db, agency);
  const real = m.clients.filter((c: any) => !c.is_demo); const employees = m.clients.reduce((n: number, c: any) => n + c.employees, 0);
  const recent = await db.query("SELECT t.id,t.title,t.status,t.created_at,e.name en,c.name cn FROM tasks t JOIN employees e ON e.id=t.employee_id JOIN companies c ON c.id=t.company_id WHERE c.agency_id=$1 ORDER BY t.created_at DESC LIMIT 5", [id]);
  const ai = !!getProvider();
  return (<><h1>Mi oficina</h1><p className="lead">{ag.name}: aquí empieza todo. ¿Qué quieres hacer hoy?</p>
    {sp.ok && <Toast message={sp.ok} />}<Flash sp={{ error: sp.error }} />
    {!ob.done && <div className="hero-card" data-testid="resume-wizard"><h2>👋 Vamos a crear tu negocio</h2><p>Te faltan unos pasos para tener tu primera oficina lista (vas en el paso {ob.step} de {STEPS.length}: {STEPS[ob.step - 1]}).</p><Link className="btn big" href={`/empezar?paso=${ob.step}`}>Continuar donde lo dejé</Link></div>}
    {m.pendingApprovals > 0 && <div className="hero-card" style={{ borderColor: "var(--warn)" }}><h2>✋ Tienes {m.pendingApprovals} cosa(s) esperando tu permiso</h2><p>Tus empleados no hacen cambios importantes sin que tú digas que sí.</p><Link className="btn big" href="/agencia/soporte">Revisar ahora</Link></div>}
    <div className="actions" data-testid="quick-actions">
      <BigAction href="/agencia/contratar" icon="➕" title="Agregar empleado" text="Elige quién te ayuda y para qué." testId="qa-empleado" />
      <BigAction href="/agencia/skills" icon="🎓" title="Enseñar a mi empleado" text="Cuéntale cómo quieres que trabaje." />
      <BigAction href="/agencia/tarea" icon="📝" title="Crear tarea" text="Pídele un trabajo a un empleado." testId="qa-tarea" />
      <BigAction href="/agencia/oficina-3d" icon="🏢" title="Ver mi oficina" text="Mira a todos tus empleados en un mapa." />
      <BigAction href="/agencia/clientes" icon="👥" title="Agregar cliente" text="Cada cliente tiene su propia oficina." testId="qa-cliente" />
      <BigAction href="/agencia/propuestas" icon="📄" title="Preparar propuesta" text="Arma una oferta con tus servicios." />
      <BigAction href="/celular" icon="💬" title="Conectar WhatsApp" text="Habla con tus empleados desde el celular." />
      <BigAction href="/agencia/asistente" icon="🧭" title="Pedir ayuda al asistente" text="Cuéntame qué quieres vender." testId="qa-asistente" /></div>
    {!ai && <Tip icon="ℹ️">Tus empleados todavía no pueden trabajar de verdad: falta activar la inteligencia artificial en esta instalación. Mientras tanto puedes practicar con ejemplos inventados en <Link href="/empezar?paso=6">la prueba guiada</Link>.</Tip>}
    <div className="stats">{[["👥", "Clientes", real.length], ["🧑‍💼", "Empleados", employees], ["✋", "Por aprobar", m.pendingApprovals], ["✅", "Trabajos listos", m.tasksByStatus.completed ?? 0]].map(([ic, l, v]) => <div className="card stat" key={String(l)}><b>{ic} {v}</b><span>{l}</span></div>)}</div>
    <div className="grid">
      <div className="card"><h2>Trabajo reciente</h2>{recent.length ? <table><tbody>{recent.map((t) => <tr key={t.id}><td>{t.title}<div className="muted">{t.en} · {t.cn} · {when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <EmptyState icon="🌱" title="Aún no hay trabajo" text="Cuando pidas la primera tarea, aquí verás cómo va." href="/agencia/tarea" cta="Crear tarea" />}</div>
      <div className="card o3d-card"><div style={{ height: 150 }}><IsoSvg scene={scene} showLabels={false} label="Mapa de tu oficina" /></div><div><h2>Tu oficina</h2><p className="muted">{scene.stats.employees ? `${scene.stats.employees} empleado(s) en ${scene.stats.zones} oficina(s).` : "Contrata a tu primer empleado y aparecerá aquí."}</p><Link className="btn" href="/agencia/oficina-3d">Ver mi oficina</Link></div></div>
      <div className="card"><h2>Consumo de inteligencia artificial</h2><p>Este mes: <b>{money(m.spend)}</b> de {money(Number(m.budget))} permitidos.</p><div style={{ background: "var(--chip)", borderRadius: 4 }}><div className="bar" style={{ width: `${Math.min(100, (m.spend / m.budget) * 100)}%` }} /></div><p className="muted">Es una estimación. Al llegar al tope, tus empleados dejan de trabajar hasta el mes siguiente.</p></div></div></>);
}
