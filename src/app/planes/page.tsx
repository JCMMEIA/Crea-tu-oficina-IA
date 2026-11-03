import Link from "next/link";
import { currentActor } from "@/lib/session";
import { Attribution, CtaLink } from "@/lib/attribution";
import { PLAN_BLURB, PLAN_ORDER, PLANS, planPriceInfo, formatPrice } from "@/server/agency/plans";
import { billingEnabled } from "@/server/commercial/billing";

export const metadata = { title: "Planes — Crea tu Oficina IA", description: "Los planes de Crea tu Oficina IA y lo que incluye cada uno." };
export const dynamic = "force-dynamic";
export default async function Planes() {
  const { actor, agency } = await currentActor(); const buy = billingEnabled();
  const cta = (k: string) => agency ? <Link className="btn" href={`/agencia/plan?plan=${k}`}>Elegir este plan</Link> : <CtaLink className="btn" href={`/registro?plan=${k}`} cta={`plan-${k}`}>Empezar con este plan</CtaLink>;
  void actor;
  return (<div className="land"><Attribution track="plan_visto" />
    <header><b>🏛️ Crea tu Oficina IA</b><span className="row"><Link href="/">Inicio</Link><Link href="/demo">Pedir demostración</Link></span></header>
    <h1>Planes</h1>
    <p className="sub">Un plan define cuántos clientes y empleados digitales puedes tener. {buy ? "" : <b>Todavía no se cobra: la compra aún no está abierta.</b>}</p>
    <div className="cols" style={{ marginTop: 18 }}>{PLAN_ORDER.map((k) => { const p = PLANS[k]; const pr = planPriceInfo(k); return (
      <div className="card" key={k} data-testid={`plan-${k}`}><h3>{p.label}</h3><p className="muted">{PLAN_BLURB[k]}</p>
        <p style={{ fontSize: "1.3rem", margin: "6px 0" }}><b>{k === "prueba" ? "Gratis" : formatPrice(pr)}</b></p>
        <ul><li>Hasta <b>{p.maxClients}</b> clientes</li><li>Hasta <b>{p.maxEmployees}</b> empleados digitales</li><li>Oficina 3D, aprobaciones y tu marca</li></ul>
        {k === "prueba" ? <CtaLink className="btn" href="/registro" cta="plan-prueba">Crear cuenta de prueba</CtaLink> : cta(k)}
        {k !== "prueba" && !buy && <p className="muted" style={{ fontSize: ".85rem" }}>Hoy solo puedes pedir que te avisemos: no se hace ningún cobro.</p>}</div>); })}</div>
    <section><h2>Lo que debes saber antes de contratar</h2><ul>
      <li><b>El uso de inteligencia artificial tiene un costo aparte</b> cuando se activa; puedes ponerle un tope mensual a cada cliente.</li>
      <li>No prometemos clientes ni ganancias: te damos la herramienta.</li>
      <li>Las condiciones de cancelación y renovación se publicarán aquí antes de abrir las ventas.</li>
      <li>Los precios, la forma de pago y los impuestos se publicarán aquí cuando abramos las ventas.</li></ul>
      <p><Link href="/ayuda/tutoriales#faq">Preguntas frecuentes</Link> · <Link href="/ayuda/tutoriales#soporte">Hablar con una persona</Link></p></section></div>);
}
