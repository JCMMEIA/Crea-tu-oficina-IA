"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { TAREAS } from "../config/tareas";
import { DocBody, type Quien } from "./TasksExplorer";
import { Estatus, SectionHead } from "./ui";

const VISTAS: { key: string; tab: string }[] = [{ key: "anuncios-3-variantes", tab: "Anuncios" }, { key: "contenido-semanal", tab: "Plan de contenido" }, { key: "guion-video-corto", tab: "Guion de video" }, { key: "respuesta-prospecto", tab: "Respuesta de ventas" }, { key: "propuesta-comercial", tab: "Propuesta a un cliente" }, { key: "queja-resena", tab: "Atención al cliente" }];
/** Galería de documentos de EJEMPLO (escritos por nosotros, rotulados). No se muestran imágenes ni creatividades: la plataforma hoy entrega texto y documentos. */
export function ResultsSection({ quien }: { quien: Record<string, Quien> }) {
  const [i, setI] = useState(0); const t = TAREAS.find((x) => x.key === VISTAS[i].key)!; const q = quien[t.empleadoKey];
  return (<section className="lp-section" id="resultados" aria-labelledby="res-t"><div className="lp-wrap">
    <SectionHead id="res-t" eyebrow="Resultados" titulo="Documentos listos para revisar, editar y descargar" lead="Cada tarea termina en un documento con estructura clara. Estos son ejemplos del tipo de resultado que entrega cada una." />
    <div className="fx-results"><div><div className="fx-tabs vertical" role="tablist" aria-label="Ejemplos de resultados">{VISTAS.map((v, n) => <button type="button" role="tab" key={v.key} aria-selected={n === i} aria-controls="res-panel" className={`fx-tab${n === i ? " on" : ""}`} onClick={() => setI(n)} data-testid={`res-tab-${v.key}`}>{v.tab}</button>)}</div>
      <ul className="fx-checks compact"><li><span className="fx-ck"><Icon name="check" size={14} /></span><div><b>Se guarda</b><span>Por oficina, ligado a la tarea que lo creó.</span></div></li><li><span className="fx-ck"><Icon name="check" size={14} /></span><div><b>Se edita</b><span>Tu texto no pisa el original de la IA.</span></div></li><li><span className="fx-ck"><Icon name="check" size={14} /></span><div><b>Se descarga</b><span>En Markdown o en HTML listo para imprimir.</span></div></li></ul>
      <p className="fx-small"><Estatus de="resultados" /> Guardado, edición y descarga. Hoy entregamos texto y documentos; no generamos imágenes ni creatividades gráficas.</p></div>
    <div id="res-panel" role="tabpanel"><article className="fx-sheet" data-testid="res-doc"><header><div><span className="fx-ribbon">Ejemplo ilustrativo · escrito por nosotros, no generado por IA</span><h3>{t.ejemplo.salida.titulo}</h3><p className="muted">Preparado por {q?.nombre} · {q?.puesto}</p></div><span className="fx-dl" aria-hidden="true"><Icon name="receipt" size={16} />.md · .html</span></header>
      <div className="fx-notice"><Icon name="shield" size={14} />Propuesta: no se publicó ni se envió nada. Revísala antes de usarla.</div><DocBody bloques={t.ejemplo.salida.bloques} /></article></div></div></div></section>);
}
