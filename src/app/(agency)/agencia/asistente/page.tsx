import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { assist } from "@/server/guide/assistant";
import { getTemplate } from "@/server/catalog/data";
import { assistantHireAction } from "../../../agency_actions";

export const metadata = { title: "Asistente guiado" };
const EXAMPLES = ["Quiero vender servicios de marketing a restaurantes", "Quiero contestar mensajes de clientes", "Quiero revisar el inventario de una tienda", "Quiero agregar un cliente"];
export default async function Asistente({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; await requireAgency(); const q = (sp.q ?? "").slice(0, 300); const r = q ? assist(q) : null;
  return (<><h1>Asistente guiado</h1><p className="lead">Cuéntame qué quieres ofrecer y te recomiendo a quién contratar. Yo propongo; tú decides.</p><Flash sp={sp} />
    <div className="notice" data-testid="assistant-note">🤖 {r?.note ?? "Soy un asistente guiado con reglas sencillas (no es inteligencia artificial). Cuando la conectes, podré entender más cosas."}</div>
    <div className="chat" aria-live="polite">
      <div className="bubble">¡Hola! ¿Qué quieres ofrecer a otras empresas? Escríbelo o toca un ejemplo.</div>
      {q && <div className="bubble me" data-testid="user-msg">{q}</div>}
      {r && <div className="bubble" data-testid="assistant-reply"><p>{r.text}</p>
        {r.employees.length > 0 && <ul>{r.employees.map((k) => <li key={k}><b>{getTemplate(k)?.name ?? k}</b></li>)}</ul>}
        <div className="row">{r.suggestions.map((s, i) => s.href ? <Link key={i} className="btn" href={s.href}>{s.label}</Link> : s.hire ? <form key={i} action={assistantHireAction}>{s.hire.map((k) => <input key={k} type="hidden" name="empleado" value={k} />)}<button className={i === 0 ? "big" : "ghost"} data-testid={i === 0 ? "assistant-hire" : undefined}>{i === 0 ? "✅ " : ""}{s.label}</button></form> : null)}</div>
        {r.employees.length > 0 && <p className="muted">Se agregarán a tu oficina de práctica. Nada cambia hasta que pulses el botón.</p>}</div>}
    </div>
    <form method="get" className="card"><label htmlFor="q">Tu mensaje</label><input id="q" name="q" defaultValue={q} placeholder="Ejemplo: Quiero vender servicios de marketing a restaurantes" data-testid="assistant-input" autoFocus />
      <p className="row"><button className="big" data-testid="assistant-send">Enviar</button></p></form>
    <h3>Prueba con un ejemplo</h3><div className="row">{EXAMPLES.map((e) => <Link key={e} className="chip" style={{ fontSize: "1rem", padding: "8px 14px" }} href={`/agencia/asistente?q=${encodeURIComponent(e)}`}>{e}</Link>)}</div></>);
}
