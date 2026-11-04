# Estructura de la landing (rediseño v2)

Ruta `/`. Orquesta `src/features/funnel/FunnelLanding.tsx`; contenido en `config/`; ver también `docs/landing/`.

| # | Sección (ancla) | Componente |
|---|---|---|
| 1 | Hero | `Hero.tsx`, `Laptop.tsx` |
| 2 | El problema (`#problema`) | `Problem.tsx` |
| 3 | El producto (`#producto`) | `ProductDemo.tsx` (vistas explorables) |
| 4 | Conoce a tus empleados IA (`#empleados`) | `EmployeesSection.tsx` + `EmployeeExplorer.tsx` (41, filtros y «Ver más») |
| 5 | Tu Cerebro Empresarial (`#cerebro`) | `BrainSection.tsx` |
| 6 | Tareas listas (`#tareas`) | `TasksSection.tsx` + `TasksExplorer.tsx` (8 tareas + demostración) |
| 7 | Colaboración (`#workflows`) | `WorkflowsSection.tsx` (conceptual, «Próximamente») |
| 8 | Resultados (`#resultados`) | `ResultsSection.tsx` (ejemplos rotulados) |
| 9 | Cómo funciona (`#como`) | `HowItWorks.tsx` (7 pasos) |
| 10 | Comparación (`#comparacion`) | `Comparison.tsx` |
| 11 | Planes (`#planes`) | `Plans.tsx` (`config/planes.ts`) |
| 12 | Oferta / lista de espera (`#oferta`, `#avisame`) | `Offer.tsx` |
| 13 | Confianza (`#confianza`) | `Trust.tsx` |
| 14 | Preguntas (`#faq`) | `Faq.tsx` |
| 15 | Cierre y footer | `FinalCta.tsx`, `Footer.tsx` |

La disponibilidad real de cada función se declara en `config/disponibilidad.ts`. Los botones de compra solo abren pago si `purchasesOpen()`; si no, lista de espera.
