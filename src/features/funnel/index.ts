// Módulo del funnel de ventas (experiencia comercial, separada del producto interno). Ver docs/funnel/.
export { FunnelLanding } from "./FunnelLanding";
export * as FunnelContent from "./config/content";
export * from "./tracking/events";
export { Attribution, BuyLink, CtaLink, trackCta } from "./tracking/attribution";
