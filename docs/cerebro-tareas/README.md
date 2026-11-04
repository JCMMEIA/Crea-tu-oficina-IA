# Cerebro Empresarial + Tareas guiadas (MVP)

Rama `claude/cerebro-tareas-guiadas`. Base de evidencia sobre el modelo de referencia: la investigación del PR #1 (`docs/investigacion-competitiva/vilma-ai/`), construida con fuentes facilitadas por el usuario que **no se pudieron abrir desde este entorno**. Aquí solo se reutiliza el *patrón* (contexto una vez → tareas guiadas → resultado descargable → consumo con límite); la identidad, los textos, el diseño y la arquitectura son propios.

## Qué se construyó
| Fase | Pieza | Dónde |
|---|---|---|
| 1 Cerebro | Lista única de campos de la ficha (13), formulario `/cerebro`, bloque que **se inyecta en cada ejecución**, vista «qué recibe cada empleado» y texto exacto enviado | `src/server/brain/index.ts`, `src/app/(app)/cerebro/page.tsx`, `src/server/tasks/index.ts` (`runTask`) |
| 2 Tareas | Catálogo de 8 tareas (3 marketing, 2 ventas, 3 atención) con preguntas, prellenado, formato de salida, secciones verificables y criterios de calidad; ejecución con el motor existente | `src/features/tasks/catalog.ts`, `service.ts`, `/tareas`, `/tareas/[clave]` |
| 3 Resultados | Tabla `guided_runs` ligada a oficina y ejecución; ver, editar (el original se conserva), restaurar y descargar `.md`/`.html` | `src/app/(app)/resultados/*`, `src/app/api/resultados/[id]/descargar` |
| 4 Consumo | Tokens · costo estimado · límites, por oficina (`/consumo`) y por cliente (`/agencia/consumo`); bloqueo comprensible | `src/server/usage/report.ts`, `/consumo`, `/agencia/consumo` |

## Arquitectura (qué se reutilizó y qué se añadió)
```
companies.profile (ya existía; ahora 3 campos más) ─┐
knowledge_docs + permisos por empleado (ya existían)─┼─► buildBrainContext ─► prompt del sistema de runTask ─► IA del servidor
employees (41 plantillas, sin duplicar) ────────────┘                              │
guided_runs (nueva) ◄── runGuidedTask ──► createTask/runWorkflow (motor existente: permisos, límites, usage_events, auditoría, aprobaciones)
```
- **No hay un segundo perfil, un segundo catálogo de empleados ni un segundo motor.** Una tarea guiada es una instrucción estructurada que entra por `createTask`; todo lo demás (límites previos, registro de consumo, auditoría) ya era del motor.
- **El contexto llega de verdad:** `runTask` agrega `<contexto_empresa>` al prompt del sistema de **toda** tarea (guiada o libre) y registra el evento `context_used` (campos y documentos). Antes de este cambio `companies.profile` se guardaba y no lo leía ningún código de ejecución.
- **Tope de contexto:** 800 caracteres por campo y 6 000 en total (≈ 1 500 tokens) para cuidar el costo.
- **Seguridad:** todo por `company_id`; el contenido del usuario se trata como datos (etiquetas de contexto neutralizadas); descargas solo para la oficina dueña (404 si no); validación estricta de respuestas (obligatorias, opciones, campos extra rechazados, largo máximo); resultado ≤ 60 000 caracteres.
- **Honestidad:** cada resultado muestra «Estado: propuesta… No se publicó, envió ni contactó a nadie». Las **secciones** pedidas se verifican por programa; los **criterios de calidad** se le piden a la IA pero los revisa la persona (no se afirma que se cumplieron).
- **Sin duplicar gasto:** repetir exactamente la misma tarea en la ventana de duplicados lleva al resultado existente.

## Datos y migración
`schema.sql` (idempotente): tabla `guided_runs` + índice. El perfil sigue en `companies.profile` (JSON) con tres claves nuevas opcionales (`valueProp`, `tone`, `rules`). Sin migración de datos.

## Qué NO cambió
Stripe, Resend, OpenClaw, precios, planes, ni la lógica de skills/aprobaciones/delegación. El único cambio al motor es añadir el bloque de contexto y el evento `context_used`.

Ver también: [PRUEBAS.md](PRUEBAS.md) · [COSTOS_Y_LIMITES.md](COSTOS_Y_LIMITES.md) · [FUTURO.md](FUTURO.md) · [PENDIENTES_LANZAMIENTO.md](PENDIENTES_LANZAMIENTO.md).
