import Link from "next/link";
import { loginAction } from "../actions";
import { Flash } from "@/lib/ui";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Entrar</h1><Flash sp={sp} />
    <form action={loginAction} className="card"><label htmlFor="e">Correo</label><input id="e" name="email" type="email" required autoComplete="email" />
      <label htmlFor="p">Contraseña</label><input id="p" name="password" type="password" required autoComplete="current-password" />
      <p><button>Entrar</button></p></form>
    <p className="muted">¿Primera vez? <Link href="/registro">Crea tu oficina</Link></p></div>);
}
