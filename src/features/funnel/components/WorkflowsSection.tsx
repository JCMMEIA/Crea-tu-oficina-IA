"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { FLUJOS } from "../config/workflows";
import { Estatus, SectionHead } from "./ui";

/** Diagrama interactivo de colaboración entre empleados. ES UNA DEMOSTRACIÓN CONCEPTUAL («Próximamente»): no existen recetas predefinidas todavía. */
export function WorkflowsSection() {
  const [f, setF] = useState(0); const [p, setP] = useState(0); const flujo = FLUJOS[f]; const paso = flujo.pasos[Math.min(p, flujo.pasos.length - 1)];
  const go = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") setP((x) => Math.min(x + 1, flujo.pasos.length - 1)); if (e.key === "ArrowLeft") setP((x) => Math.max(x - 1, 0)); };
  return (<section className="lp-section fx-alt" id="workflows" aria-labelledby="wf-t"><div className="lp-wrap">
    <SectionHead id="wf-t" eyebrow="Colaboración entre empleados" titulo="Varios departamentos, un mismo trabajo" lead="Así planeamos que colaboren tus empleados: cada uno entrega su parte al siguiente y la última palabra siempre es tuya." />
    <p className="lp-center"><Estatus de="workflows" /> <span className="fx-small">Demostración conceptual. Los workflows predefinidos todavía no existen.</span></p>
    <div className="fx-tabs" role="group" aria-label="Ejemplos de colaboración" style={{ justifyContent: "center" }}>{FLUJOS.map((x, i) => <button type="button" key={x.id} className={`fx-tab${i === f ? " on" : ""}`} aria-pressed={i === f} onClick={() => { setF(i); setP(0); }} data-testid={`flujo-${x.id}`}>{x.nombre}</button>)}</div>
    <ol className="fx-flow" aria-label={`Pasos de «${flujo.nombre}»`} onKeyDown={go}>{flujo.pasos.map((x, i) => <li key={x.id} className={i <= p ? "done" : ""}><button type="button" className={`fx-node${i === p ? " on" : ""}${x.humano ? " human" : ""}`} aria-current={i === p ? "step" : undefined} onClick={() => setP(i)} data-testid={`paso-${x.id}`}><span className="n">{i + 1}</span><b>{x.etapa}</b><small>{x.empleado}</small></button>{i < flujo.pasos.length - 1 && <span className="fx-arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>}</li>)}</ol>
    <div className="fx-flow-detail" aria-live="polite" data-testid="paso-detalle"><h3>{paso.etapa} · <span>{paso.empleado}</span></h3><div className="fx-io"><div><small>Recibe</small><p>{paso.entrada}</p></div><div><small>Entrega</small><p>{paso.salida}</p></div></div>
      {paso.humano && <p className="fx-small"><Icon name="shield" size={14} /> En esta etapa no avanza nada sin tu decisión.</p>}</div>
    <p className="lp-center fx-small">Hoy ya puedes pedirle trabajo a un empleado y, si lo necesita, delegar en otro con tu aprobación. Lo que viene es dejar estas cadenas armadas como recetas listas para usar.</p></div></section>);
}
