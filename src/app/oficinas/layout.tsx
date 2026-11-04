import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logoutAction } from "../actions";
export const metadata = { title: "Mis oficinas IA", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function OficinasLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (<div className="land" style={{ maxWidth: 1000 }}><header><b>🏛️ Crea tu Oficina IA</b><span className="row"><Link href="/ayuda/tutoriales">Ayuda</Link><span className="muted">{user.email}</span><form action={logoutAction} className="inline"><button className="ghost">Salir</button></form></span></header>{children}</div>);
}
