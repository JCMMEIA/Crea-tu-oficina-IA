# 05 · Workflows y tareas preconstruidas

## A. Vilma (fuente: resumen facilitado por el usuario; no verificado por mí)
- **Tareas:** plantillas estructuradas con preguntas y metodologías; pueden generar documentos guardables y descargables. — CONFIRMADO según resumen.
- **Workflows:** conectan etapas de trabajo y pueden usar el Foundation. — CONFIRMADO según resumen.
- **Cantidad:** 150+ (landing), 200+ (soporte), 120+ (búsqueda). No equivalentes; no se pueden comparar sin ver qué cuentan.
- **¿«Crear campaña» coordina automáticamente Investigador → Estratega → Copywriter → Creativo → Analista?** **NO VERIFICADO.** No se entregaron ejemplos reales ni capturas. Lo único documentado es que existen etapas conectadas; no se sabe si cada etapa la hace un agente distinto, si corre sola o si el usuario aprueba cada paso. Tratar como ANUNCIADO.

## B. Nuestro estado (VERIFICADO EN NUESTRO CÓDIGO)
- **Delegación entre empleados: funciona**, pero es *dinámica*: un empleado decide delegar con `delegate_task`; el motor ejecuta la cadena (`runWorkflow`, tope **10 tareas** por cadena, contexto y resultado parcial se traspasan). Probado en `tests/pilot.test.ts`.
- **Workflows preconstruidos: no existen.** No hay catálogo de recetas «campaña = 5 pasos». La cadena depende de que el modelo decida delegar.
- **Tareas guiadas con formulario: no existen.** El usuario escribe un texto libre (hay ejemplos de práctica, `src/server/guide/practice.ts`).
- **Resultados descargables: no existen.** No hay descarga de archivos (búsqueda de `Content-Disposition`/CSV de salida: 0 resultados); el resultado se ve en pantalla.
- **Automatizaciones programadas: existen** (`src/server/automations`).
- **Aprobaciones antes de actuar: existen** (escrituras con aprobación).

## C. Diseño propuesto
Un **workflow = receta declarativa** (JSON/TS) con: `nombre`, `formulario` (preguntas con tipo y ejemplo), `pasos[]` (empleado, instrucción con variables, entrega esperada), `aprobación` (opcional por paso), `costoEstimado` (tokens × precio del modelo, mostrado **antes** de ejecutar) y `salida` (documento Markdown descargable). Se ejecuta con el motor existente creando tareas hijas encadenadas **en orden fijo** (no a criterio del modelo), por lo que es predecible, medible y barato de probar. Reutiliza: empleados, `createTask`, `runWorkflow`, `usage_events`, `approvals`.

## D. 20 workflows originales para el lanzamiento
Costo = estimación relativa en nº de tareas (cada tarea ≈ US$0.04 con los supuestos de `06`). Dificultad: B baja, M media, A alta. Todos usan empleados que **ya existen** en nuestro catálogo.

| # | Workflow | Cadena de empleados | Tareas | Dif. | Valor | Prioridad |
|---|---|---|---|---|---|---|
| 1 | Responder reseñas y mensajes de clientes | Soporte → Supervisor | 2 | B | Alto | **P1** |
| 2 | Plan de contenido semanal para redes | Estratega → Guionista | 2 | B | Alto | **P1** |
| 3 | Campaña publicitaria (3 anuncios + público) | Investigador de mercado → Analista estratégico → Creador de anuncios | 3 | M | Alto | **P1** |
| 4 | Revisión de anuncios de Meta (qué mejorar) | Analista Meta Ads → Supervisor | 2 | M | Alto | **P1** |
| 5 | Seguimiento posventa a clientes recientes | Seguimiento posventa → Atención | 2 | B | Alto | **P1** |
| 6 | Cotización/presupuesto para un cliente | Creador de presupuestos → Analista de precios | 2 | B | Alto | **P1** |
| 7 | Respuesta a una queja con solución propuesta | Gestor de reclamaciones → Supervisor | 2 | B | Medio | **P1** |
| 8 | Resumen semanal del negocio | Supervisor general (lee tareas) | 1 | B | Alto | **P1** |
| 9 | Lista de pendientes y prioridades de la semana | Asistente ejecutiva → Coordinador de proyectos | 2 | B | Medio | P2 |
| 10 | Análisis de gastos del mes | Analista de gastos → Analista de flujo | 2 | M | Alto | P2 |
| 11 | Análisis de precios y márgenes | Analista de precios → Rentabilidad | 2 | M | Alto | P2 |
| 12 | Reabastecimiento de inventario | Controlador de inventario → Analista de proveedores | 2 | M | Alto | P2 |
| 13 | Análisis de competidores | Analista de competidores → Analista estratégico | 2 | M | Medio | P2 |
| 14 | Vacante y filtro de candidatos | Reclutamiento → Analista de desempeño | 2 | B | Medio | P2 |
| 15 | Guion de video corto con ganchos | Guionista → Director creativo | 2 | B | Medio | P2 |
| 16 | Secuencia de mensajes de venta (WhatsApp) | Vendedor conversacional → Supervisor | 2 | M | Alto | P2 |
| 17 | Plan de lanzamiento de producto | Investigador → Estratega → Coordinador de proyectos | 3 | M | Alto | P3 |
| 18 | Informe de satisfacción de clientes | Analista de satisfacción → Atención | 2 | B | Medio | P3 |
| 19 | Capacitación para el equipo (plan de 30 días) | Coordinador de capacitación → Cultura | 2 | B | Bajo | P3 |
| 20 | Calendario de campañas del trimestre | Estratega → Coordinador de proyectos → Analista | 3 | A | Medio | P3 |

Criterio de prioridad: P1 = utilidad alta, ≤3 tareas, sin conexiones externas obligatorias (se puede entregar un resultado útil el día uno aunque el cliente no conecte nada); P2 requiere datos del cliente (CSV/documentos); P3 aporta menos o requiere más pruebas. **Ninguno promete publicar o gastar dinero:** entregan documento para aprobación.
