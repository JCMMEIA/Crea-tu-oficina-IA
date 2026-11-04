"use client";
import { useState } from "react";
import { CtaLink } from "../tracking/attribution";
import { Icon } from "@/components/Icon";

export interface Emp { key: string; nombre: string; puesto: string; especialidad: string; linea: string; dep: string; foto: boolean }
const HUE: Record<string, number> = { marketing: 268, ventas: 212, operaciones: 186, finanzas: 150, rrhh: 322, direccion: 36, atencion: 246 };
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const PAGE = 12;
/** Filtro por departamento + «Ver más» (accesible por teclado). Todos son «configurables»: conectado y listo para ejecutar dependen de la cuenta de cada cliente. */
export function EmployeeExplorer({ emps, deps, total }: { emps: Emp[]; deps: { key: string; nombre: string; n: number }[]; total: number }) {
  const [dep, setDep] = useState("todos"); const [all, setAll] = useState(false);
  const list = dep === "todos" ? emps : emps.filter((e) => e.dep === dep); const shown = all ? list : list.slice(0, PAGE);
  const pick = (k: string) => { setDep(k); setAll(false); };
  return (<div>
    <div className="fx-tabs wrap" role="group" aria-label="Filtrar por departamento"><button type="button" className={`fx-tab${dep === "todos" ? " on" : ""}`} aria-pressed={dep === "todos"} onClick={() => pick("todos")} data-testid="dep-todos">Todos <small>{total}</small></button>
      {deps.map((d) => <button type="button" key={d.key} className={`fx-tab${dep === d.key ? " on" : ""}`} aria-pressed={dep === d.key} onClick={() => pick(d.key)} data-testid={`dep-${d.key}`}>{d.nombre} <small>{d.n}</small></button>)}</div>
    <ul className={`fx-emps${all ? " all" : ""}`} aria-live="polite" data-testid="emp-lista">{shown.map((e) => <li key={e.key} className="fx-emp" data-testid={`emp-${e.key}`} style={{ ["--h" as string]: HUE[e.dep] ?? 260 }}>
      <div className="fx-emp-top">{e.foto ? <img className="fx-av img" src={`/employees/${e.key}.webp`} width={64} height={64} alt={`Retrato ilustrativo de ${e.nombre}, empleado IA`} loading="lazy" /> : <span className="fx-av" role="img" aria-label={`Iniciales de ${e.nombre}`}>{initials(e.nombre)}</span>}
        <div><h3>{e.nombre}</h3><p className="fx-puesto">{e.puesto}</p></div></div>
      <p className="fx-esp"><b>Especialidad:</b> {e.especialidad}</p><p className="fx-linea">{e.linea}</p>
      <div className="fx-emp-foot"><span className="fx-status s-config" title="Se contrata y se configura. Conectado y listo para ejecutar dependen de tu cuenta.">Configurable</span><CtaLink href={`/panel-demo/empleados/${e.key}`} cta="empleado-conocer" className="fx-more" testId={`conocer-${e.key}`}>Conocer empleado <Icon name="arrow" size={14} /></CtaLink></div></li>)}</ul>
    {list.length > PAGE && <p className="lp-center"><button type="button" className="btn ghost" onClick={() => setAll((v) => !v)} aria-expanded={all} data-testid="emp-vermas">{all ? "Ver menos" : `Ver los ${list.length} de ${dep === "todos" ? "todos los departamentos" : deps.find((d) => d.key === dep)?.nombre}`}</button></p>}
    <div className="fx-legend" role="note"><b>Cómo leer los estados.</b> <span className="fx-status s-config">Configurable</span> el puesto se contrata y se configura en tu oficina (hoy, todos). <span className="fx-status s-conectado">Conectado</span> sus aplicaciones obligatorias están conectadas. <span className="fx-status s-listo">Listo para ejecutar</span> además, la IA de tu oficina está verificada. Los dos últimos dependen de tu cuenta y te los mostramos tal como están. Los retratos son ilustraciones de personas ficticias: son empleados de IA, no personas.</div></div>);
}
