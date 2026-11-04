import { Icon } from "@/components/Icon";
import { TESTIMONIALS } from "@/content/testimonials";
/** Solo testimonios REALES (src/content/testimonials.ts). Lista vacía → la sección NO se muestra. `preview` (?demo=testimonios) enseña el diseño con marcadores, rotulado como demostración. */
export function Testimonials({ preview }: { preview: boolean }) {
  if (!TESTIMONIALS.length && !preview) return null;
  const items = TESTIMONIALS.length ? TESTIMONIALS : [0, 1, 2].map(() => ({ name: "Nombre del cliente", role: "Cargo · Empresa", quote: "Aquí irá el testimonio real de un cliente, con su permiso." }));
  return (<section className="lp-section" id="testimonios" aria-labelledby="test-t"><div className="lp-wrap"><div className="lp-center"><h2 id="test-t">Lo que dicen nuestros usuarios</h2>
    {!TESTIMONIALS.length && <p><span className="lp-ribbon" data-testid="demo-ribbon">Diseño de demostración · no son testimonios reales</span></p>}</div>
    <div className="lp-grid c3" style={{ marginTop: 32 }}>{items.map((t, i) => <figure className="lp-card lp-quote" key={i} style={{ margin: 0 }}><blockquote>“{t.quote}”</blockquote><footer><span className="lp-avatar" aria-hidden="true"><Icon name="user" size={22} /></span><span><b style={{ color: "#fff", display: "block" }}>{t.name}</b>{t.role}</span></footer></figure>)}</div></div></section>);
}
