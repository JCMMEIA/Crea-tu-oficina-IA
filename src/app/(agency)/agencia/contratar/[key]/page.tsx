import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/session";
import { profileFor } from "@/features/employees/catalog";
import { EmployeeProfile } from "@/features/employees/components/EmployeeProfile";
import { agencyHireAction } from "../../../../agency_actions";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) { const p = profileFor((await params).key); return { title: p ? `${p.nombre} · ${p.puesto}` : "Empleado" }; }
export default async function Ficha({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ oficina?: string }> }) {
  const p = profileFor((await params).key); if (!p) notFound(); const sp = await searchParams; await requireAgency();
  const back = `/agencia/contratar${sp.oficina ? `?oficina=${encodeURIComponent(sp.oficina)}` : ""}`;
  return (<><p><Link href={back}>← Volver al directorio</Link></p>
    <EmployeeProfile p={p}>{sp.oficina ? <form action={agencyHireAction} style={{ marginTop: 16 }}><input type="hidden" name="companyId" value={sp.oficina} /><input type="hidden" name="empleado" value={p.key} /><input type="hidden" name="back" value={back} />
      <button className="big" data-testid={`add-${p.key}`}>Agregar a esta oficina</button></form> : <p className="muted">Elige primero una oficina en el directorio para agregarlo.</p>}</EmployeeProfile></>);
}
