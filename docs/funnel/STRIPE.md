# Stripe

- Checkout alojado por Stripe; la plataforma nunca ve la tarjeta.
- Webhook: `POST /api/billing/webhook`, verifica firma (`STRIPE_WEBHOOK_SECRET`) y guarda cada evento en `payment_events` (idempotente).
- **Cobros reales apagados**: usar solo claves `sk_test_…` hasta autorización de José. `BILLING_ENABLED=true` + clave + precio habilitan la compra.
- Pruebas: las pruebas automáticas y `scripts/e2e/compra_directa.sh` usan un servidor **simulado** de Stripe; no sustituyen una prueba con Stripe en modo prueba (ver docs/correo y PASARELA_Y_COMPRAS.md).
