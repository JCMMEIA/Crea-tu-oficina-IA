# Reporte de pruebas (2026-11-03)

`npm run check` (actualizado con el modelo de agencias): tipos OK · **151/151 pruebas** (25 del MVP en `tests/core.test.ts` + 18 de agencias en `tests/agency.test.ts` + 3 de leads en `tests/leads.test.ts`, PGlite = Postgres real embebido) · escaneo de secretos limpio · `npm audit --omit=dev`: 0 vulnerabilidades · `next build` OK.
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


## Visualiza tu Oficina 3D (2026-11-03)

`npm run check`: **60/60 pruebas** (46 anteriores + 14 de `tests/office3d.test.ts`), tipos limpios, sin secretos, 0 vulnerabilidades. El flujo comercial anterior (`scripts/e2e/agency_flow.cjs`) se volvió a correr completo: sin regresiones.

**E2E en navegador (`scripts/e2e/office3d.cjs`, 38 comprobaciones, todo ✓):** 1) cliente sin empleados · 2) un departamento · 3) múltiples departamentos (conteos = base de datos) · 4) marketing 8 y ventas 5 · 5) clic en empleado en el canvas 3D real (detalle + 3 accesos) · 6) clic en departamento (empleados, servicios, estado) · rotar/zoom cambian la cámara, restablecer, alternar 2D/3D · 7) móvil sin scroll horizontal y toque sobre un empleado · 8) escritorio 1440 · 9) sin WebGL → 2D · 9b) falla al crear el 3D → 2D con aviso · aislamiento (`?cliente=` de otra agencia, usuario cliente) · el panel normal sigue funcionando · 0 errores de JavaScript. Tiempo a 3D listo ≈ 2 s en Chromium con WebGL por software.

| | Estado |
|---|---|
| Vista 3D, fallback 2D, tres ubicaciones, datos reales, aislamiento, móvil emulado | ✅ verificado |
| GPU real, Safari/Firefox, móviles físicos, dispositivos de gama baja | ⏳ no probado |
| Animaciones, salas extra, estilos premium, recorridos guiados | ⏳ solo la base extensible (fase 2) |


## Mensajería: WhatsApp y Telegram (2026-11-03)

`npm run check`: **128/128 pruebas** (60 previas + 54 en `tests/messaging.test.ts` + 14 en `tests/channels.test.ts`), tipos limpios, sin secretos, 0 vulnerabilidades. Regresión: `agency_flow` y `office3d` (E2E) siguen pasando.

### Qué es REAL, qué es SIMULADO
| Elemento | Real | Simulado |
|---|---|---|
| Lógica de vinculación, coordinador, aprobaciones, cola, bandeja, límites, aislamiento, revocación, base de datos (PGlite) | ✅ ejecutada de verdad | — |
| Webhooks HTTP (rutas Next en servidor de producción), autenticación por secreto/HMAC, `after()` + cola | ✅ E2E por HTTP real (`scripts/e2e/messaging.cjs`) | — |
| **Telegram / WhatsApp / Meta (el servicio externo)** | ❌ **nunca se contactó** | Canales falsos en pruebas unitarias; en la E2E, un servidor local que imita `sendMessage` (`TELEGRAM_API_BASE`) |
| Claude (IA) | ❌ no hay clave | Proveedor guionado en pruebas; en la E2E **sin proveedor**: la tarea falla con aviso honesto |
| Composio / conectores | ❌ | `FakeAdapter` en pruebas |
| Adaptadores (URL, cabeceras, cuerpo) | Probados con `fetch` simulado | **Formato sin verificar** contra la documentación oficial (dominios bloqueados en la sesión) |

### Los 12 casos pedidos
1 vinculación autorizada (Telegram y WhatsApp, `/start`, caducidad, un solo uso, canal equivocado, consentimiento, hash en BD, sin código en registros) · 2 desconocido rechazado (sin datos, 1 respuesta/h, bloqueo por 5 intentos) · 3 mensaje válido (ayuda con nombre/bienvenida de la agencia) · 4 selección de empresa (pregunta, número, nombre, inexistente, una sola) · 5 creación de tarea (empresa y empleado correctos, `createTask`, `channel_tasks`, datos faltantes) · 6 resultado (aviso + `ver resultados`) · 7 error (falla, sin IA, presupuesto agotado) · 8 aprobación/rechazo (código por acción, «sí/ok» no aprueban, dos pasos, vencimiento, aprobación caducada, permisos re-comprobados, código de otra persona, bloqueo por intentos, aprobaciones creadas en la web) · 9 duplicados (mismo update/wamid, tarea idéntica, trabajo en cola) · 10 separación entre agencias (no ve, no estado, no resultados, no empresa ajena; marca por agencia; alcance de revocación) · 11 revocación (corta acceso, cancela envíos/aprobaciones/ejecución, re-vinculación, revocación por agencia, pérdida de acceso inmediata) · 12 límites (presupuesto, 15 msg/min, 30 salientes/h, avisos/día de agencia).
Además: webhooks (401 sin/mal secreto, firma alterada, verificación GET, grupos/bots/estados ignorados), preferencias, ventana de 24 h de WhatsApp con/sin plantilla, resumen diario, alerta del 80 %, reintentos, cola, cifrado de credenciales por agencia, validación de adjuntos, inyección en el texto del chat.

**E2E por HTTP (15 comprobaciones ✓):** consentimiento obligatorio, código en pantalla y no en la URL, enlace `t.me/<bot>?start=`, webhook 401, chat desconocido, vinculación, código no reutilizable, empresas solo de su agencia, tarea en lenguaje natural con webhook duplicado (1 sola), cola ejecuta con el motor existente y avisa el error, cliente de otra agencia «no encontrado», identidad enmascarada e historial en `/celular`, revocación desde la web, móvil.

### Hallazgos durante las pruebas (corregidos)
(1) Con la base embebida, rutas y páginas abrían **dos instancias** de PGlite → la página no veía lo que escribía el webhook (en Postgres real no ocurre); ahora la conexión es única por proceso. (2) La elección de empleado era demasiado tímida; se ponderó mejor. (3) Un código de vinculación enviado desde un chat ya vinculado se interpretaba como tarea. **Sin explicar:** en 1 de 4 ejecuciones de la E2E 3D apareció un error de JavaScript de página que no se reprodujo en 5 ejecuciones posteriores.

### Pendiente / requiere configuración
Probar un envío y recepción REALES (credenciales de bot de Telegram; cuenta Meta + número + token + plantilla aprobada para WhatsApp) y contrastar el formato de las APIs con su documentación vigente · costos de WhatsApp por conversación (verificar tarifa) · interpretación con IA del lenguaje natural · voz con transcripción y archivos (solo validación preparada) · bots/números propios por agencia · envío del resultado como documento · cola con servicio de trabajos dedicado (hoy: BD + `after()` + cron) · limitación por IP en webhooks.


## Rediseño de experiencia (2026-11-03)

`npm run check`: **151/151 pruebas** (128 previas + 23 en `tests/redesign.test.ts`: lenguaje sencillo, «Enseña a tu empleado», tarjetas y explicaciones de los 41 empleados, asistente por reglas, estados reales de las aplicaciones, práctica con datos inventados, los 6 pasos del asistente con base real, la oficina de práctica fuera de los límites del plan y su aislamiento entre agencias). Tipos limpios, sin secretos, 0 vulnerabilidades.
**Baterías de navegador (todas ✓ con la versión final):** `redesign.cjs` (10 escenarios + landing + guía + asistente + móvil + sin 3D + sin variables internas, 0 errores JS) · `agency_flow.cjs` (23 comprobaciones: flujo y aislamiento entre agencias) · `office3d.cjs` (incluye prueba de estrés de cambio de vista) · `messaging.cjs`. Las baterías antiguas se actualizaron a los textos nuevos. Detalle y números: [REDISENO_REPORTE.md](REDISENO_REPORTE.md).
