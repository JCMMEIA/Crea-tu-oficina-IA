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
  const pending = Number((await db.query("SELECT count(*) n FROM approvals ap JOIN companies c ON c.id=ap.company_id WHERE c.agency_id=$1 AND ap.status='pending'", [agency.agencyId]))[0].n);
  return (
    <div className="shell" style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <nav className="side closed" id="side-nav" aria-label="Menú principal">
        <div className="logo">{logo ? <img src={logo} alt="" style={{ height: 28, verticalAlign: "middle", marginRight: 6 }} /> : "🏛️ "}{ag.name}</div>
        <MenuButton />
        <small>Mi negocio</small>
        <Link href="/agencia">🏠 Mi oficina</Link>
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
        <Link href="/ayuda">❓ Ayuda</Link>
        <ThemeToggle />
        <form action={logoutAction}><button className="ghost" style={{ margin: "0 10px" }}>Salir ({roleLabel(agency.agencyRole)})</button></form>
      </nav>
      <main>{children}</main>
      <div className="bottom-bar" aria-label="Accesos rápidos">
        <Link href="/agencia"><span className="ic" aria-hidden="true">🏠</span>Mi oficina</Link><Link href="/agencia/clientes"><span className="ic" aria-hidden="true">👥</span>Clientes</Link>
        <Link href="/agencia/contratar"><span className="ic" aria-hidden="true">➕</span>Empleado</Link><Link href="/agencia/soporte"><span className="ic" aria-hidden="true">✋</span>Por aprobar</Link>
      </div>
      <GuideHost />
    </div>
  );
}
