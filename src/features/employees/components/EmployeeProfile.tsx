import type { Profile } from "../catalog";
import { AiTag, EmployeePhoto } from "./EmployeePhoto";

/** Ficha detallada (catálogo): quién es, qué hace, con qué trabaja. Los botones de acción entran como hijos. */
export function EmployeeProfile({ p, children }: { p: Profile; children?: React.ReactNode }) {
  return (<div data-testid="ficha">
    <header className="emp-head"><EmployeePhoto name={p.nombre} templateKey={p.key} size={128} />
      <div><h1 style={{ margin: 0 }}>{p.nombre}</h1><p className="lead" style={{ margin: "4px 0" }}>{p.puesto} · {p.departamento.nombre}</p><p className="muted" style={{ margin: 0 }}>Especialidad: {p.especialidad}</p><p style={{ margin: "8px 0 0" }}><AiTag /></p></div></header>
    <p className="lead">{p.linea}</p>
    <div className="grid">
      <section className="card"><h2>Qué hace</h2><p>{p.descripcion}</p><p className="muted">{p.paraQue}</p></section>
      <section className="card"><h2>Responsabilidades</h2><ul>{p.responsabilidades.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className="card"><h2>Qué entrega</h2><ul>{p.entregables.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className="card"><h2>Habilidades y herramientas</h2><p><b>Habilidad base:</b> {p.habilidad}</p>
        {p.herramientas.length ? <ul>{p.herramientas.map((h) => <li key={h.toolkit}>{h.label} <span className="muted">({h.obligatoria ? "necesaria" : "opcional"})</span></li>)}</ul> : <p className="muted">No necesita aplicaciones conectadas.</p>}
        <p className="muted">Empieza en modo «mirar y proponer»: tú apruebas cada cambio. Una herramienta aparece aquí como disponible, no como conectada, hasta que tú la conectas.</p></section>
    </div>{children}</div>);
}
