import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/session";
export default async function Home() {
  const { actor } = await currentActor();
  if (actor) redirect("/oficina");
  return (<div className="auth"><h1>Crea tu Oficina IA</h1>
    <p>Construye tu empresa con empleados de inteligencia artificial que trabajan bajo tu supervisión: tú apruebas lo importante.</p>
    <p className="row"><Link className="btn" href="/registro">Crear mi oficina</Link><Link className="btn ghost" href="/login">Entrar</Link></p></div>);
}
