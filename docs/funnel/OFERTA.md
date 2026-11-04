# Oferta comercial

- Plan en venta: variable `OFFER_PLAN` (por defecto `emprendedor`). Precio mensual en MXN: `PLAN_PRICE_MXN_<PLAN>` (p. ej. `PLAN_PRICE_MXN_EMPRENDEDOR=899`). No hay precio inventado: sin variable, el botón no abre compra.
- Qué incluye: lista `ofertaBullets` en `config/content.ts` (se calcula del plan real: oficinas, empleados, tareas).
- Promoción opcional: `FUNNEL_PROMO_TEXT` (máx. 140 caracteres); no cambia el cobro, solo es texto. Cualquier descuento real debe crearse primero en Stripe.
- Avisos obligatorios junto al botón: `AVISOS_COMPRA` (cobro recurrente, cancelación, IA que puede equivocarse).
