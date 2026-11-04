# Estructura de la landing

| Sección | Archivo (`src/features/funnel/`) |
|---|---|
| Header fijo | `components/Header.tsx` |
| Hero (título, subtítulo, botón de compra, «Ver panel por dentro») | `components/Hero.tsx`, `components/Laptop.tsx` |
| Beneficios | `components/Benefits.tsx` (textos en `config/content.ts`) |
| Cómo funciona | `components/HowItWorks.tsx` |
| Demostración (capturas reales del panel) | `components/ProductDemo.tsx` |
| Testimonios | `components/Testimonials.tsx` — **oculta** mientras no existan testimonios reales |
| Oficinas del cliente | `components/OfficesCta.tsx` |
| Oferta y precios | `components/Offer.tsx` |
| FAQ | `components/Faq.tsx` (preguntas en `config/content.ts`) |
| Botones de compra | `components/BuyButton.tsx` + `tracking/attribution.tsx` (`BuyLink`) |
| Cierre | `components/FinalCta.tsx`, `components/Footer.tsx` |
| Medición | `tracking/`, `measurement/` |

Orquesta todo `FunnelLanding.tsx`. El botón de compra solo lleva a pago si `purchasesOpen()` (facturación + precio MXN + correo + IA verificada); si no, muestra lista de espera («Avísame»). No hay rutas duplicadas: `/planes` y `/registro` reutilizan los mismos componentes de seguimiento.
