import Link from "next/link";
import { agencySignupAction } from "../agency_actions";
import { Flash, Help } from "@/lib/ui";
import { Attribution } from "@/features/funnel/tracking/attribution";
import { isPlanKey } from "@/server/agency/plans";
export const metadata = { title: "Crea tu negocio — Crea tu Oficina IA" };
export default async function Registro({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string }> }) {
  const sp = await searchParams;
  if (process.env.PUBLIC_SIGNUP !== "true") return (<div className="auth"><h1>El registro directo está cerrado</h1><p className="lead">Tu cuenta se crea <b>sola al comprar</b>: pagas, recibes un correo con tu acceso y listo. No necesitas registrarte antes.</p><p><Link className="btn big" href="/">Ver la oferta</Link></p><p className="muted">¿Ya compraste? <Link href="/recuperar">Recupera tu acceso</Link>.</p></div>);
  return (<div className="auth"><h1>Vamos a crear tu negocio</h1><p className="lead">Son 4 datos y listo. Después te guiamos paso a paso. No necesitas tarjeta ni saber de tecnología.</p><Flash sp={sp} />
    <form action={agencySignupAction} className="card"><Attribution track="visita" />{sp.plan && isPlanKey(sp.plan) && <input type="hidden" name="plan" value={sp.plan} />}
      <label htmlFor="a">¿Cómo se llamará tu negocio?</label><Help>Puedes cambiarlo después.</Help><input id="a" name="agencyName" required autoFocus />
      <label htmlFor="n">Tu nombre</label><input id="n" name="name" required autoComplete="name" />
      <label htmlFor="e">Tu correo</label><Help>Con él entrarás cada vez.</Help><input id="e" name="email" type="email" required autoComplete="email" inputMode="email" />
      <label htmlFor="p">Elige una contraseña</label><Help>Al menos 10 letras o números.</Help><input id="p" name="password" type="password" minLength={10} required autoComplete="new-password" />
      <p className="muted" style={{ fontSize: ".85rem" }}>Al crear tu cuenta aceptas la <a href="/privacidad">política de privacidad</a>.</p>
      <p><button className="big" data-testid="signup">Crear mi negocio</button></p></form>
    <p className="muted">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></p></div>);
}
