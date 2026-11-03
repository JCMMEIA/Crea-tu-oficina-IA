import Link from "next/link";
import { currentActor } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { FAQ, TUTORIALS } from "@/server/guide/help";
import { supportAction } from "../../agency_actions";

export const metadata = { title: "Centro de ayuda — Crea tu Oficina IA", description: "Tutoriales, preguntas frecuentes y soporte para empezar con tu agencia." };
export const dynamic = "force-dynamic";
export default async function Tutoriales({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { agency, actor } = await currentActor();
  return (<div className="land" style={{ maxWidth: 860 }}><header><b>❓ Centro de ayuda</b><span className="row"><Link href="/ayuda">Guía rápida</Link><Link href={agency ? "/agencia" : actor ? "/oficina" : "/"}>← Volver</Link></span></header>
    <h1>Aprende paso a paso</h1><p className="sub">Tutoriales cortos, sin tecnicismos. Cada uno dice cuánto tarda.</p>
    <nav className="row" aria-label="Secciones"><a href="#tutoriales">Tutoriales</a><a href="#faq">Preguntas frecuentes</a><a href="#soporte">Hablar con una persona</a></nav>
    <section id="tutoriales" style={{ paddingBottom: 10 }}>{TUTORIALS.map((t) => <details className="card" key={t.id} id={t.id} data-testid={`tut-${t.id}`} style={{ marginBottom: 10 }}><summary><span aria-hidden="true">{t.icon}</span> {t.title} <span className="muted">· {t.minutes} min</span></summary>
      <p className="muted">{t.summary}</p><ol>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>{t.link && <p><Link className="btn ghost" href={t.link.href}>{t.link.label}</Link></p>}</details>)}
      <p>¿Prefieres que te lo mostremos? <Link href="/demo">Pide una demostración</Link>. Dentro de la aplicación, el botón <b>❓ Ayuda</b> abre la guía de cada pantalla.</p></section>
    <section id="faq" style={{ paddingTop: 10 }}><h2>Preguntas frecuentes</h2>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</section>
    <section id="soporte"><h2>Hablar con una persona</h2><Flash sp={sp} /><p className="muted">Escríbenos y te respondemos por correo. Todavía no tenemos chat en vivo ni respuestas automáticas.</p>
      <form action={supportAction} className="card"><div className="hp" aria-hidden="true"><label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label htmlFor="s-email">Tu correo</label><input id="s-email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="s-subject">Asunto</label><input id="s-subject" name="subject" required maxLength={140} />
        <label htmlFor="s-body">¿En qué te ayudamos?</label><textarea id="s-body" name="body" rows={4} required maxLength={2000} />
        <p><button className="big" data-testid="support-submit">Enviar mensaje</button></p></form></section></div>);
}
