"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Laptop } from "./Laptop";
import { SectionHead } from "./ui";

const VISTAS = [
  { id: "inicio", label: "Inicio", src: "/landing/vista-inicio.webp", t: "Tu oficina de un vistazo", d: "Estado de tus oficinas, empleados y pendientes en una sola pantalla." },
  { id: "oficinas", label: "Mis oficinas", src: "/landing/vista-mis-oficinas.webp", t: "Varias oficinas, una cuenta", d: "Cada oficina con sus propios datos, empleados y consumo. Cambias de una a otra con un clic." },
  { id: "empleados", label: "Empleados", src: "/landing/vista-empleados.webp", t: "Tu equipo de IA", d: "Los puestos que puedes contratar, con lo que hace cada uno." },
  { id: "departamentos", label: "Departamentos", src: "/landing/vista-departamentos.webp", t: "Organizado por áreas", d: "Marketing, ventas, atención y más; se crean al contratar." },
  { id: "automatizaciones", label: "Automatizaciones", src: "/landing/vista-automatizaciones.webp", t: "Trabajo que se repite", d: "Programas tareas recurrentes y revisas cada resultado." },
];
/** Vista explorable del producto con capturas REALES del panel en modo demostración (datos de ejemplo). */
export function ProductDemo() {
  const [i, setI] = useState(0); const v = VISTAS[i];
  return (<section className="lp-section fx-alt" id="producto" aria-labelledby="producto-t"><div className="lp-wrap">
    <SectionHead id="producto-t" eyebrow="El producto" titulo="Mira tu oficina por dentro" lead="Estas son capturas reales del panel, con datos de ejemplo. Elige una vista, o recorre el panel completo sin registrarte." />
    <div className="fx-explore"><div className="fx-tabs" role="tablist" aria-label="Vistas del panel">{VISTAS.map((x, n) => <button key={x.id} role="tab" type="button" id={`pd-${x.id}`} aria-selected={n === i} aria-controls="pd-panel" className={`fx-tab${n === i ? " on" : ""}`} onClick={() => setI(n)} data-testid={`pd-tab-${x.id}`}>{x.label}</button>)}</div>
      <div id="pd-panel" role="tabpanel" aria-labelledby={`pd-${v.id}`} className="fx-explore-body"><div><h3>{v.t}</h3><p>{v.d}</p><Link className="btn ghost" href="/panel-demo/inicio" data-testid="ver-panel-2"><Icon name="play" size={15} />Recorrer el panel de demostración</Link></div>
        <Laptop src={v.src} alt={`Vista «${v.label}» del panel (datos de ejemplo)`} /></div></div></div></section>);
}
