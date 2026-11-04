import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CtaLink } from "../tracking/attribution";
import { Estatus, SectionHead } from "./ui";

/** «¿Qué quieres hacer con la IA?» — los dos caminos comerciales. Cada uno lleva a su propia landing y mide su clic. */
export function PathsSection({ open }: { open: boolean }) {
  return (<section className="lp-section" id="caminos" aria-labelledby="caminos-t"><div className="lp-wrap">
    <SectionHead id="caminos-t" eyebrow="Elige tu camino" titulo="¿Qué quieres hacer con la IA?" lead="Dos formas de aprovechar Crea tu Oficina IA: usarla en tu negocio o recomendarla a otros." />
    <div className="fx-paths">
      <article className="fx-path main" data-testid="camino-oficina"><span className="fx-path-ic"><Icon name="building" size={26} /></span><h3>Crear mi Oficina IA</h3><p>Para empresarios y negocios. Una oficina con empleados IA especializados para marketing, ventas, atención al cliente, operaciones y más: configuras tu negocio una vez, eliges tareas guiadas y recibes resultados que puedes editar y descargar.</p>
        <ul className="fx-ideal"><li><Icon name="check" size={15} /><span>41 puestos para distintas áreas</span></li><li><Icon name="check" size={15} /><span>Cerebro Empresarial y tareas guiadas <Estatus de="tareasGuiadas" /></span></li><li><Icon name="check" size={15} /><span>Consumo y límites visibles</span></li></ul>
        <CtaLink href={open ? "#oferta" : "#avisame"} cta="camino-oficina" className="btn" testId="camino-oficina-cta">{open ? "Crear mi Oficina IA" : "Avísame cuando abran"} <Icon name="arrow" size={16} /></CtaLink><a className="fx-small" href="#empleados">o conoce primero a los empleados</a></article>
      <article className="fx-path" data-testid="camino-afiliado"><span className="fx-path-ic"><Icon name="trend" size={26} /></span><h3>Ganar dinero como afiliado</h3><p>Para quien recomienda. Recibe tu enlace único y una comisión recurrente por los cobros elegibles de los clientes que refieras, con reglas claras y un panel donde ves tus cifras. Sin acceso a datos de clientes.</p>
        <ul className="fx-ideal"><li><Icon name="check" size={15} /><span>Comisión recurrente por cliente referido</span></li><li><Icon name="check" size={15} /><span>Panel con tus clientes y comisiones</span></li><li><Icon name="check" size={15} /><span>Pagos mensuales auditables</span></li></ul>
        <Link href="/afiliados" className="btn ghost" data-testid="camino-afiliado-cta">Conocer el programa de afiliados <Icon name="arrow" size={16} /></Link><span className="fx-small">Programa en preparación · por invitación o solicitud aprobada</span></article></div></div></section>);
}
