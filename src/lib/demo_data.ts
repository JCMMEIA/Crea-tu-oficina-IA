import { DEPARTMENTS, EMPLOYEES, getDepartment } from "@/server/catalog/data";
import { employeesForServices } from "@/server/guide/services";

/**
 * DATOS DE EJEMPLO de la demostración del panel. Todo está rotulado «Ejemplo»: no hay clientes, cifras de rendimiento ni resultados reales.
 * Los empleados y departamentos salen del catálogo REAL de la plataforma (sus nombres y descripciones son los verdaderos); las oficinas y automatizaciones son ilustrativas.
 */
export const DEMO_OFFICES = [
  { id: "ej-1", name: "Tienda (ejemplo)", business: "Comercio electrónico", status: "activa", plan: "Emprendedor", employees: 4, dept: 3 },
  { id: "ej-2", name: "Consultorio (ejemplo)", business: "Servicios locales", status: "activa", plan: "Emprendedor", employees: 3, dept: 2 },
  { id: "ej-3", name: "Inmobiliaria (ejemplo)", business: "Inmobiliarias", status: "pausada", plan: "Emprendedor", employees: 2, dept: 2 },
] as const;
export const DEMO_AUTOMATIONS = [
  { name: "Revisión de inventario", every: "cada 24 horas", who: "Controlador de inventario", status: "activa" },
  { name: "Resumen de pedidos en riesgo", every: "cada 12 horas", who: "Coordinador de pedidos", status: "activa" },
  { name: "Seguimiento de prospectos", every: "cada 6 horas", who: "Seguimiento de prospectos", status: "pausada" },
] as const;
export function demoEmployees() { return employeesForServices(["anuncios", "mensajes", "inventarios", "ventas", "contenido"]).slice(0, 9).map((p) => { const t = EMPLOYEES.find((e) => e.key === p.key)!; return { key: p.key, name: p.name, que: p.que, department: getDepartment(t.department)?.name ?? t.department }; }); }
export function demoDepartments() { return DEPARTMENTS.map((d) => ({ key: d.key, name: d.name, count: EMPLOYEES.filter((e) => e.department === d.key).length })).filter((d) => d.count > 0).slice(0, 8); }
export const DEMO_VIEWS = [
  { slug: "inicio", label: "Inicio", icon: "home", desc: "Resumen de tus oficinas, empleados y estados." },
  { slug: "nueva-oficina", label: "Nueva oficina IA", icon: "plusbox", desc: "Elige negocio, plantilla y empleados antes de confirmar." },
  { slug: "mis-oficinas", label: "Mis oficinas", icon: "layers", desc: "Entra, pausa o administra cada oficina por separado." },
  { slug: "empleados", label: "Empleados IA", icon: "users", desc: "Los puestos disponibles y qué hace cada uno." },
  { slug: "departamentos", label: "Departamentos", icon: "briefcase", desc: "Cómo se organiza tu equipo por área." },
  { slug: "automatizaciones", label: "Automatizaciones", icon: "workflow", desc: "Tareas que se repiten solas, con tus límites." },
  { slug: "configuracion", label: "Configuración", icon: "settings", desc: "Nombre, marca, límites de uso y permisos." },
  { slug: "facturacion", label: "Facturación", icon: "receipt", desc: "Plan, suscripción y comprobantes de cada oficina." },
] as const;
export type DemoSlug = (typeof DEMO_VIEWS)[number]["slug"];
