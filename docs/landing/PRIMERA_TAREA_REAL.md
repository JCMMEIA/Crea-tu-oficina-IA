# Qué falta para que un cliente pague y ejecute su primera tarea REAL

**Límite de este informe:** no puedo ver el servidor de producción (qué versión corre, qué variables tiene). Lo que sigue separa **lo verificado en código/pruebas** de **lo que solo tú puedes confirmar o hacer**.

## Camino completo y estado
| # | Paso | Estado |
|---|---|---|
| 1 | **Precio y plan aprobados** (`PLAN_PRICE_MXN_<PLAN>`, `OFFER_PLAN`) | **Falta.** Los precios no están aprobados; Starter/Pro/Business no están conectados al cobro (hoy hay un plan a la venta) |
| 2 | **Stripe en modo de PRUEBA** en el servidor: claves `sk_test_…`, secreto del webhook, `BILLING_ENABLED=true` (`configurar_ventas.sh`) | Código listo y probado **solo con Stripe simulado**. Falta cargarlo y probar una compra real en modo prueba. Stripe real sigue apagado |
| 3 | **Correo de acceso entregado de verdad** (dominio ya verificado en Resend): clave, remitente y webhook con `configurar_correo.sh` (PR #2, **sin fusionar ni ejecutar**) y `npm run correo:diagnostico` | **Falta** ejecutarlo en el VPS y ver el correo en tu bandeja |
| 4 | **IA real verificada** (`ANTHROPIC_API_KEY`, tarifa, `npm run ai:verify`) — la tienda **no abre** si no hay una verificación reciente (`purchasesOpen`) | **Falta** confirmarlo en producción |
| 5 | **Primera tarea útil**: hoy (en `main`) la persona escribe una instrucción libre; con el **PR #3** hay Cerebro, 8 tareas con formulario, resultados descargables y consumo | **Depende de fusionar el PR #3** tras `npm run tareas:verificar` con IA real |
| 6 | **Versión correcta desplegada** en el VPS, con respaldo y reversión (`actualizar_convivencia.sh`) | **Falta** autorización y confirmar qué versión corre hoy |
| 7 | **Acceso público restringido** hasta las pruebas finales y términos/privacidad revisados | Pendiente (regla vigente) |
| 8 | **Prueba de punta a punta con una compra de prueba real**: pagar → correo → entrar → configurar el Cerebro → contratar un empleado → ejecutar una tarea guiada → descargar → ver el consumo | **No hecha** (solo hay versiones simuladas) |

## Orden recomendado
1. Fusionar #2 → configurar correo en el VPS (simulacro y real) → ver el correo en tu bandeja.
2. Fusionar #4 (segura: tienda cerrada, sin precios, estados claros).
3. Verificar la IA real (`ai:verify`, `tareas:verificar`) → fusionar #3.
4. Cargar precio y Stripe de prueba → compra de prueba real completa (paso 8).
5. Cambiar los estados en `disponibilidad.ts` a «disponible» solo con esa evidencia.
6. Abrir la tienda **solo** con tu autorización expresa (nada de Stripe real hasta entonces).

## Lo que más urge
Los pasos 3 y 4 (correo e IA reales): sin ellos nadie recibe su acceso ni puede ejecutar nada, aunque el pago funcione.
