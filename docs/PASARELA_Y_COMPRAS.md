# Auditoría de compra, licencias y activación + pasarela para México

Fecha: 2026-11-03. Todo lo marcado «probado» se ejecutó en pruebas automáticas (`tests/commercial.test.ts`, `tests/stripe.test.ts`) y en el recorrido en navegador sobre PostgreSQL real.

## 1. Recorrido auditado
`/planes` → `/registro?plan=X` (se guarda el plan de interés) → asistente → `/agencia/activacion` → `/agencia/plan` → «Contratar» → pasarela → webhook → licencia → límites reales.

| Tramo | Estado |
|---|---|
| Planes, límites de clientes/empleados | **Probado**: se aplican de verdad (no se puede crear el cliente 3 en «Prueba»). |
| Solicitud de plan sin pasarela | **Probado**: registra solicitud, no cambia el plan, no cobra. |
| Concesión/cancelación manual por operador | **Probado**. No cuenta como compra. |
| Checkout con pasarela | **Probado solo contra un Stripe SIMULADO** (importe en centavos MXN, mensual, agencia y plan). **No verificado contra Stripe real.** |
| Webhook firmado → licencia | **Probado** con firma real calculada como documenta Stripe: firma mala/vieja/ausente se rechaza; repetir un evento no duplica; pago sin completar y eventos ajenos se ignoran; cancelación vuelve a «Prueba». |
| Seguridad del cobro | Claves `sk_live_` rechazadas salvo `STRIPE_ALLOW_LIVE=yes`; sin `BILLING_ENABLED=true` no se construye ningún proveedor; el webhook responde 404 con cobros apagados. |

## 2. Hallazgos (lo que falta o es un riesgo)
1. **Bajar de plan no quita lo que ya excede el límite** (solo impide crear más). Decidir política.
2. **Cancelación por el cliente**: no existe pantalla. Solo el operador cancela (o el portal de Stripe, no integrado). Hay que integrar el «portal de cliente» de Stripe o aceptar cancelar a mano.
3. **Pago fallido**: se confía en que Stripe cancele la suscripción tras sus reintentos (`customer.subscription.deleted`). No se maneja «pago atrasado» ni avisos.
4. **Webhook perdido**: Stripe reintenta, pero no hay tarea de conciliación. Salida: el operador concede la licencia a mano desde `/admin/agencias`.
5. **Facturación mexicana (CFDI/IVA)**: ninguna pasarela lo resuelve sola; hace falta un servicio de facturación (o contador) y los datos fiscales del cliente. No construido.
6. **Moneda**: una cuenta de Stripe en México cobra en **MXN**. Por eso `/planes` y el checkout usan `PLAN_PRICE_MXN_*` (si solo hay precio en USD, no se abre el pago).
7. **Cobros a clientes extranjeros**: según el soporte de Stripe, una cuenta mexicana solo cobra **tarjetas mexicanas en MXN**. Si venderás fuera de México, confírmalo con Stripe antes.
8. Sin **correo** de recibo/bienvenida (Stripe sí envía su propio recibo si lo activas en su panel).
9. La activación depende de la licencia, no del pago directamente: correcto, pero un retraso del webhook deja al cliente en «Prueba» unos segundos (el mensaje ya lo dice).

## 3. Recomendación de pasarela (México)
**Primera opción: Stripe México.** Razones: Checkout hospedado (no tocamos datos de tarjetas), suscripciones mensuales nativas, **modo de pruebas completo**, webhooks firmados, tarjetas Visa/Mastercard/Amex y pagos en MXN. Ya está implementado el contrato y el proveedor contra su documentación.
**Alternativas** si Stripe no te acepta o prefieres lo local: **Mercado Pago**, **Conekta** u **OpenPay** (fuertes en OXXO y transferencias SPEI). Implementarlas es escribir otro `PaymentProvider` (≈ un archivo, ya hay tipo y pruebas de contrato).
Datos a tener en cuenta (de la ayuda de Stripe, **fuente no oficial en parte; confírmalo en tu cuenta**): OXXO **no sirve para suscripciones**; las comisiones publicadas por terceros son contradictorias, revisa `stripe.com/mx/pricing`. No verifiqué comisiones ni requisitos de alta.

## 4. Modo de pruebas (preparado, sin cobros)
Variables: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, `PLAN_PRICE_MXN_*`, y por último `BILLING_ENABLED=true`. Con claves de prueba **no se mueve dinero**. Hoy: `BILLING_ENABLED=false`.
**Falta para cobrar de verdad:** (1) tu cuenta Stripe y sus claves de prueba; (2) probar un pago de prueba de punta a punta y ver la licencia activarse **en el servidor real**; (3) decidir precios, IVA/CFDI y cancelación/reembolsos; (4) términos de servicio; (5) tu autorización explícita para pasar a claves reales (`STRIPE_ALLOW_LIVE=yes`).
