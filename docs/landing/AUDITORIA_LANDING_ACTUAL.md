# Auditoría de la landing anterior

**Antes (9 secciones):** Hero (título «Crea tu oficina de empleados de inteligencia artificial y automatiza tu negocio»), Beneficios (4 tarjetas), Cómo funciona (5 pasos), Demostración (4 capturas), Testimonios (oculto), Oficinas, Oferta con FAQ, Cierre y Footer.
**Fortalezas que se conservaron:** header fijo, laptop con captura real del panel, lista de espera funcional con la tienda cerrada, atribución UTM sin cookies, sistema de tokens `premium.css`, pruebas de accesibilidad y rendimiento.
**Carencias:** mostraba poco de los empleados (ninguno por nombre), no explicaba el Cerebro ni las tareas, ningún resultado de ejemplo, sin comparación ni planes, FAQ de 7 preguntas dentro de la oferta, pasos genéricos.

| Componente anterior | Qué se hizo |
|---|---|
| `Header`, `Laptop`, `BuyButton`, `Footer` | Reutilizados y ampliados (menú por secciones, enlaces reales) |
| `Hero`, `HowItWorks`, `Faq`, `FinalCta`, `ProductDemo`, `Offer` | Reescritos con el nuevo mensaje y estructura |
| `Benefits`, `OfficesCta`, `Testimonials` | Reemplazados por `Problem`, `Plans` y `Trust` (los testimonios siguen leyéndose de `src/content/testimonials.ts`, hoy vacío) |
| `tracking/`, `measurement/`, `BuyLink` | Intactos (más identificadores de CTA) |
| Nuevos | `EmployeesSection`, `BrainSection`, `TasksSection`, `WorkflowsSection`, `ResultsSection`, `Comparison`, `Plans`, `Trust`, `Reveal`, `ui` |
