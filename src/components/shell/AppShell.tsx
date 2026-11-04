import Link from "next/link";
import { NavLink } from "./NavLink";
import { Icon, IconName, BrandMark } from "@/components/Icon";

export interface NavItem { href: string; label: string; icon: IconName; testId?: string; cta?: "primary" | "alt" }
export interface NavSection { title?: string; items: NavItem[] }
/**
 * Estructura ÚNICA del panel: la usan el panel real (con datos reales) y la demostración (con datos de ejemplo). Así lo que se ve en la demo es el panel de verdad.
 * `active` marca la página actual (aria-current) para lectores de pantalla y resalte visual.
 */
export function AppShell({ logoUrl, brandName, brandSub, sections, banner, children, navExtras, footerSlot, bottomBar }: {
  logoUrl?: string | null; brandName: string; brandSub?: string; sections: NavSection[]; banner?: React.ReactNode; children: React.ReactNode; navExtras?: React.ReactNode; footerSlot?: React.ReactNode; bottomBar?: NavItem[];
}) {
  return (<div className="shell">
    <nav className="side closed" id="side-nav" aria-label="Menú principal">
      <div className="logo">{logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" width={38} height={38} style={{ borderRadius: 10, objectFit: "contain", background: "rgba(255,255,255,.06)" }} /> : <BrandMark size={38} />}<span>{brandName}{brandSub && <small>{brandSub}</small>}</span></div>
      {navExtras}
      {sections.map((s, i) => (<div key={i} style={{ display: "contents" }}>{s.title && <small>{s.title}</small>}
        {s.items.map((it) => <NavLink key={it.href} href={it.href} testId={it.testId} className={it.cta ? `nav-cta${it.cta === "alt" ? " alt" : ""}` : undefined}><Icon name={it.icon} size={19} />{it.label}</NavLink>)}</div>))}
      <div className="spacer" />{footerSlot}
    </nav>
    <main id="contenido">{banner}{children}</main>
    {bottomBar && <div className="bottom-bar" aria-label="Accesos rápidos">{bottomBar.map((b) => <Link key={b.href} href={b.href}><Icon name={b.icon} size={22} />{b.label}</Link>)}</div>}
  </div>);
}
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (<div className="pg-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</div>);
}
export function Kpi({ icon, value, label, note, testId }: { icon: IconName; value: React.ReactNode; label: string; note?: string; testId?: string }) {
  return (<div className="card kpi" data-testid={testId}><span className="icon-box"><Icon name={icon} size={20} /></span><b>{value}</b><span>{label}</span>{note && <span style={{ fontSize: ".75rem" }}>{note}</span>}</div>);
}
export function Badge({ tone, children }: { tone?: "ok" | "warn" | "bad" | "demo"; children: React.ReactNode }) { return <span className={`badge${tone ? " " + tone : ""}`}>{children}</span>; }
