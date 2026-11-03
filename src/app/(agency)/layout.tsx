import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { logoutAction } from "../actions";
import { ThemeToggle } from "@/lib/theme";
import { getAgency } from "@/server/agency";

export const dynamic = "force-dynamic";
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { db, agency } = await requireAgency();
  const ag = await getAgency(db, agency);
  const color = /^#[0-9a-fA-F]{6}$/.test(ag.brand?.primaryColor ?? "") ? ag.brand.primaryColor : null;
  const logo = typeof ag.brand?.logo === "string" ? ag.brand.logo : null;
  const pending = Number((await db.query("SELECT count(*) n FROM approvals ap JOIN companies c ON c.id=ap.company_id WHERE c.agency_id=$1 AND ap.status='pending'", [agency.agencyId]))[0].n);
  return (
    <div className="shell" style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <nav className="side" aria-label="Navegación de agencia">
        <div className="logo">{logo ? <img src={logo} alt="" style={{ height: 28, verticalAlign: "middle", marginRight: 6 }} /> : "🏛️ "}{ag.name}<div className="muted" style={{ fontWeight: 400 }}>{ag.specialty || "Agencia de IA"}</div></div>
        <small>Mi agencia</small>
        <Link href="/agencia">Panel de agencia</Link>
        <Link href="/agencia/clientes">Empresas clientes</Link>
        <Link href="/agencia/oficina-3d">Oficina 3D</Link>
        <Link href="/celular">📱 Mi oficina en el celular</Link>
        <Link href="/agencia/servicios">Catálogo de servicios</Link>
        <Link href="/agencia/skills">Skills y agentes</Link>
        <Link href="/agencia/propuestas">Propuestas</Link>
        <Link href="/agencia/soporte">Soporte y aprobaciones{pending ? ` (${pending})` : ""}</Link>
        <Link href="/agencia/identidad">Identidad visual</Link>
        <ThemeToggle />
        <form action={logoutAction}><button className="ghost" style={{ margin: "0 10px" }}>Salir ({agency.agencyRole.replace("agency_", "")})</button></form>
      </nav>
      <main>{children}</main>
    </div>
  );
}
