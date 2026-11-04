import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BuyButton } from "./BuyButton";
export function FinalCta({ open }: { open: boolean }) {
  return (<section className="lp-final" aria-labelledby="final-t"><div className="lp-wrap"><h2 id="final-t" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>Crea hoy tu oficina de empleados de IA</h2><p className="lp-sub">Automatiza tu negocio, gana tiempo y escala sin complicaciones.</p>
    <div className="lp-cta"><BuyButton open={open} where="final" /><Link className="btn ghost" href="/panel-demo/inicio"><Icon name="play" size={15} />Ver panel por dentro</Link></div></div></section>);
}
