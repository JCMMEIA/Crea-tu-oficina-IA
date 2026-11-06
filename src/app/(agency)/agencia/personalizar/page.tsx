import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getAgency } from "@/server/agency";
import { getOfficeDesign, previewScene } from "@/server/office3d/design_store";
import { PersonalizeOffice } from "@/components/office3d/PersonalizeOffice";
import { designAction } from "../../../agency_actions";

export const metadata = { title: "Personaliza tu oficina" };
export const dynamic = "force-dynamic";
export default async function Personalizar({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  const [ag, design, scene] = await Promise.all([getAgency(db, agency), getOfficeDesign(db, agency), previewScene(db, agency)]);
  return (<><Flash sp={sp} />
    <PersonalizeOffice mode="page" scene={scene} initial={design} legacyStyle={ag.brand?.style ?? "moderno"} action={designAction} /></>);
}
