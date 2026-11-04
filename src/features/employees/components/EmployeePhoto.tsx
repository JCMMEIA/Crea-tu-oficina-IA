import fs from "node:fs";
import path from "node:path";
import { initials } from "../catalog";

const exists = (key: string) => { try { return fs.existsSync(path.join(process.cwd(), "public", "employees", `${key}.webp`)); } catch { return false; } };
/** Retrato: foto del cliente (si la subió) → retrato del catálogo (si el archivo existe) → monograma. Nunca una imagen rota. */
export function EmployeePhoto({ name, templateKey, custom, size = 64 }: { name: string; templateKey?: string | null; custom?: string | null; size?: number }) {
  const src = custom || (templateKey && exists(templateKey) ? `/employees/${templateKey}.webp` : null);
  const st = { width: size, height: size };
  return src
    ? <img className="emp-photo" style={st} src={src} width={size} height={size} loading="lazy" decoding="async" alt={`Retrato ilustrativo de ${name}, empleado IA`} />
    : <span className="emp-photo emp-mono" style={{ ...st, fontSize: size * 0.36 }} role="img" aria-label={`Iniciales de ${name}`}>{initials(name)}</span>;
}
export const AiTag = () => <span className="emp-tag" title="Es un empleado de inteligencia artificial; la imagen es una ilustración, no una persona real.">Empleado IA · imagen ilustrativa</span>;
