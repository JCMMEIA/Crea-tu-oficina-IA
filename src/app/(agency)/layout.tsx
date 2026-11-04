import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { logoutAction } from "../actions";
import { ThemeToggle } from "@/lib/theme";
import { GuideHost, MenuButton } from "@/lib/guide";
import { getAgency } from "@/server/agency";
import { roleLabel } from "@/lib/lang";

export const dynamic = "force-dynamic";
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { db, agency } = await requireAgency();
  const ag = await getAgency(db, agency);
  const color = /^#[0-9a-fA-F]{6}$/.test(ag.brand?.primaryColor ?? "") ? ag.brand.primaryColor : null;
  const logo = typeof ag.brand?.logo === "string" ? ag.brand.logo : null;
  const st = (await db.query("SELECT status, billing_status FROM agencies WHERE id=$1", [agency.agencyId]))[0] ?? { status: "activa", billing_status: "" };
  const pending = Number((await db.query("SELECT count(*) n FROM approvals ap JOIN companies c ON c.id=ap.company_id WHERE c.agency_id=$1 AND ap.status='pending'", [agency.agencyId]))[0].n);
  return (
    <div className="shell" style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <nav className="side closed" id="side-nav" aria-label="Menú principal">
        <div className="logo">{logo ? <img src={logo} alt="" style={{ height: 28, verticalAlign: "middle", marginRight: 6 }} /> : "🏛️ "}{ag.name}</div>
        <MenuButton />
        <Link href="/oficinas/nueva" data-testid="nav-nueva-oficina"><b>➕ NUEVA OFICINA IA</b></Link>
        <Link href="/oficinas" data-testid="nav-mis-oficinas"><b>🗂️ MIS OFICINAS</b></Link>
        <small>Mi negocio</small>
        <Link href="/agencia">🏠 Mi oficina</Link>
        <Link href="/agencia/activacion">🚀 Activa tu agencia</Link>
        <Link href="/agencia/clientes">👥 Mis clientes</Link>
        <Link href="/agencia/contratar">➕ Agregar empleado</Link>
        <Link href="/agencia/skills">🎓 Lo que saben mis empleados</Link>
        <Link href="/agencia/servicios">🛍️ Qué ofrezco</Link>
        <Link href="/agencia/propuestas">📄 Preparar propuesta</Link>
        <small>Mirar y conectar</small>
        <Link href="/agencia/oficina-3d">🏢 Ver mi oficina</Link>
        <Link href="/agencia/conexiones">🔌 Conecta tus aplicaciones</Link>
        <Link href="/celular">📱 Mi oficina en el celular</Link>
        <small>Cuidar el negocio</small>
        <Link href="/agencia/soporte">✋ Por aprobar{pending ? ` (${pending})` : ""}</Link>
        <Link href="/agencia/identidad">🎨 Mi marca</Link>
        <Link href="/agencia/plan">💳 Mi plan</Link>
        <Link href="/ayuda">❓ Ayuda</Link>
        <ThemeToggle />
        <form action={logoutAction}><button className="ghost" style={{ margin: "0 10px" }}>Salir ({roleLabel(agency.agencyRole)})</button></form>
      </nav>
      <main>{st.status !== "activa" && <div className="tip" role="alert" data-testid="office-banner" style={{ marginBottom: 12 }}>{st.status === "pausada" ? "⏸️ Esta oficina está pausada: sus empleados no trabajan y el cobro está detenido." : "⛔ Esta oficina está cancelada: sus empleados ya no trabajan. Tus datos se conservan."} <Link href="/oficinas">Ir a Mis oficinas</Link></div>}{st.status === "activa" && st.billing_status === "pago_pendiente" && <div className="tip" role="alert" data-testid="billing-banner" style={{ marginBottom: 12 }}>⚠️ No pudimos cobrar tu última mensualidad. <Link href="/oficinas">Actualiza tu forma de pago</Link> para evitar que se detenga el servicio.</div>}{children}</main>
      <div className="bottom-bar" aria-label="Accesos rápidos">
        <Link href="/agencia"><span className="ic" aria-hidden="true">🏠</span>Mi oficina</Link><Link href="/agencia/clientes"><span className="ic" aria-hidden="true">👥</span>Clientes</Link>
        <Link href="/agencia/contratar"><span className="ic" aria-hidden="true">➕</span>Empleado</Link><Link href="/agencia/soporte"><span className="ic" aria-hidden="true">✋</span>Por aprobar</Link>
      </div>
      <GuideHost />
    </div>
  );
}
