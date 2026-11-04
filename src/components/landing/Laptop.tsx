/** Laptop de CSS con una captura REAL del panel (modo demostración, datos de ejemplo). La imagen se genera con scripts/landing/capturas.cjs. */
export function Laptop({ src, alt, priority = false, tag = true }: { src: string; alt: string; priority?: boolean; tag?: boolean }) {
  return (<div className="lp-laptop"><div className="lp-screen">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} width={1440} height={900} {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })} decoding="async" />
    </div><div className="lp-base" aria-hidden="true" />{tag && <p className="lp-caption">Captura del panel real en modo demostración · datos de ejemplo</p>}</div>);
}
