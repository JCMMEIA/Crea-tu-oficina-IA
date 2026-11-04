import Link from "next/link";
import { BrandMark } from "@/components/Icon";
import { Flash } from "@/lib/ui";
import { recoverAction } from "../commerce_actions";
export const metadata = { title: "Iniciar sesión — Crea tu Oficina IA", robots: { index: false } };
export default async function Recuperar({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><div className="auth-brand"><Link href="/" className="lp-logo"><BrandMark size={36} />Crea tu Oficina IA</Link></div><h1>Iniciar sesión</h1><p className="lead">Escribe el correo de tu cuenta y te enviamos un enlace seguro para entrar. No necesitas contraseña.</p>
    <Flash sp={{ ok: sp.ok ? "Si ese correo tiene una cuenta, te enviamos un enlace. Revisa tu bandeja (y «Spam»). Vale 30 minutos." : undefined }} />
    <form action={recoverAction} className="card"><label htmlFor="e">Tu correo</label><input id="e" name="email" type="email" required autoComplete="email" /><p><button className="big" data-testid="recover-submit">Enviarme el enlace de acceso</button></p></form>
    <p className="muted"><Link href="/">← Volver al inicio</Link> · <Link href="/login">Entrar con contraseña (cuentas antiguas)</Link></p></div>);
}
