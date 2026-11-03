import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { activationChecklist } from "@/server/commercial/activation";
import { SERVICE_CARDS } from "@/server/guide/services";
import { prepareDemoAction } from "../../../agency_actions";

export const dynamic = "force-dynamic";
export default async function Activacion({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const c = await activationChecklist(db, agency);
  const pct = Math.round((c.done / c.total) * 100);
  return (<><h1>Activa tu agencia</h1><p className="lead">Siete pasos para dejar tu agencia lista para mostrar y vender. Se marcan solos cuando los haces.</p><Flash sp={sp} />
    <div className="card"><b data-testid="act-progress">{c.done} de {c.total} listos ({pct} %)</b><progress value={c.done} max={c.total} style={{ width: "100%" }} aria-label="Progreso" /></div>
    <ol style={{ padding: 0, listStyle: "none", marginTop: 12 }}>{c.items.map((i, n) => <li className="card" key={i.id} data-testid={`act-${i.id}`} data-done={i.done} style={{ marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "1.4rem" }} aria-hidden="true">{i.done ? "✅" : "⬜"}</span><div style={{ flex: 1, minWidth: 200 }}><b>{n + 1}. {i.title}</b>{i.optional && <span className="muted"> (opcional)</span>}<div className="muted">{i.why}</div></div>
      {i.done ? <span className="state ok">Listo</span> : <Link className="btn" href={i.href}>{i.cta}</Link>}</li>)}</ol>
    <div className="card" id="demo"><h2>🧪 Prepara tu primera demostración</h2><p className="muted">Elige qué quieres mostrar. Contratamos a los empleados correspondientes en tu oficina de práctica, que usa datos inventados y no gasta dinero.</p>
      <form action={prepareDemoAction}><div className="pick">{SERVICE_CARDS.map((s) => <label className="card" key={s.id}><input type="checkbox" name="servicio" value={s.id} data-testid={`demo-${s.id}`} /><span className="ic" aria-hidden="true">{s.icon}</span><b>{s.title}</b><span className="muted">{s.example}</span></label>)}</div>
        <p><button className="big" data-testid="prepare-demo">Preparar demostración</button></p></form>
      <p className="muted">Después: <Link href="/agencia/oficina-3d">mira la oficina</Link> y <Link href="/agencia/tarea">pide una tarea</Link>. Sin IA activada verás un ejemplo marcado como ilustrativo; dilo así cuando lo muestres.</p></div></>);
}
