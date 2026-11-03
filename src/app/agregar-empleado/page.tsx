import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash, Tip } from "@/lib/ui";
import { HireGallery } from "@/components/HireGallery";
import { hireAction } from "../actions";

export const metadata = { title: "Agregar empleado" };
export const dynamic = "force-dynamic";
export default async function AgregarEmpleado({ searchParams }: { searchParams: Promise<{ servicio?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const hired = new Set((await db.query("SELECT template_key FROM employees WHERE company_id=$1", [actor.companyId])).map((r) => r.template_key as string));
  const tab = sp.servicio ?? "anuncios";
  return (<div className="land" style={{ maxWidth: 1000, padding: 0 }}><h1>Agregar empleado</h1><p className="lead">Elige un trabajo y contrata a quien lo hace.</p><Flash sp={sp} />
    <Tip>Agregar un empleado no cuesta nada ni envía nada. Empieza a trabajar solo cuando tú le pidas una tarea.</Tip>
    <HireGallery basePath="/agregar-empleado" query="" hired={hired} action={hireAction} hidden={{ next: `/agregar-empleado?servicio=${tab}` }} tab={tab} />
    <p style={{ marginTop: 16 }}><Link className="btn" href="/oficina-3d">Ver mi oficina</Link> <Link className="btn ghost" href="/departamentos">Ver mis empleados</Link></p></div>);
}
