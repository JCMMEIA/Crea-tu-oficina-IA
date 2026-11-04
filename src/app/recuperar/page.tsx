import Link from "next/link";
import { Flash } from "@/lib/ui";
import { recoverAction } from "../commerce_actions";
export const metadata = { title: "Recuperar acceso — Crea tu Oficina IA", robots: { index: false } };
export default async function Recuperar({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Recuperar mi acceso</h1><p className="lead">Escribe el correo con el que compraste. Si tiene una cuenta, te enviamos un enlace para entrar.</p>
    <Flash sp={{ ok: sp.ok ? "Si ese correo tiene una cuenta, te enviamos un enlace. Revisa tu bandeja (y «Spam»). Vale 30 minutos." : undefined }} />
    <form action={recoverAction} className="card"><label htmlFor="e">Tu correo</label><input id="e" name="email" type="email" required autoComplete="email" /><p><button className="big" data-testid="recover-submit">Enviarme el enlace</button></p></form>
    <p className="muted"><Link href="/">← Volver al inicio</Link> · <Link href="/login">Entrar con contraseña</Link></p></div>);
}
