import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell, Badge, Kpi, PageHead, NavSection } from "@/components/shell/AppShell";
import { Icon, IconName } from "@/components/Icon";
import { MenuButton } from "@/lib/guide";
import { DemoNewOffice } from "@/components/shell/DemoNewOffice";
import { DEMO_AUTOMATIONS, DEMO_OFFICES, DEMO_VIEWS, DemoSlug, demoDepartments, demoEmployees } from "@/lib/demo_data";
import { INDUSTRIES } from "@/server/agency/industries";
import { SERVICE_CARDS, employeesForServices, industryDefaults } from "@/server/guide/services";
import { EMPLOYEES, getDepartment } from "@/server/catalog/data";
import { formatPrice, planOf, planPriceInfo } from "@/server/agency/plans";
import { offerPlan } from "@/server/commerce/gate";

export const dynamicParams = false;
export function generateStaticParams() { return DEMO_VIEWS.map((v) => ({ vista: v.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ vista: string }> }): Promise<Metadata> {
  const { vista } = await params; const v = DEMO_VIEWS.find((x) => x.slug === vista);
  return { title: v ? `Demostración — ${v.label}` : "Demostración", description: "Recorre el panel de Crea tu Oficina IA con datos de ejemplo, sin registro ni pago.", robots: { index: false } };
}
const EJ = <Badge tone="demo">Ejemplo</Badge>;
const ESTADO = (s: string) => s === "activa" ? <Badge tone="ok">Activa</Badge> : <Badge tone="warn">Pausada</Badge>;
const Off = ({ children, why = "En la demostración este botón no hace cambios." }: { children: React.ReactNode; why?: string }) => <button type="button" className="ghost" aria-disabled="true" title={why} onClick={undefined} style={{ minHeight: 38 }}>{children}</button>;

export default async function Vista({ params }: { params: Promise<{ vista: string }> }) {
  const slug = (await params).vista as DemoSlug; const view = DEMO_VIEWS.find((v) => v.slug === slug); if (!view) notFound();
  const price = formatPrice(planPriceInfo(offerPlan())); const plan = planOf(offerPlan());
  const emps = demoEmployees(); const depts = demoDepartments(); const totalEmp = DEMO_OFFICES.reduce((n, o) => n + o.employees, 0);
  const sections: NavSection[] = [{ title: "Panel", items: DEMO_VIEWS.map((v) => ({ href: `/panel-demo/${v.slug}`, label: v.label, icon: v.icon as IconName })) }];
  const banner = (<div className="demo-banner" role="note" data-testid="demo-banner"><Icon name="sparkle" size={18} /><span><b>Demostración con datos de ejemplo.</b> No se ejecutan tareas ni se cobra. <Link href="/#oferta">Crear mi oficina IA</Link></span></div>);
  return (<AppShell brandName="Crea tu Oficina IA" brandSub="Demostración" sections={sections} banner={banner}
    navExtras={<><MenuButton /><NavCtas /></>} footerSlot={<Link href="/"><Icon name="logout" size={19} />Volver al sitio</Link>}
    bottomBar={[{ href: "/panel-demo/inicio", label: "Inicio", icon: "home" }, { href: "/panel-demo/mis-oficinas", label: "Oficinas", icon: "layers" }, { href: "/panel-demo/empleados", label: "Empleados", icon: "users" }, { href: "/panel-demo/facturacion", label: "Plan", icon: "receipt" }]}>
    {slug === "inicio" && (<><PageHead title="Hola, así se ve tu panel" sub="Estado de tus oficinas IA en un vistazo."><Link className="btn" href="/panel-demo/nueva-oficina"><Icon name="plus" size={18} />Nueva oficina IA</Link><Link className="btn ghost" href="/panel-demo/mis-oficinas"><Icon name="layers" size={18} />Mis oficinas</Link></PageHead>
      <div className="kpis" data-testid="demo-kpis"><Kpi icon="layers" value={DEMO_OFFICES.length} label="Oficinas" note="Ejemplo" /><Kpi icon="check" value={DEMO_OFFICES.filter((o) => o.status === "activa").length} label="Oficinas activas" note="Ejemplo" /><Kpi icon="users" value={totalEmp} label="Empleados IA" note="Ejemplo" /><Kpi icon="briefcase" value={depts.length} label="Departamentos" note="Del catálogo real" /></div>
      <div className="panel-grid"><div className="card"><div className="panel-title"><h2>Mis oficinas</h2><Link href="/panel-demo/mis-oficinas">Ver todas</Link></div>
        {DEMO_OFFICES.map((o) => <div className="office-row" key={o.id}><span className="icon-box" style={{ width: 42, height: 42 }}><Icon name={o.id === "ej-1" ? "megaphone" : o.id === "ej-2" ? "users" : "building"} size={20} /></span><span className="grow"><b>{o.name}</b><small>{o.business} · {o.employees} empleados</small></span>{ESTADO(o.status)}<Off>Configurar</Off></div>)}</div>
        <div className="card"><div className="panel-title"><h2>Empleados por departamento</h2>{EJ}</div>{depts.slice(0, 5).map((d) => <div className="dept" key={d.key}><span>{d.name}</span><Badge>{d.count} puestos</Badge></div>)}<p className="muted" style={{ fontSize: ".82rem" }}>Los departamentos y puestos son los del catálogo real; las cantidades por oficina son de ejemplo.</p></div></div></>)}
    {slug === "nueva-oficina" && (<><PageHead title="Nueva oficina IA" sub="Elige negocio, plantilla y empleados. Verás el precio antes de confirmar."><Link className="btn ghost" href="/panel-demo/mis-oficinas">Mis oficinas</Link></PageHead>
      <DemoNewOffice price={`${price}`} industries={INDUSTRIES.map((i) => ({ key: i.key, name: i.name, services: industryDefaults(i.key) }))}
        services={SERVICE_CARDS.map((s) => ({ id: s.id, title: s.title, plain: s.plain, employees: employeesForServices([s.id]).map((e) => ({ key: e.key, name: e.name, department: getDepartment(EMPLOYEES.find((t) => t.key === e.key)!.department)?.name ?? "" })) }))} /></>)}
    {slug === "mis-oficinas" && (<><PageHead title="Mis oficinas" sub="Cada oficina tiene sus propios datos, plan y suscripción."><Link className="btn" href="/panel-demo/nueva-oficina"><Icon name="plus" size={18} />Nueva oficina IA</Link></PageHead>
      <div className="grid" data-testid="demo-oficinas">{DEMO_OFFICES.map((o) => <div className="card" key={o.id}><div className="row" style={{ justifyContent: "space-between" }}><h3>{o.name}</h3>{ESTADO(o.status)}</div><p className="muted">{o.business} · Plan {o.plan} · {o.employees} empleado(s)</p><div className="row"><Off why="En la demostración no se puede entrar a oficinas.">Entrar</Off><Off>{o.status === "activa" ? "Pausar" : "Reanudar"}</Off><Off>Cancelar al final del periodo</Off></div></div>)}</div>
      <p className="muted" style={{ marginTop: 16 }}>Pausar o cancelar una oficina no afecta a las demás. Tus datos nunca se borran.</p></>)}
    {slug === "empleados" && (<><PageHead title="Empleados IA" sub="Los puestos que puedes contratar. Cada uno explica qué hace."><Link className="btn ghost" href="/panel-demo/departamentos">Ver departamentos</Link></PageHead>
      <div className="lp-grid c3" data-testid="demo-empleados">{emps.map((e) => <div className="card" key={e.key}><div className="row" style={{ justifyContent: "space-between" }}><b>{e.name}</b><Badge>Puesto del catálogo</Badge></div><p className="muted" style={{ fontSize: ".88rem" }}>{e.que}</p><Badge>{e.department}</Badge></div>)}</div>
      <div className="tip" role="note" style={{ marginTop: 16 }}><Icon name="shield" size={18} /><span>Un empleado empieza a trabajar cuando tu oficina tiene la IA activa y conectas tus aplicaciones. Antes de publicar, enviar o gastar, siempre te pide permiso.</span></div></>)}
    {slug === "departamentos" && (<><PageHead title="Departamentos" sub="Tu equipo se organiza por área. Se crean solos al contratar."/>
      <div className="lp-grid c3" data-testid="demo-departamentos">{depts.map((d) => <div className="card" key={d.key}><div className="row" style={{ justifyContent: "space-between" }}><h3>{d.name}</h3><Badge>{d.count} puestos</Badge></div><p className="muted" style={{ fontSize: ".86rem" }}>{EMPLOYEES.filter((e) => e.department === d.key).slice(0, 3).map((e) => e.name).join(", ")}…</p></div>)}</div></>)}
    {slug === "automatizaciones" && (<><PageHead title="Automatizaciones" sub="Tareas que se repiten solas, con tus límites y tu aprobación.">{EJ}</PageHead>
      <div className="card" data-testid="demo-auto">{DEMO_AUTOMATIONS.map((a) => <div className="office-row" key={a.name}><span className="icon-box" style={{ width: 42, height: 42 }}><Icon name="workflow" size={20} /></span><span className="grow"><b>{a.name}</b><small>{a.who} · {a.every}</small></span>{ESTADO(a.status)}<Off>Editar</Off></div>)}</div>
      <p className="muted" style={{ marginTop: 16 }}>Las automatizaciones respetan el tope mensual de uso de IA de cada oficina. Estos ejemplos no se ejecutan.</p></>)}
    {slug === "configuracion" && (<><PageHead title="Configuración" sub="Nombre, marca, límites y permisos de cada oficina.">{EJ}</PageHead>
      <div className="panel-grid"><div className="card"><h2>Datos de la oficina</h2><label htmlFor="c1">Nombre</label><input id="c1" value="Tienda en línea (ejemplo)" disabled readOnly /><label htmlFor="c2">Tipo de negocio</label><input id="c2" value="Comercio electrónico" disabled readOnly /><label htmlFor="c3">Color de marca</label><input id="c3" value="#7c4dff" disabled readOnly /><p><Off>Guardar cambios</Off></p></div>
        <div className="card"><h2>Límites y permisos</h2><div className="dept"><span>Tope mensual de uso de IA</span><Badge>Propio por oficina</Badge></div><div className="dept"><span>Aprobación antes de publicar o enviar</span><Badge tone="ok">Siempre</Badge></div><div className="dept"><span>Clientes</span><Badge>Hasta {plan.maxClients}</Badge></div><div className="dept"><span>Empleados IA</span><Badge>Hasta {plan.maxEmployees}</Badge></div></div></div></>)}
    {slug === "facturacion" && (<><PageHead title="Facturación" sub="Cada oficina tiene su propia suscripción."/>
      <div className="panel-grid"><div className="card"><h2>Plan {plan.label}</h2><p style={{ fontSize: "1.6rem", margin: "8px 0" }}><b>{price}</b></p><p className="muted">Hasta {plan.maxClients} clientes y {plan.maxEmployees} empleados IA. Pago seguro con Stripe; cancelas al final del periodo.</p><div className="row"><Off>Pagos y comprobantes</Off><Off>Cancelar al final del periodo</Off></div></div>
        <div className="card"><h2>Comprobantes</h2><div className="empty-state"><p>Aquí verás los comprobantes de cada cobro de tu suscripción.</p></div><p className="muted" style={{ fontSize: ".82rem" }}>En la demostración no hay cobros ni comprobantes.</p></div></div></>)}
  </AppShell>);
}
function NavCtas() { return (<><Link href="/panel-demo/nueva-oficina" className="nav-cta"><Icon name="plus" size={19} />Nueva oficina IA</Link><Link href="/panel-demo/mis-oficinas" className="nav-cta alt"><Icon name="layers" size={19} />Mis oficinas</Link></>); }
