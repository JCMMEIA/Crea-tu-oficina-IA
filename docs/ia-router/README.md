# Router de modelos de IA y cuotas (rama `claude/router-ia-solo`)

> **Actualización 2026-11-04:** ver [SELECCION_FINAL_2026-11-04.md](SELECCION_FINAL_2026-11-04.md) (modelos elegidos, precios reales, compatibilidad verificada con la documentación oficial).

**Rama limpia apilada solo sobre el PR #3** (Cerebro y tareas guiadas): contiene únicamente el router, las cuotas, el panel `/admin/ia`, la pantalla de consumo y las herramientas para la prueba real. **No** incluye afiliados ni landing (esos viven aparte: PR #4 para la landing; el programa de afiliados está pendiente de plan). Se extrajo del prototipo PR #5 (ver `docs/integracion/DEPENDENCIAS_PR5.md`).

| Documento | Contenido |
|---|---|
| [AUDITORIA_ARQUITECTURA.md](AUDITORIA_ARQUITECTURA.md) | Cómo funciona hoy la IA, límites, delegación, costos |
| [OPENROUTER_INVESTIGACION.md](OPENROUTER_INVESTIGACION.md) | Estado de la investigación y qué se necesita para completarla |
| [SELECCION_MODELOS.md](SELECCION_MODELOS.md) | Cómo elegir el modelo gratuito, el económico y el de respaldo (criterios, fuente de datos, ficha) |
| [COMPATIBILIDAD_OPENROUTER.md](COMPATIBILIDAD_OPENROUTER.md) | Qué verifica la prueba de contrato contra nuestro router y qué NO |
| [PRUEBA_REAL_OPENROUTER.md](PRUEBA_REAL_OPENROUTER.md) | Diseño de la prueba de calidad y costos con las 8 tareas guiadas |
| [CREDENCIALES_Y_PRESUPUESTO.md](CREDENCIALES_Y_PRESUPUESTO.md) | Credenciales necesarias y presupuesto pequeño |
| [CONFIGURAR_OPENROUTER_VPS.md](CONFIGURAR_OPENROUTER_VPS.md) | Procedimiento para cargar la clave en el servidor sin exponerla |
| [ROUTER.md](ROUTER.md) · [CUOTAS_Y_LIMITES.md](CUOTAS_Y_LIMITES.md) · [EMPLEADOS_Y_ROUTING.md](EMPLEADOS_Y_ROUTING.md) · [FINANZAS.md](FINANZAS.md) | Arquitectura, cuotas, 41 puestos y simulación |
| [PRUEBAS.md](PRUEBAS.md) · [CHECKLIST_VENTAS.md](CHECKLIST_VENTAS.md) | Evidencia y qué falta |

## Estado en una frase
Construido y probado con proveedores **simulados**. **`AI_ROUTER` está apagado** y el catálogo de modelos está **vacío a propósito**: no se activa nada hasta tener clave, presupuesto y modelos verificados (`npm run ia:preparado` lo comprueba). **openrouter.ai no es alcanzable desde el entorno de desarrollo**, así que no hay precios ni modelos reales documentados todavía.
