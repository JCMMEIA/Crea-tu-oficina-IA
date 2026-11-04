"use client";
import { useRef, useState } from "react";
import { CtaLink } from "../tracking/attribution";
import { Icon } from "@/components/Icon";
import { AREAS, TAREAS, type Area, type Bloque } from "../config/tareas";
import { Estatus } from "./ui";

export interface Quien { nombre: string; puesto: string }
export function DocBody({ bloques }: { bloques: Bloque[] }) {
  return <>{bloques.map((b, i) => <div key={i} className="fx-doc-b">{b.h && <h5>{b.h}</h5>}{b.p && <p>{b.p}</p>}{b.li && <ul>{b.li.map((l) => <li key={l}>{l}</li>)}</ul>}</div>)}</>;
}
const DESDE_PERFIL = ["A quién", "Objetivo", "Productos"];
/** Catálogo de 8 tareas + demostración SIN IA y sin pagar: el visitante recorre preguntas y ve un EJEMPLO escrito por nosotros. */
export function TasksExplorer({ quien }: { quien: Record<string, Quien> }) {
  const [area, setArea] = useState<Area | "todas">("todas"); const [sel, setSel] = useState(TAREAS[0].key); const [ver, setVer] = useState(false); const panel = useRef<HTMLDivElement>(null);
  const list = area === "todas" ? TAREAS : TAREAS.filter((t) => t.area === area); const t = TAREAS.find((x) => x.key === sel)!; const q = quien[t.empleadoKey];
  const elegir = (k: string) => { setSel(k); setVer(false); if (window.matchMedia("(max-width: 900px)").matches) panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  return (<div className="fx-tasks">
    <div><div className="fx-tabs wrap" role="group" aria-label="Filtrar tareas por área"><button type="button" className={`fx-tab${area === "todas" ? " on" : ""}`} aria-pressed={area === "todas"} onClick={() => setArea("todas")}>Todas <small>{TAREAS.length}</small></button>{AREAS.map((a) => <button type="button" key={a.key} className={`fx-tab${area === a.key ? " on" : ""}`} aria-pressed={area === a.key} onClick={() => setArea(a.key)}>{a.label} <small>{TAREAS.filter((x) => x.area === a.key).length}</small></button>)}</div>
      <ul className="fx-tlist">{list.map((x) => <li key={x.key}><button type="button" className={`fx-tcard${x.key === sel ? " on" : ""}`} aria-pressed={x.key === sel} onClick={() => elegir(x.key)} data-testid={`tarea-${x.key}`}>
        <span className="fx-tarea">{AREAS.find((a) => a.key === x.area)?.label} · {quien[x.empleadoKey]?.nombre}</span><b>{x.titulo}</b><span className="fx-tprob">{x.problema}</span></button></li>)}</ul></div>
    <div className="fx-tpanel" ref={panel} tabIndex={-1} aria-live="polite" data-testid="tarea-panel">
      <div className="fx-tpanel-head"><div><span className="fx-tarea">{AREAS.find((a) => a.key === t.area)?.label}</span><h3>{t.titulo}</h3><p className="muted">Con <b>{q?.nombre}</b> · {q?.puesto}</p></div><Estatus de="tareasGuiadas" /></div>
      <div className="fx-demo-banner" role="note"><Icon name="play" size={15} /><span><b>Demostración sin IA y sin costo.</b> El ejemplo lo escribimos nosotros con un negocio inventado; no lo generó una IA.</span></div>
      <h4>1 · Qué te pregunta</h4><ul className="fx-fields">{t.ejemplo.entradas.map(([l, v]) => <li key={l}><span>{l}{DESDE_PERFIL.some((d) => l.startsWith(d)) && <em>prellenado desde tu Cerebro</em>}</span><div>{v}</div></li>)}</ul>
      <p className="fx-small">Pregunta además: {t.pide.join(" · ")}.</p>
      <h4>2 · Qué entrega</h4><p>{t.entrega}</p>
      {!ver ? <button type="button" className="btn" onClick={() => setVer(true)} data-testid="ver-ejemplo">Ver ejemplo de resultado</button> :
        <article className="fx-doc" data-testid="ejemplo-resultado"><header><span className="fx-ribbon">Ejemplo ilustrativo · no generado por IA</span><h4>{t.ejemplo.salida.titulo}</h4></header><DocBody bloques={t.ejemplo.salida.bloques} /><footer>Es una propuesta: no se publica ni se envía nada. Tú la revisas, la editas y la descargas.</footer></article>}
      <p className="fx-small">Formato de salida: {t.formato}.</p>
      <CtaLink href="#planes" cta="tarea-explorada" className="btn ghost">Quiero usar estas tareas <Icon name="arrow" size={15} /></CtaLink></div></div>);
}
