# Fase 7 · Programa de afiliados (camino B)

**No es un programa de licencias:** el afiliado recomienda; el cliente, el cobro, el soporte y los datos son de la plataforma.

## Qué está implementado (y probado con pruebas automáticas)
| Pieza | Estado |
|---|---|
| **Solicitud por invitación o aprobación manual** (`/afiliados`, `/admin/afiliados`) | Implementado. La solicitud queda «solicitada», sin código ni acceso, con honeypot y tope por hora. Solo un operador aprueba o invita. |
| **Enlace único** `/r/CODIGO` y atribución | Implementado: cookie de 30 días (`cto_ref`), el código viaja en la intención de compra y se atribuye en la entrega del pedido. |
| **Prevención de fraude** | Autorreferidos (correo canónico: sin alias `+`, sin puntos de Gmail), clientes ya existentes y códigos desconocidos o de afiliados no aprobados **no generan comisión**; el pedido se entrega igual. |
| **Comisiones** | 20 % del cobro neto de cada factura pagada, **máximo 12 cobros por cliente**, idempotente por factura, estados pendiente → aprobada (tras 30 días de retención) → pagada. |
| **Reembolsos y contracargos** | Reversión (o proporcional) y, si ya se pagó, **ajuste negativo** que se descuenta del siguiente pago. **Registro manual** por un operador: **los eventos de reembolso de Stripe todavía no llegan solos** (no se tocó el webhook). |
| **Liquidación mensual auditable** | Una por afiliado y mes, pago mínimo (lo que no lo alcanza se acumula), referencia obligatoria al marcar pagada, CSV de auditoría **sin correos**, todo en `audit_log`. |
| **Panel del afiliado** (`/afiliado`) | Solo su enlace, visitas, «Cliente 1…N» (plan y nº de cobros) y totales. **Nunca** correos, oficinas, conversaciones ni documentos (probado). |
| **Landing** `/afiliados` y el camino en la landing principal | Implementado, marcado «en preparación». Sin ejemplos de ganancias. |

## Qué falta antes de abrirlo al público
1. **Contrato y condiciones revisados por un profesional** (el borrador está en `docs/afiliados/TERMINOS_BORRADOR.md`) y aviso de privacidad actualizado por la cookie de referencia. 2. **Eventos de reembolso/contracargo de Stripe** conectados. 3. **Validar de punta a punta con una compra de prueba real** (hoy solo hay pruebas con datos simulados). 4. Definir el tratamiento fiscal de las comisiones (retenciones, comprobantes) con contabilidad. 5. Definir el pago real (SPEI, etc.) — hoy solo se registra la referencia. 6. Prueba piloto con 2–3 afiliados invitados.
**No se abrieron inscripciones públicas:** cualquiera puede *solicitar*, pero nadie obtiene enlace ni acceso sin aprobación.

## Rentabilidad
El 20 % recurrente sobre el neto es compatible con el margen simulado (ver `FINANZAS.md`) porque el costo de IA es una fracción pequeña; la comisión efectiva del conjunto ronda 3.6 % del ingreso con los supuestos de la simulación. Si el precio o el costo de IA cambian, se revisa la tasa: está en un solo lugar (`AFFILIATE_TERMS`).
