import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell, Badge, NavSection } from "@/components/shell/AppShell";
import { Icon, IconName } from "@/components/Icon";
import { DEMO_VIEWS } from "@/lib/demo_data";
import { EMPLOYEES } from "@/server/catalog/data";
import { profileFor } from "@/features/employees/catalog";
import { EmployeeProfile } from "@/features/employees/components/EmployeeProfile";
import { ReadinessStepper } from "@/features/employees/components/ReadinessStepper";
import { readiness } from "@/features/employees/readiness";

export const dynamicParams = false;
export const generateStaticParams = () => EMPLOYEES.map((e) => ({ key: e.key }));
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> { const p = profileFor((await params).key); return { title: p ? `Demostración — ${p.nombre}` : "Demostración", robots: { index: false } }; }
export default async function FichaDemo({ params }: { params: Promise<{ key: string }> }) {
  const p = profileFor((await params).key); if (!p) notFound();
  const sections: NavSection[] = [{ title: "Panel", items: DEMO_VIEWS.map((v) => ({ href: `/panel-demo/${v.slug}`, label: v.label, icon: v.icon as IconName })) }];
  const banner = (<div className="demo-banner" role="note"><Icon name="sparkle" size={18} /><span><b>Demostración con datos de ejemplo.</b> No se contrata ni se cobra nada. <Link href="/#oferta">Crear mi oficina IA</Link></span></div>);
  const r = readiness({ templateKey: p.key, status: "active", connected: new Set(), aiOk: null });
  return (<AppShell brandName="Crea tu Oficina IA" brandSub="Demostración" sections={sections} banner={banner} footerSlot={<Link href="/"><Icon name="logout" size={19} />Volver al sitio</Link>}>
    <p><Link href="/panel-demo/empleados">← Volver a empleados</Link></p>
    <EmployeeProfile p={p}><div className="card" style={{ marginTop: 16 }}><h2>Así se vería en tu oficina <Badge tone="demo">Ejemplo</Badge></h2><ReadinessStepper r={r} />
      <p className="muted">Estado de ejemplo recién contratado: configurado, sin aplicaciones conectadas y sin IA verificada, por eso aún no es operativo.</p></div></EmployeeProfile></AppShell>);
}
