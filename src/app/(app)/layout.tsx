import Link from "next/link";
import { requireActor } from "@/lib/session";
import { leaveClientAction } from "../agency_actions";
import { logoutAction } from "../actions";
import { ThemeToggle } from "@/lib/theme";
import { GuideHost, MenuButton, DoneToast } from "@/lib/guide";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, actor, agency } = await requireActor();
  const co = (await db.query("SELECT c.name, a.name agency_name, a.brand FROM companies c JOIN agencies a ON a.id=c.agency_id WHERE c.id=$1", [actor.companyId]))[0];
  const done = (await db.query("SELECT t.id,t.title,e.name who FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 AND t.status='completed' AND t.finished_at > now() - interval '6 hours' ORDER BY t.finished_at DESC LIMIT 1", [actor.companyId]))[0];
  const color = /^#[0-9a-fA-F]{6}$/.test(co.brand?.primaryColor ?? "") ? co.brand.primaryColor : null;
  const logo = typeof co.brand?.logo === "string" ? co.brand.logo : null;
  const pending = Number((await db.query("SELECT count(*) n FROM approvals WHERE company_id=$1 AND status='pending'", [actor.companyId]))[0].n);
  return (
    <div className="shell" style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}>
      <nav className="side closed" id="side-nav" aria-label="Menú principal">
        <div className="logo">{logo ? <img src={logo} alt="" style={{ height: 28, verticalAlign: "middle", marginRight: 6 }} /> : "🏢 "}{co.name}<div className="muted" style={{ fontWeight: 400 }}>{co.agency_name}</div></div>
        <MenuButton />
        {agency && <form action={leaveClientAction}><button className="ghost" style={{ margin: "0 10px 8px", width: "calc(100% - 20px)" }}>← Volver a mi agencia</button></form>}
        <form action="/buscar" style={{ padding: "0 4px 8px" }}><input name="q" placeholder="🔍 Buscar…" aria-label="Buscar" /></form>
        <small>Mi oficina</small>
        <Link href="/oficina">🏠 Mi oficina</Link>
        <Link href="/departamentos">🧑‍💼 Mis empleados</Link>
        <Link href="/agregar-empleado">➕ Agregar empleado</Link>
        <Link href="/oficina-3d">🏢 Ver mi oficina</Link>
        <small>Trabajo</small>
        <Link href="/aprobaciones">✋ Por aprobar{pending ? ` (${pending})` : ""}</Link>
        <Link href="/actividad">📋 Historial de trabajo</Link>
        <Link href="/automatizaciones">🔁 Tareas automáticas</Link>
        <small>Preparar</small>
        <Link href="/conexiones">🔌 Conecta tus aplicaciones</Link>
        <Link href="/conocimiento">📚 Lo que debe saber mi negocio</Link>
        <Link href="/celular">📱 Mi oficina en el celular</Link>
        <Link href="/ayuda">❓ Ayuda</Link>
        <ThemeToggle />
        <form action={logoutAction}><button className="ghost" style={{ margin: "0 10px" }}>Salir</button></form>
      </nav>
      <main>{children}</main>
      <div className="bottom-bar" aria-label="Accesos rápidos">
        <Link href="/oficina"><span className="ic" aria-hidden="true">🏠</span>Mi oficina</Link><Link href="/departamentos"><span className="ic" aria-hidden="true">🧑‍💼</span>Empleados</Link>
        <Link href="/aprobaciones"><span className="ic" aria-hidden="true">✋</span>Por aprobar</Link><Link href="/actividad"><span className="ic" aria-hidden="true">📋</span>Historial</Link>
      </div>
      <GuideHost />{done && <DoneToast id={done.id} title={done.title} who={done.who} />}
    </div>
  );
}
