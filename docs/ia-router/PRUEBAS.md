# Pruebas y evidencia (qué es simulado y qué es real)

## Resumen honesto
**Todo lo que toca modelos, OpenRouter, Stripe y correo se probó con SIMULACIONES locales.** Lo que sí se verificó de forma real es la lógica propia: selección, validación, reservas atómicas (también contra PostgreSQL real), aislamiento, comisiones, pantallas y el flujo de navegador. **No se probó con modelos reales ni con OpenRouter, y no se midió calidad ni latencia reales.** La evaluación real (`scripts/ia/evaluar.ts`) existe, se niega a correr sin claves y no se ejecutó.

| Prueba | Qué cubre | ¿Real o simulado? |
|---|---|---|
| `tests/router.test.ts` (23) | Validación y auditoría de la configuración; selección por nivel/sensibilidad/plan/presupuesto; historial; validación de salida; **ejecución del motor** con el router: modelo económico, registro completo (`ai_calls`), consumo exacto, fallback (error transitorio y respuesta inválida), gratuito sin escalar a pago, **fallback sin superar el presupuesto**, sin modelos/sin proveedor, máximo de intentos (sin bucles), **herramientas sin duplicarse**, **concurrencia (20 reservas paralelas)**, liquidación idempotente, reservas huérfanas, bloqueo por cuota sin llamar al modelo, alertas 80/100 %, **aislamiento entre oficinas**, **datos confidenciales solo a retención cero**, clasificación explicable y 41 perfiles | Lógica real; **proveedores simulados** (`FakeBackend`); PGlite y PostgreSQL 16 real |
| `tests/affiliates.test.ts` (13) | Solicitud sin acceso hasta aprobar; códigos únicos; atribución; **autorreferidos** (alias, puntos de Gmail) y clientes existentes; la compra se entrega aunque se rechace la atribución; comisión 20 % neto, idempotente, **tope de 12 cobros**; sin comisionar facturas fallidas; retención; reembolso total/parcial y **ajuste negativo tras el pago**; liquidación mensual, mínimo, CSV sin correos; **privacidad del panel** | Lógica real; datos de prueba |
| `scripts/e2e/compra_directa.sh` (**81/81**, navegador + PostgreSQL real, **Stripe/Resend/IA simulados**) | Todo el flujo de compra existente **sigue funcionando** + `/admin/ia` (router apagado por defecto, alta de modelo con validación, simulador, auditoría) + `/admin/afiliados` (invitación) + `/r/CODIGO` (cookie) + compra por enlace atribuida + comisión de $179.80 sobre $899 + **sin duplicar** + autorreferido con alias + acceso de la afiliada sin oficina + **panel sin datos de clientes** + solicitud pública sin código | Navegador y base real; **pagos y correo simulados** |
| `scripts/e2e/landing_premium.cjs` (**97/97**) | Landing con los dos caminos, landing de afiliados (sin precios ni ganancias, «en preparación», formulario), orden de secciones, login, accesibilidad (axe, 0 graves), rendimiento, móvil | Navegador real |
| `npm run check` | tsc, todas las pruebas, búsqueda de secretos | — |
| `npx tsx scripts/finanzas/simular.ts` | Tablas de rentabilidad para 10/100/1 000/10 000 clientes | **Simulación con supuestos no verificados** |

## Cobertura de lo pedido en la Fase 9
Límites por cliente ✔ · Concurrencia ✔ · Aislamiento entre oficinas ✔ · Fallos de proveedor ✔ · Fallback sin exceder presupuesto ✔ · Protección de datos ✔ · Reintentos ✔ · Bloqueo por cuota ✔ · Exactitud del consumo ✔ · Recuperación ante errores (liberación de reservas, reservas huérfanas, errores sin cobro) ✔.
**No cubierto:** calidad real de los modelos con un conjunto de tareas reales (requiere claves y acceso a OpenRouter), latencia real, comportamiento real de los límites de los modelos gratuitos y reembolsos/contracargos reales de Stripe.

## Evidencia
`evidencia/compra/capturas/20-admin-ia.png` (panel de IA) · `21-panel-afiliado.png` (panel del afiliado) · `evidencia/landing/` · `docs/landing/capturas/` (todas las secciones, escritorio y celular, incluido el hub de caminos).
