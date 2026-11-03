# Rediseño de experiencia — Fase 1: auditoría (antes de modificar código)

Fecha: 2026-11-03. Método: (a) 26 pantallas capturadas con datos de demostración (`docs/evidencia/rediseno/antes/`), (b) medición automática con `scripts/e2e/ux_audit.cjs` (palabras, campos, botones, jerga como palabras completas), (c) lectura del texto y los formularios. **No se hicieron pruebas con personas**: lo que sigue es evaluación heurística.

## Línea base (escritorio, 26 pantallas)
| Métrica | Valor |
|---|---|
| Menciones de jerga técnica | **296** (IA 75 · «agente» 44 · Composio 32 · US$/USD 30 · «skill» 29 · owner 22 · CRM 10 · «versión» 10 · plantilla 9 · API 8 · tarifa 6) |
| Palabras en pantalla | 6 193 (la peor: catálogo de empleados, **1 107 palabras**, 44 botones, 46 menciones de jerga) |
| Campos de formulario | 249 (catálogo de servicios: **49 campos** en una sola pantalla) |
| Scroll horizontal en móvil | ninguno (esto ya estaba bien) |

## Inventario de problemas y prioridad
**P0 — impiden que un principiante avance**
| # | Problema | Dónde | Solución prevista |
|---|---|---|---|
| 1 | Tras registrarse se aterriza en un panel con 6 cifras y una lista de 10 pasos técnicos; no hay un camino guiado «crear → elegir → probar» | `/agencia` | Asistente visual «Vamos a crear tu negocio» (6 pasos) + una sola «siguiente acción» grande |
| 2 | La pantalla de conexiones muestra **21 botones «No disponible»**, «vía Composio», `COMPOSIO_API_KEY` | `/conexiones` | «Conecta tus aplicaciones»: 9 tarjetas, estado real en palabras («Lista para conectar», «Necesita que la activen», «Próximamente»), pasos uno por uno |
| 3 | Mensajes que exponen variables internas (`ANTHROPIC_API_KEY`, Composio, tarifas) | panel, tareas, conexiones, celular | Mensajes en lenguaje cotidiano + qué hacer; el detalle técnico queda en la documentación |
| 4 | Editar «skill»: instrucciones del sistema, procedimientos, herramientas autorizadas (claves), importar/exportar JSON | `/empleados/:id/skill` | «Enseña a tu empleado» (5 preguntas + vista previa); el editor técnico pasa a «Modo experto» |
| 5 | Catálogo de empleados: 41 fichas en una página, con «Skill incluida», «Permisos», «Conexiones» | `/construir` paso 3 | Empleados recomendados según el servicio elegido, con 4 frases: qué hace, para qué sirve, qué necesita, qué entrega |
| 6 | No hay forma de probar el flujo sin cuentas reales ni IA | todo | «Haz tu primera prueba» con datos inventados, etiquetada como demostración |

**P1 — confusión frecuente**
| # | Problema | Dónde | Solución |
|---|---|---|---|
| 7 | Menú con 10+ opciones en jerga («Soporte y aprobaciones», «Skills y agentes», «Catálogo de servicios», «Identidad visual») | barra lateral | Menú corto en palabras de uso: Mi oficina · Mis clientes · Qué ofrezco · Mis empleados · Por aprobar · Mi marca · Conecta tus aplicaciones |
| 8 | Servicios: 49 campos, «borrador/publicado», «costo de IA estimado», «tareas estimadas/mes» | `/agencia/servicios` | Tarjetas de servicios; los campos de costo van en «Más opciones» |
| 9 | Estados vacíos fríos («Aún no hay…») | varias | Estados vacíos con invitación y un botón grande |
| 10 | Botones ambiguos: «Entrar a su oficina», «Contratar sus agentes en esta oficina», «Convertir en instrucciones y guardar» | clientes, skills | Verbos claros: «Abrir su oficina», «Agregar empleados», «Guardar lo que le enseñé» |
| 11 | Roles en inglés/técnicos (owner, viewer, admin) | usuarios, celular | «Dueño», «Solo ver», «Administrador» |
| 12 | Oficina 3D: estado solo por color; sin acciones directas | `/oficina-3d` | Iconos + texto de estado; «Darle una tarea», «Ver resultados»; vista de lista accesible |
| 13 | Sin guía, sin ayuda junto a los campos, sin forma de volver a ver el tutorial | todo | Guía que se puede omitir y volver a abrir, consejos cortos, ayuda por campo |

**P2 — pulido**
14 «Hora del servidor» y «Plan Avanzado, hasta 100 clientes…» en el panel · 15 tabla de costos con US$ y 4 decimales · 16 «Historial de trabajo» llamado «Actividad» y «Aprobaciones» sin explicación · 17 navegación móvil que reparte 10 enlaces en filas · 18 landing con 636 palabras y lenguaje de plataforma («marca blanca», «skills»).

## Qué NO se cambia
Nombres internos de código, rutas técnicas, tablas, adaptadores, versiones de skills, aislamiento entre agencias, ni los permisos y confirmaciones: se simplifica lo que ve la persona, no la arquitectura.
