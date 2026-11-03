import Link from "next/link";
import { requireActor } from "@/lib/session";
import { companyScene } from "@/server/office3d";
import { OfficeViewer } from "@/components/office3d/OfficeViewer";

export const metadata = { title: "Ver mi oficina" };
export default async function Oficina3D() {
  const { db, actor } = await requireActor();
  const scene = await companyScene(db, actor);
  return (<><h1>Ver mi oficina</h1>
    <p className="lead">Así se ve tu equipo. Toca a un empleado para conocerlo, pedirle trabajo o enseñarle. Es un mapa: tu trabajo diario sigue en <Link href="/departamentos">Mis empleados</Link>.</p>
    <OfficeViewer scene={scene} emptyCta={{ href: "/agregar-empleado", label: "Elegir mi primer empleado" }} /></>);
}
