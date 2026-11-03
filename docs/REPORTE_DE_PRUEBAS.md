# Reporte de pruebas (2026-11-03)

`npm run check` (actualizado con el modelo de agencias): tipos OK · **46/46 pruebas** (25 del MVP en `tests/core.test.ts` + 18 de agencias en `tests/agency.test.ts` + 3 de leads en `tests/leads.test.ts`, PGlite = Postgres real embebido) · escaneo de secretos limpio · `npm audit --omit=dev`: 0 vulnerabilidades · `next build` OK.
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


## Modelo Agencia → Cliente (2026-11-03)

**Pruebas automatizadas (21 nuevas, PGlite):** flujo completo agencia→cliente→servicio→despliegue→personalización→tarea→resultado (IA simulada); skills de agencia heredadas sin contaminar a otros clientes ni a la plantilla; propuestas; estimación de costos (null sin tarifa); **aislamiento**: la agencia B no ve ni modifica clientes, servicios, propuestas, métricas, soporte, skills ni presupuestos de A por ninguna función (`actAs`, límites, usuarios, despliegue, propuestas cruzadas), un usuario cliente no cruza a empresas hermanas ni a funciones de agencia, tokens falsos; roles de agencia; límites de plan y presupuesto de agencia; migración idempotente del MVP; leads (consentimiento, honeypot, deduplicación, tope).

**Prueba en navegador (`scripts/e2e/agency_flow.cjs`, servidor de producción, base vacía, todo ✓):** landing y formulario (bloquea sin consentimiento) · registro de agencia · identidad · industria→servicios · publicar · skill de agencia · cliente · despliegue · oficina con marca · personalización (la skill del cliente hereda el método de la agencia) · **tarea sin clave: falla de forma honesta** · conexiones sin Composio · propuesta · **agencia B → cliente de A por URL = 404; cookie de empresa falsificada ignorada; B no ve empleados ni clientes de A; usuario cliente solo ve su oficina y no entra a /agencia**.

### Verificado vs pendiente
| | Estado |
|---|---|
| Agencias, clientes, aislamiento backend, roles, límites, catálogo, skills de agencia, propuestas, métricas, soporte, marca (color/logo), landing, leads, privacidad (borrador), píxel con consentimiento | ✅ verificado (pruebas + navegador) |
| **Ejecución de una tarea real con Claude** | ⏳ **NO verificada**: sin `ANTHROPIC_API_KEY` ninguna llamada real. La prueba principal se cumple hasta «ejecutar tarea»; el resultado se verificó solo con proveedor simulado. |
| Composio y cualquier conexión real | ⏳ sin verificar |
| Meta Pixel / API de Conversiones | ⏳ píxel sin ID, no probado contra Meta; API de Conversiones sin implementar |
| Cobros, suscripciones, dominios propios, reventa con licencia, administrador de plataforma, invitaciones por correo, cambio de contraseña | ⏳ no implementado |
