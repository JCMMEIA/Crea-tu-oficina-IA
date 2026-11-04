import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BuyButton } from "./BuyButton";

export function FinalCta({ open }: { open: boolean }) {
  return (<section className="lp-final" aria-labelledby="final-t"><div className="lp-wrap"><h2 id="final-t" className="fx-h2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Deja de hacerlo todo tú. <span className="lp-grad">Construye tu oficina inteligente.</span></h2>
    <p className="lp-sub">{open ? "Crea tu oficina, configura tu Cerebro Empresarial y pide tu primera tarea. Tú decides qué se hace con cada resultado." : "Estamos preparando la apertura. Déjanos tu correo y serás de los primeros en saberlo; mientras tanto, recorre el panel."}</p>
    <div className="lp-cta"><BuyButton open={open} where="final" /><Link className="btn ghost" href="/panel-demo/inicio"><Icon name="play" size={15} />Ver el panel por dentro</Link></div></div></section>);
}
