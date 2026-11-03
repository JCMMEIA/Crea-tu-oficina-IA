import { requireAgency } from "@/lib/session";
import { Flash, Help, Tip } from "@/lib/ui";
import { getAgency } from "@/server/agency";
import { brandAction } from "../../../agency_actions";

export const metadata = { title: "Mi marca" };
const COLORS = [["#4f46e5", "Azul"], ["#0a7d5a", "Verde"], ["#d9480f", "Naranja"], ["#c2255c", "Rosa"], ["#7048e8", "Morado"], ["#1c1c1a", "Negro"]];
const STYLES = [["moderno", "Moderno"], ["calido", "Cálido"], ["fresco", "Fresco"]];
export default async function Identidad({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const ag = await getAgency(db, agency); const b = ag.brand ?? {};
  const logo = typeof b.logo === "string" ? b.logo : ""; const color = b.primaryColor ?? "#4f46e5";
  return (<><h1>Mi marca</h1><p className="lead">Tu nombre, tu logo y tus colores. Es lo que ven tus clientes dentro de su oficina.</p><Flash sp={sp} />
    <form action={brandAction} className="card" encType="multipart/form-data"><input type="hidden" name="currentColor" value={color} /><input type="hidden" name="currentLogo" value={logo.startsWith("data:") ? logo : ""} />
      <label htmlFor="n">Nombre de tu negocio</label><input id="n" name="name" defaultValue={ag.name} required /><label htmlFor="e">¿A qué te dedicas?</label><Help>Una frase corta. Ejemplo: «Marketing con inteligencia artificial para tiendas».</Help><input id="e" name="specialty" defaultValue={ag.specialty} />
      <label htmlFor="l">Tu lema (opcional)</label><input id="l" name="tagline" defaultValue={b.tagline ?? ""} />
      <h3 style={{ marginTop: 16 }}>Color principal</h3><div className="pick" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>{COLORS.map(([c, n]) => <label className="card" key={c}><input type="radio" name="swatch" value={c} defaultChecked={color === c} /><span style={{ background: c, width: 30, height: 30, borderRadius: "50%", display: "block" }} aria-hidden="true" /><b>{n}</b></label>)}</div>
      <label>…o elige otro color</label><input type="color" name="primaryColor" defaultValue={color} style={{ width: 80, height: 44, padding: 2 }} aria-label="Otro color" />
      <h3 style={{ marginTop: 16 }}>Estilo de tu oficina</h3><select name="style" defaultValue={b.style ?? "moderno"}>{STYLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <label htmlFor="lf">Tu logo</label><Help>Una imagen PNG, JPG o WEBP de hasta 150 KB. Si no tienes, déjalo vacío.</Help>{logo && <p><img src={logo} alt="Tu logo actual" style={{ maxHeight: 60 }} /></p>}<input id="lf" type="file" name="logoFile" accept="image/png,image/jpeg,image/webp" />
      <details><summary>Usar un logo desde internet</summary><label>Dirección de la imagen (https)</label><input name="logoUrl" defaultValue={logo.startsWith("https://") ? logo : ""} /></details>
      {logo && <label style={{ fontWeight: 400 }}><input type="checkbox" name="removeLogo" style={{ width: "auto" }} /> Quitar mi logo</label>}
      <p><button className="big" data-testid="brand-save">Guardar mi marca</button></p></form>
    <Tip>Poner tu propio dominio (por ejemplo, oficina.tunegocio.com) todavía no está disponible.</Tip></>);
}
