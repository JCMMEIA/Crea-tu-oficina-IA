import { requireAgency } from "@/lib/session";
import { Flash, Tip, EmptyState } from "@/lib/ui";
import { HireGallery } from "@/components/HireGallery";
import { listClients } from "@/server/agency";
import { ensureDemoOffice } from "@/server/onboarding";
import { agencyHireAction } from "../../../agency_actions";
import Link from "next/link";

export const metadata = { title: "Agregar empleado" };
export default async function Contratar({ searchParams }: { searchParams: Promise<{ oficina?: string; servicio?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  await ensureDemoOffice(db, agency); const clients = await listClients(db, agency);
  const office = clients.find((c: any) => c.id === sp.oficina) ?? clients.find((c: any) => c.is_demo) ?? clients[0];
  const hired = new Set((await db.query("SELECT template_key FROM employees WHERE company_id=$1", [office.id])).map((r) => r.template_key as string));
  return (<><h1>Agregar empleado</h1><p className="lead">Elige un trabajo y contrata a quien lo hace. Tú decides en qué oficina trabajará.</p><Flash sp={sp} />
    <form method="get" className="row" style={{ marginBottom: 12 }}><label htmlFor="of" style={{ margin: 0 }}>Para la oficina de:</label>
      <select id="of" name="oficina" defaultValue={office.id} style={{ width: "auto", minWidth: 220 }}>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.is_demo ? "🧪 Oficina de práctica" : c.name}</option>)}</select>
      <input type="hidden" name="servicio" value={sp.servicio ?? "anuncios"} /><button className="ghost">Cambiar</button></form>
    <Tip>Agregar un empleado no cuesta nada ni envía nada. Empieza a trabajar solo cuando tú le pidas una tarea.</Tip>
    <HireGallery basePath="/agencia/contratar" query={`oficina=${office.id}`} hired={hired} action={agencyHireAction} hidden={{ companyId: office.id, back: `/agencia/contratar?oficina=${office.id}&servicio=${sp.servicio ?? "anuncios"}` }} tab={sp.servicio ?? "anuncios"} />
    {!clients.length && <EmptyState icon="🏗️" title="Primero necesitas una oficina" text="Crea a tu primer cliente y su oficina se arma sola." href="/agencia/clientes" cta="Agregar cliente" />}
    <p className="muted">¿Prefieres contarle al asistente lo que quieres vender? <Link href="/agencia/asistente">Habla con el asistente guiado</Link>.</p></>);
}
