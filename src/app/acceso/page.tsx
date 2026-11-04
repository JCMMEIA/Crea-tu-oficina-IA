import Link from "next/link";
import { Flash } from "@/lib/ui";
import { consumeLinkAction } from "../commerce_actions";
export const metadata = { title: "Entrar — Crea tu Oficina IA", robots: { index: false } };
export const dynamic = "force-dynamic";
/** El enlace NO se canjea al abrirlo (los antivirus y las vistas previas de correo abren los enlaces): hay que pulsar el botón. */
export default async function Acceso({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Entrar a tu oficina IA</h1><Flash sp={{ error: sp.error }} />
    {sp.t ? <form action={consumeLinkAction} className="card"><input type="hidden" name="t" value={sp.t} /><p>Pulsa el botón para entrar. Este enlace vale una sola vez.</p><p><button className="big" data-testid="enter-link">Entrar a mi oficina</button></p></form>
      : <p>Abre el enlace que te enviamos por correo. <Link href="/recuperar">¿Perdiste el enlace?</Link></p>}
    <p className="muted">¿Caducó o ya lo usaste? <Link href="/recuperar">Pide uno nuevo</Link>.</p></div>);
}
