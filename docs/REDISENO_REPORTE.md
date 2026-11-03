# Rediseño de experiencia — reporte final

Complementa la [auditoría](REDISENO_AUDITORIA.md) (inventario de problemas) y la [evidencia](evidencia/rediseno/README.md) (antes/después). Se **conservaron** todas las funciones, el aislamiento entre agencias y los nombres internos del código.

## Qué cambió
| Fase | Resultado |
|---|---|
| 2 · Sin jerga | Menú y pantallas reescritos en palabras de uso: *Mi oficina · Mis clientes · Agregar empleado · Lo que saben mis empleados · Qué ofrezco · Preparar propuesta · Ver mi oficina · Conecta tus aplicaciones · Por aprobar · Historial de trabajo · Tareas automáticas · Mi marca*. Estados con icono **y** texto. Errores en lenguaje sencillo (`src/lib/lang.ts`). Roles: *Dueño · Administrador · Solo puede ver*. |
| 3 · Registro | «Vamos a crear tu negocio» (`/empezar`): 6 pasos con indicador — nombre · qué ofreces (7 tarjetas) · empleados recomendados (cada uno explica qué hace, para qué sirve, qué necesita y qué entrega) · marca (logo, nombre, colores, estilo; el estilo cambia el piso de la oficina) · conoce tu oficina (3D integrada) · primera prueba. Cada paso hace algo **real** en la base de datos. Se puede omitir y retomar. |
| 3·6 · Primera prueba | Negocio inventado «Café Luna». **Con IA conectada**: tarea real etiquetada como datos inventados. **Sin IA**: ejemplo ilustrativo rotulado («No lo hizo una inteligencia artificial ni es trabajo real»); no crea tareas. |
| 4 · Un clic | Inicio con 8 botones grandes que **hacen algo**: Agregar empleado · Enseñar a mi empleado · Crear tarea · Ver mi oficina · Agregar cliente · Preparar propuesta · Conectar WhatsApp · Pedir ayuda al asistente. Nuevas pantallas reales: `/agencia/contratar`, `/agencia/tarea`, `/agregar-empleado`. Los cambios sensibles siguen pidiendo permiso; eliminar a un empleado exige marcar una casilla. |
| 5 · Ayudas | Indicador de pasos, tarjetas con icono, consejos, ejemplos precargados («Usar el ejemplo»), ayuda junto a los campos, botones grandes (≥ 44 px), avisos de confirmación, estados vacíos con botón, aviso cuando un empleado termina (`DoneToast`), guía que se **puede omitir y volver a abrir** («❓ Ayuda»; se abre sola solo en el inicio). |
| 6 · Asistente | `/agencia/asistente`: asistente **por reglas** que dice en cada respuesta que **no es inteligencia artificial**; propone y la persona confirma con un botón («Quiero vender servicios de marketing a restaurantes» → creador de anuncios, analista de campañas y creador de contenido). |
| 7 · Conexiones | «Conecta tus aplicaciones»: 8 tarjetas + «Otras» con *para qué sirve · qué empleados la usan · qué permisos pide · estado*. Estados reales: **Conectada · Lista para conectar · Necesita que la activen (con pasos uno por uno) · Próximamente («Avísame» queda registrado)**. Nunca se finge éxito. |
| 8 · Enseña a tu empleado | 5 preguntas → **vista previa** → guardar. Crea una **versión** nueva (se puede volver atrás; el sistema de versiones se conservó). El editor completo pasa a «Modo experto». Se puede enseñar una vez a nivel agencia (clientes nuevos). Nunca quita la regla de pedir permiso. |
| 9 · Oficina | Estado con icono + texto, botones *Darle una tarea / Enseñarle / Ver resultados / Abrir su ficha*, vista **Lista** accesible (sin WebGL, móviles, lectores de pantalla), etiquetas con ✓ 🔧 🪑. Error intermitente al cambiar rápido de vista **corregido** (ver abajo). |
| 10 · Landing | «Crea tu propia agencia de inteligencia artificial, aunque nunca hayas programado» + subtítulo pedido; 3 pasos, 4 capturas reales, «para quién», «qué incluye de verdad» (y qué no), acceso anticipado. Sin promesas de ganancias. |
| 11 · Móvil | Menú con botón claro, barra inferior de accesos, letra ≥ 17 px, sin scroll horizontal, formularios cortos. |

## Medido (escritorio, mismas 26 pantallas, herramienta `scripts/e2e/ux_audit.cjs`)
| Métrica | Antes | Después | Cambio |
|---|---|---|---|
| Menciones de jerga técnica | 296 | **28** | −91 % |
| Campos de formulario visibles | 249 | **117** | −53 % |
| Palabras en pantalla | 6 193 | 5 818 | −6 % |
| Botones visibles | 184 | 180 | −2 % |
Casos: catálogo de empleados 1 107 → 259 palabras, 44 → 5 botones, 46 → 0 jerga · conexiones 39 → 0 jerga · landing 636 → 365 palabras · catálogo de servicios 49 → 3 campos visibles. **Lo que NO mejoró:** el total de palabras y botones casi no cambió (se agregaron explicaciones y acciones claras); lo que baja es la complejidad por pantalla. La jerga que queda es sobre todo importes «US$» (19) y el nombre del producto. *Nota de método:* la medición de campos/botones ignora lo que está dentro de secciones plegadas («Más opciones»), regla que no afecta la versión anterior porque no tenía secciones plegadas con formularios.

## Pruebas de usabilidad (AUTOMATIZADAS — no son pruebas con personas)
Medidas con Playwright (Chromium, 1200 px); «acciones» = clics, escrituras, casillas y selecciones de la persona simulada; el tiempo incluye la espera del servidor, **no** el de lectura o duda de una persona real.
| Escenario | Acciones | Tiempo | Resultado |
|---|---|---|---|
| 1 Crear una agencia | 5 | 1.1 s | ✅ |
| 2 Elegir servicios | 4 | 1.5 s | ✅ |
| 3 Contratar empleados | 1 | 0.7 s | ✅ |
| 4 Personalizar identidad | 3 | 0.7 s | ✅ |
| 5 Crear empresa cliente | 3 | 0.9 s | ✅ |
| 6 Enseñar una función a un empleado | 12 (5 son «Usar el ejemplo») | 2.1 s | ✅ |
| 7 Visualizar la oficina | 2 | 2.8 s | ✅ |
| 8 Asignar una tarea | 5 | 2.0 s | ✅ |
| 9 Revisar resultados | 1 | 1.1 s | ✅ |
| 10 Conectar una aplicación disponible (Telegram) | 5 | 1.6 s | ✅ |
| Extra: conocer la oficina · primera prueba · asistente | 1 · 2 · 4 | — | ✅ |
Comprobaciones de la misma batería: sin variables internas (`ANTHROPIC_API_KEY`, `COMPOSIO_API_KEY`…) en ninguna pantalla visitada · ningún botón deshabilitado en conexiones · móvil sin scroll horizontal y letra ≥ 16 px en 9 pantallas · sin 3D, la vista «Lista» funciona · guía omitible y reabrible · 0 errores de JavaScript.

## Evaluación heurística para principiantes (criterio del equipo, NO usuarios reales)
| Criterio | Evaluación |
|---|---|
| Una decisión por pantalla, con ejemplo | Cumple en el asistente; **parcial** en «Qué ofrezco», «Mi celular» y «Detalles del cliente» (aún densas) |
| Reconocer en vez de recordar (tarjetas, iconos) | Cumple |
| Estado visible sin depender del color | Cumple (icono + texto en estados y en la oficina) |
| Prevención y recuperación de errores | Cumple: vista previa, versiones, confirmación de eliminar, mensajes que dicen qué hacer |
| Lenguaje cotidiano | **Parcial:** quedan términos inevitables («inteligencia artificial», «oficina de práctica», «Enseñanza n.º») y el modo experto conserva términos técnicos |
| Ayuda siempre disponible | Cumple (guía + ayuda junto a campos) |
| «¿Un niño de 10 años podría?» | **No se puede afirmar.** No se probó con niños ni con principiantes. Crear una oficina de práctica y probar un empleado es razonable de seguir; las cuentas, los permisos y la parte comercial no son para un niño. |

## Funciones reales vs pendientes
**Reales y verificadas:** todo lo de las tablas anteriores (151 pruebas automáticas + 4 baterías de navegador).
**Pendiente / sin verificar:** pruebas con personas reales (principiantes, niños) · inteligencia artificial real (sin clave: la primera prueba muestra ejemplo ilustrativo) · conexiones reales vía Composio/OAuth y WhatsApp/Telegram reales (formatos sin contrastar con la documentación oficial) · «Publicar mi oficina» (no hay despliegue público) · auditoría formal de accesibilidad (lector de pantalla, contraste, teclado) · aviso `DoneToast` verificado solo por compilación (requiere una tarea completada con IA real) · móvil probado con un perfil emulado (iPhone 13), no en teléfonos reales · cobros/planes no activados.

## Hallazgo corregido durante la prueba
Un error de JavaScript **intermitente** (`removeChild … no es hijo de este nodo`, ≈ 2 de 18 ejecuciones) al cambiar rápido entre 3D, 2D y Lista, causado por las etiquetas de la librería 3D. Se les dio un contenedor estable y se agregó una prueba de estrés (8 ciclos rápidos); pasó 3 veces seguidas (24 ciclos, 0 errores). No se comprobó que la prueba falle con el código anterior.

## No se cambió (a propósito)
Nombres internos, rutas y tablas · versiones de skills (ahora «enseñanzas») · modo experto · términos de marca (Meta Ads, Shopify, Telegram, WhatsApp) · «Composio» aparece **una vez**, en los pasos de activación, porque quien instala necesita el nombre · no se creó «Publicar mi oficina» porque no existe esa función.
