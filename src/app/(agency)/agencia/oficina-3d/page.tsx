import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { agencyScene, clientSceneForAgency } from "@/server/office3d";
import { listClients } from "@/server/agency";
import { OfficeViewer } from "@/components/office3d/OfficeViewer";

export const metadata = { title: "Visualiza tu Oficina 3D — Agencia" };
export default async function Agencia3D({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  const clients = await listClients(db, agency);
  let scene, current = "";
  try { if (sp.cliente) { scene = await clientSceneForAgency(db, agency, sp.cliente); current = sp.cliente; } } catch { /* cliente ajeno o inexistente: se muestra la agencia */ }
  scene ??= await agencyScene(db, agency);
  return (<><h1>Ver mi oficina</h1>
    <p className="lead">{current ? "La oficina de un cliente, con tu marca." : "Tu negocio: cada zona es un cliente con sus empleados."}</p>
    <p className="row"><Link className={`chip ${current ? "" : "ok"}`} href="/agencia/oficina-3d">🏛️ Todo mi negocio</Link>{clients.map((c: any) => <Link key={c.id} className={`chip ${current === c.id ? "ok" : ""}`} href={`/agencia/oficina-3d?cliente=${c.id}`}>🏢 {c.is_demo ? "Oficina de práctica" : c.name}</Link>)}</p>
    <OfficeViewer scene={scene} testId="office-agency" emptyCta={{ href: current ? "/agencia/contratar" : "/agencia/clientes", label: current ? "Agregar empleado" : "Agregar cliente" }} /></>);
}
