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
  return (<><h1>Visualiza tu Oficina 3D</h1>
    <p className="muted">{current ? "La oficina de un cliente, con la marca de tu agencia." : "Tu agencia: cada módulo es un cliente con sus empleados de IA reales."}</p>
    <p className="row"><Link className={`chip ${current ? "" : "ok"}`} href="/agencia/oficina-3d">🏛️ Mi agencia</Link>{clients.map((c: any) => <Link key={c.id} className={`chip ${current === c.id ? "ok" : ""}`} href={`/agencia/oficina-3d?cliente=${c.id}`}>🏢 {c.name}</Link>)}</p>
    <OfficeViewer scene={scene} testId="office-agency" emptyCta={{ href: "/agencia/clientes", label: current ? "Desplegar un servicio" : "Agregar un cliente" }} /></>);
}
