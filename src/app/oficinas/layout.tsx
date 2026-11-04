import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logoutAction } from "../actions";
import { BrandMark } from "@/components/Icon";
import { isPlatformAdmin } from "@/server/commercial/admin";
export const metadata = { title: "Mis oficinas IA", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function OficinasLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (<div className="land" style={{ maxWidth: 1000 }}><header><Link href="/" className="lp-logo"><BrandMark size={36} />Crea tu Oficina IA</Link><span className="row"><Link href="/ayuda/tutoriales">Ayuda</Link>{isPlatformAdmin(user.email) && <Link href="/admin/conversion" data-testid="link-operador">Panel de operador</Link>}<span className="muted">{user.email}</span><form action={logoutAction} className="inline"><button className="ghost">Salir</button></form></span></header>{children}</div>);
}
