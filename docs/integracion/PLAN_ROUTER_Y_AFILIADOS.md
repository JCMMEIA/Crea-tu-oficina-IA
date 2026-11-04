# Plan de integración: router de modelos (OpenRouter) y programa de afiliados

## Una corrección necesaria
Dijiste que la instrucción sobre OpenRouter y afiliados **todavía no se había ejecutado**. **Sí se ejecutó**: existe el **PR #5** (`claude/router-ia-afiliados`), un prototipo completo con router, cuotas, panel de IA, afiliados y landing de dos caminos. **No lo uso en esta rama** (el PR #4 no contiene nada de ese código; hay una prueba que lo vigila) y **no hay que fusionarlo**: además trae los commits de #3 y #4. Opciones para ti: (a) **cerrarlo** y rehacer por fases desde este plan, (b) **conservarlo como referencia** para extraer piezas, (c) revisarlo como base. Recomiendo (b). No lo cierro yo (regla: no cerrar PR).

## Principios
Reutilizar lo que ya existe, entregar en pasos pequeños **detrás de interruptores apagados**, medir antes de decidir y no cambiar el comportamiento actual hasta que cada paso esté verificado con datos reales.

## Qué ya tenemos para reutilizar
| Necesidad | Ya existe |
|---|---|
| Punto único de llamadas a IA | `runTask` → `provider.complete` (`src/server/tasks`), `verifyAi` |
| Registro de consumo | `usage_events` y `tasks` (tokens y costo por tarea) |
| Límites | `assertWithinLimits` (presupuesto por empresa/oficina, por hora, por empleado) |
| Auditoría y panel de operador | `audit_log`, `requireOperator` y el patrón de `/admin/*` |
| Planes y pagos | `plans.ts`, `checkout_intents` → `orders` → `office_rights`, `invoices` |
| Catálogo de empleados y tareas | 41 plantillas + identidades; catálogo de 8 tareas del PR #3 |
| Acceso por enlace y leads | `access_links`, tabla `leads` (ya usada para las listas de interés) |

## A. Router de modelos — fases
| Fase | Qué | Salida verificable | Riesgo si se omite |
|---|---|---|---|
| 0 | **Datos reales:** verificar la IA actual, medir tokens y costo por tarea con `tareas:verificar`; permitir `openrouter.ai` y registrar modelos con precio y política **verificados** | Tabla de costos reales | Decidir con supuestos |
| 1 | **Solo telemetría:** registrar modelo, proveedor, tokens, costo, latencia e intentos por llamada (sin cambiar de modelo) | Panel de consumo real | No saber qué se gasta |
| 2 | **Cuota por cuenta** (créditos + tope USD) con reservas atómicas | Pruebas de concurrencia | Gasto sin control |
| 3 | **Catálogo y panel `/admin/ia`** con validación y auditoría | Modelos editables sin desplegar | Cambios sin trazabilidad |
| 4 | **Modo sombra:** el router calcula qué modelo elegiría pero **no actúa**; se compara con el real | Informe de ahorro/calidad estimados | Activar a ciegas |
| 5 | Activar **solo nivel A con datos públicos** y un proveedor | Costos y fallos reales | Enviar datos a modelos no aptos |
| 6 | Niveles B/C, fallback controlado y modelos de pago | Pruebas de fallo y presupuesto | Escalar costos |
Guardas permanentes: nada gratuito recibe información interna/confidencial salvo política verificada; nunca se escala a un modelo que supere el presupuesto; sin bucles; las acciones externas no se repiten.
**Decisiones tuyas:** qué proveedor(es), tope de gasto mensual por cuenta, si se ofrece «retención cero» como promesa, y qué modelos gratuitos (si alguno) se aceptan.

## B. Afiliados — fases
| Fase | Qué | Nota |
|---|---|---|
| 0 | **Decisiones y legal:** comisión, ventana, retención, mínimo de pago, contrato, tratamiento fiscal | Sin esto no se abre nada |
| 1 | **Solo seguimiento (sin dinero):** código → cookie → intención de compra → pedido; informe interno | Valida atribución con compras de prueba |
| 2 | **Libro de comisiones** calculado desde `invoices` (solo lectura, idempotente, tope de cobros) | Reporte para el operador |
| 3 | **Reembolsos y contracargos de Stripe** conectados (hoy no llegan) | Hace correctas las comisiones |
| 4 | **Liquidaciones** mensuales auditables y pago | Primer dinero real |
| 5 | **Panel del afiliado y landing** con condiciones publicadas | Aislado: sin datos de clientes |
**Hoy en la landing:** el camino «Quiero ser afiliado» lleva a una página de **lista de interés** (tabla `leads`), sin enlaces, comisiones ni promesas.
**Decisiones tuyas:** porcentaje y duración, quién puede ser afiliado, cómo se paga, y revisión del contrato.

## Servicio «Nosotros administramos tu oficina»
Solo una **solicitud de diagnóstico** por contacto (tabla `leads`, `landing=/servicio-gestionado`). No hay proceso ni precio definidos. No se construye una tercera plataforma.

## Si decides aprovechar el PR #5
Extraer por fases (1→6 y 1→5), cada una en su PR pequeño, con las pruebas que ya trae (319 en total en esa rama), y **nunca** fusionarlo completo.
