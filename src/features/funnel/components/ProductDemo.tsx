import Link from "next/link";
import { Icon, IconName } from "@/components/Icon";
import { DEMO_VIEWS } from "@/lib/demo_data";
/** «Vista del producto»: 8 capturas REALES del panel en modo demostración (datos de ejemplo), cada una enlazada a la demo interactiva. Se regeneran con scripts/landing/capturas.sh. */
export function ProductDemo() {
  return (<section className="lp-section" id="panel" aria-labelledby="panel-t"><div className="lp-wrap"><div className="lp-center"><span className="lp-eyebrow">El panel por dentro</span><h2 id="panel-t">Conoce tu panel antes de comprar</h2><p className="lp-sub">Recorre la interfaz real con datos de ejemplo. Sin registro ni pago, sin información real.</p>
    <p style={{ marginTop: 24 }}><Link className="btn" href="/panel-demo/inicio" data-testid="ver-panel-2"><Icon name="play" size={15} />Ver panel por dentro</Link></p></div>
    <div className="lp-views">{DEMO_VIEWS.map((v) => <Link key={v.slug} href={`/panel-demo/${v.slug}`} className="lp-card lp-view" data-testid={`vista-${v.slug}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/landing/vista-${v.slug}.webp`} alt={`Vista «${v.label}» del panel (datos de ejemplo)`} width={800} height={500} loading="lazy" decoding="async" />
      <div><h3><Icon name={v.icon as IconName} size={18} />{v.label}</h3><p>{v.desc}</p></div></Link>)}</div></div></section>);
}
