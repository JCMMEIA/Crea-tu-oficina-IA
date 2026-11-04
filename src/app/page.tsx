import { redirect } from "next/navigation";
import { currentActor } from "@/lib/session";
import { FunnelLanding } from "@/features/funnel";

export const metadata = { title: { absolute: "Crea tu Oficina IA — crea tu oficina de empleados de inteligencia artificial" }, description: "Crea tu oficina de empleados de inteligencia artificial y automatiza tu negocio. Compra, recibe tu acceso por correo y configúrala en minutos. Sin reuniones ni instalaciones complicadas.", alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";
/** Ruta «/»: quien ya tiene sesión va a su panel; los demás ven el funnel (src/features/funnel). */
export default async function Home({ searchParams }: { searchParams: Promise<{ compra?: string; demo?: string }> }) {
  const { actor, agency } = await currentActor();
  if (agency) redirect("/oficinas"); if (actor) redirect("/oficina");
  const sp = await searchParams;
  return <FunnelLanding compra={sp.compra} demo={sp.demo} />;
}
