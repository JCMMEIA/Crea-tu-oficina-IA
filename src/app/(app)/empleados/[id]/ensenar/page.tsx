import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { Flash, Tip } from "@/lib/ui";
import { TeachForm } from "@/components/TeachForm";
import { teachEmployeeAction } from "../../../../actions";

export const metadata = { title: "Enseña a tu empleado" };
export default async function Ensenar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, actor } = await requireActor();
  const e = (await db.query("SELECT name FROM employees WHERE id=$1 AND company_id=$2", [id, actor.companyId]))[0]; if (!e) notFound();
  return (<div className="land" style={{ maxWidth: 760, padding: 0 }}><p><Link href={`/empleados/${id}`}>← {e.name}</Link></p><h1>Enseña a {e.name}</h1>
    <p className="lead">Contesta con tus palabras. No tienes que saber nada de tecnología: nosotros lo convertimos en instrucciones.</p><Flash sp={sp} />
    <Tip>Puedes dejar preguntas en blanco. Siempre verás una vista previa antes de guardar.</Tip>
    <TeachForm action={teachEmployeeAction} hidden={{ id }} employeeName={e.name} />
    <p className="muted" style={{ marginTop: 18 }}>¿Sabes de esto y quieres controlar cada detalle? <Link href={`/empleados/${id}/skill?modo=avanzado`}>Abrir el modo experto</Link>.</p></div>);
}
