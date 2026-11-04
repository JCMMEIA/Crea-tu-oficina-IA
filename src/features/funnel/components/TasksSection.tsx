import { identityFor } from "@/features/employees/catalog";
import { TAREAS } from "../config/tareas";
import { Estatus, SectionHead } from "./ui";
import { TasksExplorer, type Quien } from "./TasksExplorer";

export function TasksSection() {
  const quien: Record<string, Quien> = {}; for (const t of TAREAS) { const i = identityFor(t.empleadoKey); quien[t.empleadoKey] = { nombre: i?.nombre ?? t.empleadoKey, puesto: i?.puesto ?? "" }; }
  return (<section className="lp-section" id="tareas" aria-labelledby="tareas-t"><div className="lp-wrap">
    <SectionHead id="tareas-t" eyebrow="Tareas listas para realizar" titulo="Elige un trabajo y contesta unas preguntas" lead="Ocho tareas guiadas de marketing, ventas y atención al cliente. Las preguntas vienen prellenadas con los datos de tu Cerebro Empresarial y tú las corriges. Explora una ahora: es una demostración, sin IA y sin pagar." />
    <p className="lp-center" style={{ margin: "-6px 0 26px" }}><Estatus de="tareasGuiadas" /> <span className="fx-small">Estas ocho tareas están en revisión; no es un catálogo de cientos: son las que podemos respaldar hoy.</span></p>
    <TasksExplorer quien={quien} /></div></section>);
}
