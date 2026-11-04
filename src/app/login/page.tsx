import Link from "next/link";
import { loginAction } from "../actions";
import { Flash } from "@/lib/ui";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Entrar a mi negocio</h1><Flash sp={sp} />
    <form action={loginAction} className="card"><label htmlFor="e">Tu correo</label><input id="e" name="email" type="email" required autoComplete="email" />
      <label htmlFor="p">Contraseña</label><input id="p" name="password" type="password" required autoComplete="current-password" />
      <p><button className="big">Entrar</button></p></form>
    <p className="muted">¿Compraste y no tienes contraseña? <a href="/recuperar">Recibe tu enlace de acceso por correo</a>.</p>
    <p className="muted">¿Primera vez? <Link href="/">Mira la oferta</Link> (tu cuenta se crea al comprar)</p></div>);
}
