import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { getAgency } from "@/server/agency";
import { brandAction } from "../../../agency_actions";
export default async function Identidad({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const ag = await getAgency(db, agency); const b = ag.brand ?? {};
  const logo = typeof b.logo === "string" ? b.logo : "";
  return (<><h1>Identidad visual</h1><p className="muted">Tu marca aparece en la oficina que ven tus clientes (nombre, logo y color). Marca blanca: el producto base no muestra la marca de la plataforma en esas pantallas.</p><Flash sp={sp} />
    <form action={brandAction} className="card" encType="multipart/form-data"><input type="hidden" name="currentLogo" value={logo.startsWith("data:") ? logo : ""} />
      <label>Nombre de la agencia</label><input name="name" defaultValue={ag.name} required /><label>Especialidad</label><input name="specialty" defaultValue={ag.specialty} /><label>Lema</label><input name="tagline" defaultValue={b.tagline ?? ""} />
      <label>Color principal</label><input type="color" name="primaryColor" defaultValue={b.primaryColor ?? "#4f46e5"} style={{ width: 80, height: 40, padding: 2 }} />
      <label>Logo (PNG/JPG/WEBP hasta 150 KB)</label>{logo && <p><img src={logo} alt="Logo actual" style={{ maxHeight: 60 }} /></p>}<input type="file" name="logoFile" accept="image/png,image/jpeg,image/webp" />
      <label>…o URL https del logo</label><input name="logoUrl" defaultValue={logo.startsWith("https://") ? logo : ""} />
      {logo && <label style={{ fontWeight: 400 }}><input type="checkbox" name="removeLogo" style={{ width: "auto" }} /> Quitar logo</label>}<p><button>Guardar identidad</button></p></form>
    <div className="notice">Dominios propios por agencia y reventa bajo licencia: <b>pendientes</b> (ver docs/ARQUITECTURA_AGENCIAS.md).</div></>);
}
