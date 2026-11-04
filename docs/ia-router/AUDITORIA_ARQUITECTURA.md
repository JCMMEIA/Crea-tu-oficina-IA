# Fase 1 · Auditoría de la arquitectura existente

Verificado leyendo el código (`main` + PR #3 + PR #4).

## IA actual
- **Un solo proveedor y un solo modelo:** `getProvider()` (`src/server/models/index.ts`) devuelve Anthropic si hay `ANTHROPIC_API_KEY`; el modelo sale de `MODEL_ID` (por defecto `claude-sonnet-5-5`) y el precio de `MODEL_INPUT/OUTPUT_USD_PER_MTOK`. **No existe selección de modelos:** los 41 empleados usan lo mismo.
- **Qué se registra:** por tarea, tokens de entrada/salida y costo (`tasks`, `usage_events`). **No se registraba:** modelo usado, proveedor, intentos, latencia ni el costo de las llamadas fallidas.

## Llamadas que generan costo (todas)
| Origen | Dónde | Notas |
|---|---|---|
| Ejecución de tareas (chat, tareas guiadas, automatizaciones, mensajería, práctica de onboarding) | `runTask` → `provider.complete` (hasta 6 pasos por tarea, `MAX_STEPS`) | **Único punto de llamada** para el trabajo de los empleados; con 3 reintentos por error transitorio (`withRetry`) |
| Delegación entre empleados | `delegate_task` crea tareas hijas; `runWorkflow` las ejecuta (profundidad y cadena acotadas, tope 10 tareas) | Cada hija es otra `runTask`: cuenta en el consumo |
| Verificación de la IA | `verifyAi` (`src/server/commerce/gate.ts`) | 1 llamada mínima |
| Cerebro Empresarial (PR #3) | Se agrega al prompt de `runTask` (~hasta 1 500 tokens por llamada) | No es una llamada aparte |
No hay otras llamadas a modelos (la landing, el correo y los pagos no usan IA).

## Límites existentes
Presupuesto mensual en **USD** por empresa (10) y por oficina (20), tope de ejecuciones por hora (30) y por empleado/día (20), `max_output_tokens` por empleado, pre-chequeo con el peor caso (20 000 tokens de entrada). **No había cuota en tokens por plan ni por cuenta** y cada oficina contaba por separado.

## PR #3 (Cerebro + 8 tareas guiadas)
Abierto y sin fusionar. Aporta el contexto del negocio en cada ejecución, 8 tareas con secciones verificables y resultados descargables. No selecciona modelos; su único ajuste en esta rama es un campo `level` (A/B/C) por tarea.

## Stripe, oficinas, permisos y clientes
- Compra directa: `checkout_intents` → `orders` (único por sesión) → `office_rights` → oficina (`agencies`) con **un plan por oficina** (`agencies.plan`). Suscripciones y facturas en `subscriptions`/`invoices` (webhook firmado e idempotente).
- Permisos: RBAC por empresa (`memberships`) y por oficina (`agency_members`: `agency_owner/admin/member`). Aislamiento por `company_id`.
- **No existía el concepto de «cuenta» con varias oficinas que comparten cuota.** Se definió como el **dueño de la oficina** (`agency_owner`): todas sus oficinas comparten cuota.
- **Brechas para el modelo comercial nuevo (no resueltas aquí):** Starter/Pro/Business no están conectados al cobro (un solo plan a la venta, `OFFER_PLAN`); «Business = 3 oficinas» exige que una compra otorgue tres derechos de oficina; reembolsos y contracargos de Stripe no se procesan automáticamente.

## Lo que se reutilizó en vez de duplicar
`runTask`/`createTask`/`runWorkflow`, `usage_events` y los límites existentes (siguen activos), `audit_log`, el patrón de panel de operador (`requireOperator`), `purchasesOpen`, `invoices`/`orders` para comisiones, el catálogo de 41 empleados y el funnel de la landing.
