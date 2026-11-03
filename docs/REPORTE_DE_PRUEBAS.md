# Reporte de pruebas (2026-11-03)

`npm run check`: tipos OK · **25/25 pruebas** (`tests/core.test.ts`, PGlite = Postgres real embebido) · escaneo de secretos limpio · `npm audit --omit=dev`: 0 vulnerabilidades · `next build` OK.
Además, una prueba de humo en navegador (Playwright, servidor de producción): registro → perfil → contratar → ficha → tarea → skill v2 → conexiones → vista móvil sin scroll horizontal.

**Importante:** las pruebas usan un proveedor de IA y un adaptador Composio **simulados** (`tests/helpers.ts`, no existen en la app). Prueban la lógica del producto, **no** que Claude ni Composio respondan.

| # | Prueba obligatoria | Resultado | Tipo |
|---|---|---|---|
| 1 | Crear empresa nueva | ✅ pasa (y en navegador) | Real |
| 2 | Seleccionar departamentos | ✅ solo existen los contratados; personalizados | Real |
| 3 | Agregar empleados | ✅ permisos iniciales solo lectura; duplicar/pausar | Real |
| 4 | Editar una skill | ✅ modo principiante, versión, diff (en el servicio) | Real |
| 5 | Guardar y recuperar | ✅ versiones, restaurar, exportar/importar; plantilla intacta | Real |
| 6 | Ejecutar una tarea real | 🧪 con IA simulada; **sin clave no se ejecuta** (verificado en navegador: falla con mensaje claro) | Simulación |
| 7 | Historial | ✅ eventos, costo, versión de skill por tarea | Real |
| 8 | Conectar y desconectar app real | 🧪 solo con adaptador falso; ⏳ cuenta real | Simulación |
| 9 | Bloquear no autorizado | ✅ escritura no se ejecuta sin aprobación; rechazo no ejecuta; sin permiso/conexión no hay herramienta; roles; documento malicioso delimitado y restringido por empleado | Real (lógica) |
| 10 | Aislamiento de dos empresas | ✅ lecturas, escrituras, ejecución, duplicado y conexiones | Real |
| 11 | Límites de consumo | ✅ presupuesto, tope diario, sin tarifa, duplicados, pausado, profundidad/cadena | Real |
| 12 | Recuperación de fallos | ✅ reintentos transitorios, fallo→reintento manual, timeout | Simulación del fallo |
| + | Automatizaciones (intervalo/evento/condición/reintentos/alerta), login (bloqueo, hash) | ✅ | Real |

## No probado / pendiente
Llamada real a Claude · HTTP real a Composio · cualquier integración con cuenta real · chat con agentes · carga de archivos · rendimiento/carga · accesibilidad completa · despliegue · Postgres de red (`pg`; solo PGlite se ejercitó) · modo oscuro revisado visualmente.
