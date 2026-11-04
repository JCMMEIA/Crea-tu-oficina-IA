import Link from "next/link";
import { Icon } from "@/components/Icon";
/** Dos tarjetas que reutilizan las funciones existentes: /oficinas/nueva y /oficinas (piden iniciar sesión). */
export function OfficesCta() {
  return (<section className="lp-section" aria-label="Oficinas del cliente" style={{ paddingTop: 0 }}><div className="lp-wrap"><div className="lp-offices">
    <div><span className="lp-eyebrow">Tu oficina IA, a tu medida</span><h2>Crea, gestiona y escala tus oficinas IA</h2><p>Lanza nuevas oficinas y administra todas desde un solo panel, cada una con sus propios datos, plan y límites.</p></div>
    <Link href="/oficinas/nueva" className="lp-office" data-testid="card-nueva-oficina"><span className="icon-box fill"><Icon name="plus" size={26} /></span><span><h3>Nueva oficina IA</h3><p>Configura y compra otra oficina desde tu cuenta, con negocio, plantilla y empleados.</p><small>Requiere iniciar sesión</small></span></Link>
    <Link href="/oficinas" className="lp-office" data-testid="card-mis-oficinas"><span className="icon-box"><Icon name="layers" size={26} /></span><span><h3>Mis oficinas</h3><p>Entra, administra, pausa y cambia entre todas tus oficinas con un clic.</p><small>Requiere iniciar sesión</small></span></Link></div></div></section>);
}
