import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { profileFor } from "@/features/employees/catalog";
import { EmployeeProfile } from "@/features/employees/components/EmployeeProfile";
import { hireAction } from "../../actions";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) { const p = profileFor((await params).key); return { title: p ? `${p.nombre} · ${p.puesto}` : "Empleado" }; }
export default async function Ficha({ params }: { params: Promise<{ key: string }> }) {
  const p = profileFor((await params).key); if (!p) notFound(); await requireActor();
  return (<div className="land" style={{ maxWidth: 1000, padding: 0 }}><p><Link href="/agregar-empleado">← Volver al directorio</Link></p>
    <EmployeeProfile p={p}><form action={hireAction} style={{ marginTop: 16 }}><input type="hidden" name="empleado" value={p.key} /><input type="hidden" name="next" value="/agregar-empleado" />
      <button className="big" data-testid={`add-${p.key}`}>Agregar a mi oficina</button></form></EmployeeProfile></div>);
}
