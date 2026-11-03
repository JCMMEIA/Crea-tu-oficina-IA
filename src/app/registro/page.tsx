import Link from "next/link";
import { agencySignupAction } from "../agency_actions";
import { Flash } from "@/lib/ui";
export default async function Registro({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (<div className="auth"><h1>Crea tu agencia de IA</h1><p className="muted">Empieza con 2 clientes de prueba. Sin tarjeta: no hay cobros.</p><Flash sp={sp} />
    <form action={agencySignupAction} className="card">
      <label htmlFor="a">Nombre de tu agencia</label><input id="a" name="agencyName" required />
      <label htmlFor="s">Especialidad</label><input id="s" name="specialty" placeholder="Ej. Marketing con IA para tiendas online" />
      <label htmlFor="n">Tu nombre</label><input id="n" name="name" required autoComplete="name" />
      <label htmlFor="e">Correo</label><input id="e" name="email" type="email" required autoComplete="email" />
      <label htmlFor="p">Contraseña (mínimo 10 caracteres)</label><input id="p" name="password" type="password" minLength={10} required autoComplete="new-password" />
      <p><button>Crear mi agencia</button></p></form>
    <p className="muted">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></p></div>);
}
