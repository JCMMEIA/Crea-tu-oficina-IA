import { redirect } from "next/navigation";
/** Ruta antigua: ahora «Agregar empleado» (paso 4 = ver la oficina). */
export default async function Construir({ searchParams }: { searchParams: Promise<{ paso?: string }> }) {
  const sp = await searchParams; redirect(sp.paso === "4" ? "/oficina-3d" : "/agregar-empleado");
}
