import Link from "next/link";
import { signupAction } from "../actions";
import { Flash } from "@/lib/ui";
export default async function Registro({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Crea tu oficina</h1><Flash sp={sp} />
    <form action={signupAction} className="card">
      <label htmlFor="c">Nombre de tu negocio</label><input id="c" name="companyName" required />
      <label htmlFor="n">Tu nombre</label><input id="n" name="name" required autoComplete="name" />
      <label htmlFor="e">Correo</label><input id="e" name="email" type="email" required autoComplete="email" />
      <label htmlFor="p">Contraseña (mínimo 10 caracteres)</label><input id="p" name="password" type="password" minLength={10} required autoComplete="new-password" />
      <p><button>Crear cuenta</button></p></form>
    <p className="muted">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></p></div>);
}
