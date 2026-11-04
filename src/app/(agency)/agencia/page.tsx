import Link from "next/link";
import { requireAgency, money, when } from "@/lib/session";
import { Flash, BigAction, StatusChip, EmptyState, Tip } from "@/lib/ui";
import { agencyMetrics, getAgency } from "@/server/agency";
import { getOnboarding, STEPS } from "@/server/onboarding";
import { getProvider } from "@/server/models";
import { agencyScene } from "@/server/office3d";
import { IsoSvg } from "@/components/office3d/iso";
import { Toast } from "@/lib/guide";
import { Icon } from "@/components/Icon";
import { Badge, Kpi, PageHead } from "@/components/shell/AppShell";
import { listOffices } from "@/server/commerce/offices";
import { getIndustry } from "@/server/agency/industries";
import { planOf } from "@/server/agency/plans";
import { selectOfficeAction } from "../../commerce_actions";

export const metadata = { title: "Mi oficina" };
const ESTADO: Record<string, ["ok" | "warn" | "bad", string]> = { activa: ["ok", "Activa"], pausada: ["warn", "Pausada"], cancelada: ["bad", "Cancelada"] };
export default async function Panel({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const id = agency.agencyId;
  const ag = await getAgency(db, agency); const m = await agencyMetrics(db, agency); const ob = await getOnboarding(db, agency); const scene = await agencyScene(db, agency);
  const offices = await listOffices(db, agency.userId);
  const depts = await db.query("SELECT d.name, count(e.id)::int n FROM employees e JOIN departments d ON d.id=e.department_id JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 GROUP BY d.name ORDER BY n DESC, d.name LIMIT 6", [id]);
  const real = m.clients.filter((c: any) => !c.is_demo); const employees = m.clients.reduce((n: number, c: any) => n + c.employees, 0);
  const recent = await db.query("SELECT t.id,t.title,t.status,t.created_at,e.name en,c.name cn FROM tasks t JOIN employees e ON e.id=t.employee_id JOIN companies c ON c.id=t.company_id WHERE c.agency_id=$1 ORDER BY t.created_at DESC LIMIT 5", [id]);
  const ai = !!getProvider();
  return (<><PageHead title="Mi oficina" sub={`${ag.name}: aquí empieza todo. ¿Qué quieres hacer hoy?`}>
      <Link className="btn" href="/oficinas/nueva" data-testid="head-nueva"><Icon name="plus" size={18} />Nueva oficina IA</Link><Link className="btn ghost" href="/oficinas" data-testid="head-mis"><Icon name="layers" size={18} />Mis oficinas</Link></PageHead>
    <div className="actions" data-testid="office-buttons" style={{ marginBottom: 14 }}><BigAction href="/oficinas/nueva" icon={<Icon name="plusbox" size={22} />} title="NUEVA OFICINA IA" text="Crea otra oficina para otro negocio." testId="panel-nueva-oficina" /><BigAction href="/oficinas" icon={<Icon name="layers" size={22} />} title="MIS OFICINAS" text="Mira todas tus oficinas y entra a cualquiera." testId="panel-mis-oficinas" /></div>
    {sp.ok && <Toast message={sp.ok} />}<Flash sp={{ error: sp.error }} />
    {!ob.done && <div className="hero-card" data-testid="resume-wizard"><h2>Vamos a configurar tu oficina</h2><p>Te faltan unos pasos para dejarla lista (vas en el paso {ob.step} de {STEPS.length}: {STEPS[ob.step - 1]}).</p><Link className="btn big" href={`/empezar?paso=${ob.step}`}>Continuar donde lo dejé</Link></div>}
    {m.pendingApprovals > 0 && <div className="hero-card" style={{ borderColor: "var(--warn)" }}><h2>Tienes {m.pendingApprovals} cosa(s) esperando tu permiso</h2><p>Tus empleados no hacen cambios importantes sin que tú digas que sí.</p><Link className="btn big" href="/agencia/soporte">Revisar ahora</Link></div>}
    <div className="kpis" data-testid="kpis"><Kpi icon="layers" value={offices.length} label="Oficinas" /><Kpi icon="users" value={employees} label="Empleados IA en esta oficina" /><Kpi icon="shield" value={m.pendingApprovals} label="Por aprobar" /><Kpi icon="check" value={m.tasksByStatus.completed ?? 0} label="Trabajos listos" /></div>
    <div className="panel-grid">
      <div className="card" data-testid="panel-oficinas"><div className="panel-title"><h2>Mis oficinas</h2><Link href="/oficinas">Administrar</Link></div>
        {offices.map((o) => { const [tone, label] = ESTADO[o.status] ?? ["warn", o.status]; return (<div className="office-row" key={o.id}><span className="icon-box" style={{ width: 42, height: 42 }}><Icon name="building" size={20} /></span><span className="grow"><b>{o.name}{o.id === id ? " (actual)" : ""}</b><small>{getIndustry(o.business_type)?.name ?? "Negocio sin definir"} · Plan {planOf(o.plan).label} · {o.employees} empleado(s)</small></span><Badge tone={tone}>{label}</Badge>{o.id !== id && <form action={selectOfficeAction} className="inline"><input type="hidden" name="officeId" value={o.id} /><button className="ghost" style={{ minHeight: 38 }}>Entrar</button></form>}</div>); })}</div>
      <div className="card" data-testid="panel-departamentos"><div className="panel-title"><h2>Empleados por departamento</h2></div>{depts.length ? depts.map((d: any) => <div className="dept" key={d.name}><span>{d.name}</span><Badge>{d.n} empleado(s)</Badge></div>) : <EmptyState icon="" title="Aún no hay empleados" text="Contrata el primero y aparecerá aquí, en su departamento." href="/agencia/contratar" cta="Agregar empleado" />}</div></div>
    <h2 style={{ margin: "28px 0 12px" }}>Acciones rápidas</h2>
    <div className="actions" data-testid="quick-actions">
      <BigAction href="/agencia/contratar" icon={<Icon name="users" size={22} />} title="Agregar empleado" text="Elige quién te ayuda y para qué." testId="qa-empleado" />
      <BigAction href="/agencia/skills" icon={<Icon name="template" size={22} />} title="Enseñar a mi empleado" text="Cuéntale cómo quieres que trabaje." />
      <BigAction href="/agencia/tarea" icon={<Icon name="check" size={22} />} title="Crear tarea" text="Pídele un trabajo a un empleado." testId="qa-tarea" />
      <BigAction href="/agencia/oficina-3d" icon={<Icon name="building" size={22} />} title="Ver mi oficina" text="Mira a todos tus empleados en un mapa." />
      <BigAction href="/agencia/clientes" icon={<Icon name="briefcase" size={22} />} title="Agregar cliente" text="Cada cliente tiene su propia oficina." testId="qa-cliente" />
      <BigAction href="/agencia/propuestas" icon={<Icon name="receipt" size={22} />} title="Preparar propuesta" text="Arma una oferta con tus servicios." />
      <BigAction href="/celular" icon={<Icon name="mail" size={22} />} title="Conectar WhatsApp" text="Habla con tus empleados desde el celular." />
      <BigAction href="/agencia/asistente" icon={<Icon name="sparkle" size={22} />} title="Pedir ayuda al asistente" text="Cuéntame qué quieres vender." testId="qa-asistente" /></div>
    {!ai && <Tip icon="i">Tus empleados todavía no pueden trabajar de verdad: falta activar la inteligencia artificial en esta instalación. Mientras tanto puedes practicar con ejemplos inventados en <Link href="/empezar?paso=6">la prueba guiada</Link>.</Tip>}
    <div className="grid" style={{ marginTop: 16 }}>
      <div className="card"><h2>Trabajo reciente</h2>{recent.length ? <table><tbody>{recent.map((t) => <tr key={t.id}><td>{t.title}<div className="muted">{t.en} · {t.cn} · {when(t.created_at)}</div></td><td><StatusChip s={t.status} /></td></tr>)}</tbody></table> : <EmptyState icon="" title="Aún no hay trabajo" text="Cuando pidas la primera tarea, aquí verás cómo va." href="/agencia/tarea" cta="Crear tarea" />}</div>
      <div className="card o3d-card"><div style={{ height: 150 }}><IsoSvg scene={scene} showLabels={false} label="Mapa de tu oficina" /></div><div><h2>Tu oficina</h2><p className="muted">{scene.stats.employees ? `${scene.stats.employees} empleado(s) en ${scene.stats.zones} oficina(s).` : "Contrata a tu primer empleado y aparecerá aquí."}</p><Link className="btn" href="/agencia/oficina-3d">Ver mi oficina</Link></div></div>
      <div className="card"><h2>Consumo de inteligencia artificial</h2><p>Este mes: <b>{money(m.spend)}</b> de {money(Number(m.budget))} permitidos.</p><div style={{ background: "var(--chip)", borderRadius: 4 }}><div className="bar" style={{ width: `${Math.min(100, (m.spend / m.budget) * 100)}%` }} /></div><p className="muted">Es una estimación. Al llegar al tope, tus empleados dejan de trabajar hasta el mes siguiente.</p></div></div></>);
}
