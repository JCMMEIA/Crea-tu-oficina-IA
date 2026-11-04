import Link from "next/link";
import type { Profile } from "../catalog";
import { AiTag, EmployeePhoto } from "./EmployeePhoto";

/** Tarjeta del directorio de talento: foto, nombre propio, puesto, una línea y acceso a la ficha. Las acciones (agregar) entran como hijos. */
export function EmployeeCard({ p, href, hired, children }: { p: Profile; href: string; hired?: boolean; children?: React.ReactNode }) {
  return (<article className="card emp-card" data-testid={`card-${p.key}`}>
    <Link href={href} className="emp-card-main" data-testid={`ficha-${p.key}`} aria-label={`Ver ficha de ${p.nombre}, ${p.puesto}`}>
      <EmployeePhoto name={p.nombre} templateKey={p.key} size={72} />
      <span className="emp-card-txt"><b>{p.nombre}</b><span className="emp-puesto">{p.puesto}</span><span className="emp-dep">{p.departamento.nombre}</span></span>
    </Link>
    <p className="emp-linea">{p.linea}</p>
    <p className="emp-esp"><b>Especialidad:</b> {p.especialidad}</p>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><AiTag />{hired && <span className="state ok">Ya tienes uno</span>}</div>
    <div className="emp-actions"><Link className="btn ghost" href={href}>Ver ficha</Link>{children}</div>
  </article>);
}
