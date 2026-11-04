# Auditoría del modelo de suscripción (antes de ofrecer Starter / Pro / Business)

**No se cambió el checkout.** Hallazgos sobre el sistema actual:
1. **Un solo plan a la venta.** `/comprar` crea la intención con `offerPlan()` (variable `OFFER_PLAN`, por defecto `emprendedor`); no recibe un plan desde la landing.
2. **Los planes del código no son Starter/Pro/Business:** `prueba`, `emprendedor`, `agencia`, `avanzado`, limitados por **número de clientes y empleados** (`src/server/agency/plans.ts`), sin cuota de tareas ni de tokens.
3. **Precio:** variable de entorno por plan y moneda (`PLAN_PRICE_MXN_<PLAN>`); el cobro se crea con `price_data` en línea en Stripe Checkout (suscripción mensual en MXN), sin productos ni precios persistentes en Stripe. `purchasesOpen()` exige billing, precio en MXN, correo y IA verificada.
4. **Datos:** `checkout_intents.plan`, `orders.plan`, `office_rights.plan`, `agencies.plan` aceptan cualquier `PlanKey`; el webhook toma el plan de `metadata[plan]`.
5. **Consumo:** el control real es un **presupuesto en dólares** por empresa y por oficina, no una cuota por plan.

**Para tener tres planes comprables hace falta** (propuesta, sin implementar): (a) decidir si Starter/Pro/Business **reemplazan** o se **mapean** a los planes actuales; (b) definir cuota de tareas/tokens por plan y conectarla al presupuesto; (c) `/comprar?plan=` con validación; (d) una prueba E2E por plan (modo de prueba de Stripe); (e) migración de `agencies.plan` si cambian los nombres; (f) textos de cancelación y facturación aprobados. Mientras tanto la landing muestra los tres niveles como **orientación**, sin precios ni cantidades, y la compra real sigue por la oferta única.
