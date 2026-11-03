import Link from "next/link";
import { requireActor } from "@/lib/session";
import { companyScene } from "@/server/office3d";
import { OfficeViewer } from "@/components/office3d/OfficeViewer";

export const metadata = { title: "Visualiza tu Oficina 3D" };
export default async function Oficina3D() {
  const { db, actor } = await requireActor();
  const scene = await companyScene(db, actor);
  return (<><h1>Visualiza tu Oficina 3D</h1>
    <p className="muted">Tu estructura operativa, generada con tus departamentos y empleados reales. Es un complemento visual: la gestión sigue en <Link href="/departamentos">Mis departamentos</Link>.</p>
    <OfficeViewer scene={scene} emptyCta={{ href: "/construir?paso=3", label: "Contratar mi primer empleado" }} /></>);
}
