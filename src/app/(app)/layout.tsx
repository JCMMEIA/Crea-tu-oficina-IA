import Link from "next/link";
import { requireActor } from "@/lib/session";
import { leaveClientAction } from "../agency_actions";
import { logoutAction } from "../actions";
import { ThemeToggle } from "@/lib/theme";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, actor, agency } = await requireActor();
  const co = (await db.query("SELECT c.name, a.name agency_name, a.brand FROM companies c JOIN agencies a ON a.id=c.agency_id WHERE c.id=$1", [actor.companyId]))[0];
  const color = /^#[0-9a-fA-F]{6}$/.test(co.brand?.primaryColor ?? "") ? co.brand.primaryColor : null;
  const logo = typeof co.brand?.logo === "string" ? co.brand.logo : null;
  const pending = Number((await db.query("SELECT count(*) n FROM approvals WHERE company_id=$1 AND status='pending'", [actor.companyId]))[0].n);
  return (
    <div className="shell" style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <nav className="side" aria-label="Navegación principal">
        <div className="logo">{logo ? <img src={logo} alt="" style={{ height: 28, verticalAlign: "middle", marginRight: 6 }} /> : "🏢 "}{co.name}<div className="muted" style={{ fontWeight: 400 }}>{co.agency_name}</div></div>
        {agency && <form action={leaveClientAction}><button className="ghost" style={{ margin: "0 10px 8px", width: "calc(100% - 20px)" }}>← Volver a la agencia</button></form>}
        <form action="/buscar" style={{ padding: "0 4px 8px" }}><input name="q" placeholder="Buscar…" aria-label="Buscador global" /></form>
        <small>Dirección</small>
        <Link href="/oficina">Panel de dirección</Link>
        <Link href="/aprobaciones">Aprobaciones{pending ? ` (${pending})` : ""}</Link>
        <Link href="/actividad">Actividad</Link>
        <small>Mi oficina</small>
        <Link href="/construir">Construye tu oficina</Link>
        <Link href="/departamentos">Mis departamentos</Link>
        <Link href="/organigrama">Organigrama</Link>
        <small>Configuración</small>
        <Link href="/conexiones">Conecta tu empresa</Link>
        <Link href="/conocimiento">Conocimiento</Link>
        <Link href="/automatizaciones">Automatizaciones</Link>
        <Link href="/ayuda">Ayuda y tutorial</Link>
        <ThemeToggle />
        <form action={logoutAction}><button className="ghost" style={{ margin: "0 10px" }}>Salir ({actor.role})</button></form>
      </nav>
      <main>{children}</main>
    </div>
  );
}
