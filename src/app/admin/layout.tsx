import Link from "next/link";
import { requireOperator } from "@/lib/session";
export const metadata = { title: "Operación comercial", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { op } = await requireOperator();
  return (<div className="land" style={{ maxWidth: 1100 }}><header><b>📊 Operación comercial</b><span className="row"><Link href="/admin">Resumen</Link><Link href="/admin/conversion">Conversión</Link><Link href="/admin/ia">IA y modelos</Link><Link href="/admin/correos" data-testid="nav-correos">Correos</Link><Link href="/admin/prospectos">Prospectos</Link><Link href="/admin/agencias">Agencias y licencias</Link><Link href="/admin/soporte">Soporte</Link><span className="muted">{op.email}</span></span></header>{children}</div>);
}
