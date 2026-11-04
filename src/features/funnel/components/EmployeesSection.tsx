import fs from "node:fs";
import path from "node:path";
import { departmentsWithProfiles } from "@/features/employees/catalog";
import { EmployeeExplorer, type Emp } from "./EmployeeExplorer";
import { SectionHead } from "./ui";

const hasPhoto = (k: string) => { try { return fs.existsSync(path.join(process.cwd(), "public", "employees", `${k}.webp`)); } catch { return false; } };
/** Directorio de los 41 empleados (única fuente: src/features/employees/catalog.ts). Retrato solo si existe el archivo; si no, monograma. */
export function EmployeesSection() {
  const deps = departmentsWithProfiles(); const total = deps.reduce((n, d) => n + d.perfiles.length, 0);
  const emps: Emp[] = deps.flatMap((d) => d.perfiles.map((p) => ({ key: p.key, nombre: p.nombre, puesto: p.puesto, especialidad: p.especialidad, linea: p.linea, dep: d.key, foto: hasPhoto(p.key) })));
  return (<section className="lp-section" id="empleados" aria-labelledby="emp-t"><div className="lp-wrap">
    <SectionHead id="emp-t" eyebrow="Tu equipo" titulo={`Conoce a tus empleados IA`} lead={`${total} puestos organizados por departamento. Cada uno tiene nombre, especialidad y un trabajo concreto. Elige a quienes necesitas; no tienes que contratarlos a todos.`} />
    <EmployeeExplorer emps={emps} deps={deps.map((d) => ({ key: d.key, nombre: d.nombre, n: d.perfiles.length }))} total={total} /></div></section>);
}
