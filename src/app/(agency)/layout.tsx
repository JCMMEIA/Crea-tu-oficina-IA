import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { logoutAction } from "../actions";
import { GuideHost, MenuButton } from "@/lib/guide";
import { getAgency } from "@/server/agency";
import { roleLabel } from "@/lib/lang";
import { AppShell, NavSection } from "@/components/shell/AppShell";
import { Icon } from "@/components/Icon";
import { NavLink } from "@/components/shell/NavLink";

export const dynamic = "force-dynamic";
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { db, agency } = await requireAgency();
  const ag = await getAgency(db, agency);
  const color = /^#[0-9a-fA-F]{6}$/.test(ag.brand?.primaryColor ?? "") ? ag.brand.primaryColor : null;
  const logo = typeof ag.brand?.logo === "string" ? ag.brand.logo : null;
  const st = (await db.query("SELECT status, billing_status FROM agencies WHERE id=$1", [agency.agencyId]))[0] ?? { status: "activa", billing_status: "" };
  const pending = Number((await db.query("SELECT count(*) n FROM approvals ap JOIN companies c ON c.id=ap.company_id WHERE c.agency_id=$1 AND ap.status='pending'", [agency.agencyId]))[0].n);
  const sections: NavSection[] = [
    { title: "Mi negocio", items: [{ href: "/agencia", label: "Mi oficina", icon: "home" }, { href: "/agencia/activacion", label: "Activa tu agencia", icon: "sparkle" }, { href: "/agencia/clientes", label: "Mis clientes", icon: "briefcase" }, { href: "/agencia/contratar", label: "Agregar empleado", icon: "users" }, { href: "/agencia/skills", label: "Lo que saben mis empleados", icon: "template" }, { href: "/agencia/servicios", label: "Qué ofrezco", icon: "grid" }, { href: "/agencia/propuestas", label: "Preparar propuesta", icon: "receipt" }] },
    { title: "Mirar y conectar", items: [{ href: "/agencia/oficina-3d", label: "Ver mi oficina", icon: "building" }, { href: "/agencia/conexiones", label: "Conecta tus aplicaciones", icon: "workflow" }, { href: "/celular", label: "Mi oficina en el celular", icon: "bell" }] },
    { title: "Cuidar el negocio", items: [{ href: "/agencia/soporte", label: `Por aprobar${pending ? ` (${pending})` : ""}`, icon: "shield" }, { href: "/agencia/identidad", label: "Mi marca", icon: "sparkle" }, { href: "/agencia/consumo", label: "Consumo de IA", icon: "receipt" }, { href: "/agencia/plan", label: "Mi plan", icon: "card" }, { href: "/ayuda", label: "Ayuda", icon: "help" }] },
  ];
  const banner = (<>{st.status !== "activa" && <div className="tip" role="alert" data-testid="office-banner" style={{ marginBottom: 12 }}><Icon name="pause" size={18} /><span>{st.status === "pausada" ? "Esta oficina está pausada: sus empleados no trabajan y el cobro está detenido." : "Esta oficina está cancelada: sus empleados ya no trabajan. Tus datos se conservan."} <Link href="/oficinas">Ir a Mis oficinas</Link></span></div>}
    {st.status === "activa" && st.billing_status === "pago_pendiente" && <div className="tip" role="alert" data-testid="billing-banner" style={{ marginBottom: 12 }}><Icon name="card" size={18} /><span>No pudimos cobrar tu última mensualidad. <Link href="/oficinas">Actualiza tu forma de pago</Link> para evitar que se detenga el servicio.</span></div>}</>);
  return (
    <div style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <AppShell logoUrl={logo} brandName={ag.name} brandSub="Panel de tu oficina" sections={sections} banner={banner}
        navExtras={<><MenuButton /><NavLink href="/oficinas/nueva" className="nav-cta" testId="nav-nueva-oficina"><Icon name="plus" size={19} />Nueva oficina IA</NavLink><NavLink href="/oficinas" className="nav-cta alt" testId="nav-mis-oficinas"><Icon name="layers" size={19} />Mis oficinas</NavLink></>}
        footerSlot={<form action={logoutAction}><button className="ghost"><Icon name="logout" size={18} />Salir ({roleLabel(agency.agencyRole)})</button></form>}
        bottomBar={[{ href: "/agencia", label: "Mi oficina", icon: "home" }, { href: "/agencia/clientes", label: "Clientes", icon: "briefcase" }, { href: "/agencia/contratar", label: "Empleado", icon: "users" }, { href: "/agencia/soporte", label: "Por aprobar", icon: "shield" }]}>
        {children}
      </AppShell>
      <GuideHost />
    </div>);
}
