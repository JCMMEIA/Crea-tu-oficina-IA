# Diseño de funciones futuras (NO implementadas)

Todas reutilizan lo construido; ninguna se implementa hasta verificar esta base con la IA real.

| Función | Diseño propuesto | Reutiliza | Riesgo principal |
|---|---|---|---|
| **Constructor de tareas personalizadas** | El dueño define título, empleado, preguntas (tipos ya soportados: texto, párrafo, lista) y formato de salida en un formulario; se guarda como `custom_tasks` por oficina con la misma forma que `GuidedTask`. Las secciones obligatorias se derivan de los encabezados. | `GuidedTask`, `runGuidedTask`, validación de respuestas | Instrucciones maliciosas del propio usuario: ya están aisladas como datos de su oficina; límite de largo y de nº de tareas |
| **Generador de planes por conversación** | Chat guiado que, con el Cerebro, propone un plan de 3–5 tareas del catálogo y las ejecuta una por una con aprobación. | `prefillFor`, catálogo, `guided_runs` | Costo: pedir confirmación y mostrar costo estimado antes |
| **Workflows de varios empleados** | Receta declarativa de pasos en **orden fijo** (empleado, instrucción con variables de pasos previos); cada paso es un `guided_run` hijo; el resultado final agrupa los pasos. | `createTask` con `parentTaskId`, `runWorkflow` (tope 10), `usage_events` | Errores en cascada: parar en el primer fallo y mostrar el paso |
| **Automatizaciones programadas** | Programar una tarea guiada con respuestas fijas (p. ej. contenido semanal cada lunes) con tope de gasto propio y aviso por correo. | `automations`, `/api/jobs/tick` | Gasto recurrente: presupuesto y pausa automática |
| **Integraciones externas** | Publicar/enviar solo tras aprobación humana, por conector (Meta, WhatsApp) y nunca desde una tarea guiada de texto. El resultado pasa de «propuesta» a «aprobada → ejecutada» con evidencia. | `approvals`, conectores | Es la única vía por la que algo se publicaría: exige aprobación explícita y prueba con cuentas reales |
| **Biblioteca avanzada de documentos** | Subida de PDF/DOCX/TXT, etiquetas por departamento, aviso de documentos viejos (> 90 días), embeddings solo si la búsqueda por palabras falla en pruebas reales. | `knowledge_docs`, permisos por empleado | Datos sensibles: aviso y borrado real |
