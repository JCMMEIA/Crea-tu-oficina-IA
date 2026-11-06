import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash, Tip, EmptyState, Help } from "@/lib/ui";
import { listClients } from "@/server/agency";
import { agencyTaskAction } from "../../../agency_actions";
import { TaskForm, SubmitButton } from "@/components/Working";

export const metadata = { title: "Crear tarea" };
export default async function Tarea({ searchParams }: { searchParams: Promise<{ cliente?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const clients = await listClients(db, agency);
  const emps = await db.query("SELECT e.id,e.name,e.company_id FROM employees e JOIN companies c ON c.id=e.company_id WHERE c.agency_id=$1 AND e.status='active' ORDER BY e.created_at", [agency.agencyId]);
  return (<><h1>Crear tarea</h1><p className="lead">Elige a quién se la pides y cuéntale qué necesitas, con tus palabras.</p><Flash sp={sp} />
    {!emps.length ? <EmptyState icon="🧑‍💼" title="Todavía no tienes empleados" text="Contrata a tu primer empleado y después podrás pedirle trabajo." href="/agencia/contratar" cta="Agregar empleado" /> :
      <TaskForm action={agencyTaskAction} workerName="Tu empleado" className="card">
        <label htmlFor="t">¿Quién lo hará?</label><Help>Los empleados están ordenados por oficina.</Help>
        <select id="t" name="target" required data-testid="task-target" defaultValue={sp.cliente ? `${sp.cliente}:${emps.find((e) => e.company_id === sp.cliente)?.id ?? ""}` : undefined}>{clients.map((c: any) => { const mine = emps.filter((e) => e.company_id === c.id); return mine.length ? <optgroup key={c.id} label={c.is_demo ? "🧪 Oficina de práctica" : c.name}>{mine.map((e) => <option key={e.id} value={`${c.id}:${e.id}`}>{e.name}</option>)}</optgroup> : null; })}</select>
        <label htmlFor="i">¿Qué necesitas?</label><Help>Escríbelo como se lo dirías a una persona. Ejemplo: «Escribe 3 anuncios cortos para el desayuno del fin de semana».</Help>
        <textarea id="i" name="instruction" rows={4} required maxLength={2000} placeholder="Escribe aquí tu pedido…" data-testid="task-text" />
        <Tip>El empleado trabaja y te muestra el resultado. Si hace falta cambiar algo importante (publicar, enviar, gastar), primero te pide permiso.</Tip>
        <p><SubmitButton className="big" testId="task-send">Pedir tarea</SubmitButton></p></TaskForm>}
    <p className="muted">¿Solo quieres probar? <Link href="/empezar?paso=6">Haz una prueba con datos inventados</Link>.</p></>);
}
