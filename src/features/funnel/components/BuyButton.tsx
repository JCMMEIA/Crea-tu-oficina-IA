import { Icon } from "@/components/Icon";
import { BuyLink } from "../tracking/attribution";
/** Botón de compra. Tienda ABIERTA → «Crear mi oficina IA» (cuenta el clic y lleva la fuente al pago). CERRADA → «Avísame cuando abran» (lista de espera; nunca un botón de pago que no funcione). */
export function BuyButton({ open, where, label = "Crear mi oficina IA" }: { open: boolean; where: string; label?: string }) {
  return open ? <BuyLink cta={where} className="btn" testId={`cta-comprar-${where}`}>{label} <Icon name="arrow" size={18} /></BuyLink>
    : <a className="btn" href="#avisame" data-testid={`cta-avisame-${where}`}>Avísame cuando abran</a>;
}
