import { Db } from "../db";
import { AgencyActor, assertAgencyCan, audit } from "../auth";
import { chooseServices, hireInDemo } from "../onboarding";
import { employeesForServices } from "../guide/services";

export interface ChecklistItem { id: string; title: string; why: string; done: boolean; href: string; cta: string; optional?: boolean }
/** Progreso de activación calculado desde la base (no es un contador que se marca a mano). */
export async function activationChecklist(db: Db, a: AgencyActor): Promise<{ items: ChecklistItem[]; done: number; total: number }> {
  assertAgencyCan(a, "agency:read");
  const n = async (sql: string) => Number((await db.query<{ n: string }>(sql, [a.agencyId]))[0].n);
  const ag = (await db.query("SELECT brand,plan,onboarding FROM agencies WHERE id=$1", [a.agencyId]))[0];
  const services = await n("SELECT count(*) n FROM agency_services WHERE agency_id=$1");
  const emps = await n("SELECT count(*) n FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1");
  const demoEmps = await n("SELECT count(*) n FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 AND c.is_demo");
  const tasks = await n("SELECT count(*) n FROM tasks t JOIN companies c ON c.id=t.company_id WHERE c.agency_id=$1 AND t.status='completed'");
  const clients = await n("SELECT count(*) n FROM companies WHERE agency_id=$1 AND NOT is_demo");
  const pend = await n("SELECT count(*) n FROM plan_requests WHERE agency_id=$1 AND status='solicitada'");
  const brand = ag.brand ?? {};
  const items: ChecklistItem[] = [
    { id: "marca", title: "Ponle tu marca", why: "Tus clientes verán tu nombre, color y logo.", done: !!(brand.tagline || brand.logo || brand.primaryColor), href: "/agencia/identidad", cta: "Abrir «Mi marca»" },
    { id: "servicios", title: "Elige qué servicios ofreces", why: "Define tu catálogo y los empleados sugeridos.", done: services > 0, href: "/empezar?paso=2", cta: "Elegir servicios" },
    { id: "empleados", title: "Contrata tus primeros empleados", why: "Son quienes hacen el trabajo.", done: emps > 0, href: "/agencia/contratar", cta: "Agregar empleado" },
    { id: "demo", title: "Prepara tu demostración", why: "Una oficina de ejemplo lista para mostrar a un cliente potencial.", done: demoEmps > 0, href: "/agencia/activacion#demo", cta: "Preparar demostración" },
    { id: "prueba", title: "Haz tu primera tarea", why: "Ve a un empleado trabajar (con la IA activada) o un ejemplo marcado como ilustrativo.", done: tasks > 0 || !!ag.onboarding?.done, href: "/empezar?paso=6", cta: "Hacer la prueba" },
    { id: "cliente", title: "Agrega tu primer cliente", why: "Cada cliente tiene su oficina separada.", done: clients > 0, href: "/agencia/clientes", cta: "Agregar cliente" },
    { id: "plan", title: "Elige tu plan", why: "Para tener más clientes y empleados. Hoy solo se puede solicitar: no hay cobro.", done: ag.plan !== "prueba" || pend > 0, href: "/agencia/plan", cta: "Ver planes", optional: true },
  ];
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

/** «Preparar demostración»: guarda los servicios elegidos y contrata sus empleados en la oficina de práctica. Idempotente; no crea clientes ni gasta IA. */
export async function prepareDemo(db: Db, a: AgencyActor, serviceIds: string[]) {
  assertAgencyCan(a, "agency:clients");
  const ids = await chooseServices(db, a, serviceIds);
  const keys = employeesForServices(ids).map((e) => e.key);
  const hired = await hireInDemo(db, a, keys);
  await audit(db, { userId: a.userId }, "activation.demo_prepared", a.agencyId, { services: ids.length, hired: hired.length });
  return { services: ids.length, hired: hired.length };
}
