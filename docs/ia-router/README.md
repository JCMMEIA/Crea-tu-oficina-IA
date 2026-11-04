# Router de IA, cuotas, afiliados y dos caminos comerciales

Rama `claude/router-ia-afiliados`. **Apilada sobre el PR #3 (Cerebro y tareas guiadas) y el PR #4 (landing v2)**: incluye sus commits a propósito, porque el router se apoya en el motor de tareas del #3 y la landing de dos caminos en el funnel del #4. Deben fusionarse primero o este PR los trae consigo.

| Documento | Contenido |
|---|---|
| [AUDITORIA_ARQUITECTURA.md](AUDITORIA_ARQUITECTURA.md) | Fase 1: cómo funciona hoy la IA, los límites, la delegación, los costos y Stripe |
| [OPENROUTER_INVESTIGACION.md](OPENROUTER_INVESTIGACION.md) | Fase 2: qué se pudo y no se pudo investigar; categorías de modelos; cómo verificar un modelo antes de activarlo |
| [ROUTER.md](ROUTER.md) | Fases 3 y 4: clasificación, selección, fallback, registro, cómo encenderlo |
| [CUOTAS_Y_LIMITES.md](CUOTAS_Y_LIMITES.md) | Fase 5: cuota de créditos y tope de gasto, reservas atómicas, alertas, sostenibilidad |
| [EMPLEADOS_Y_ROUTING.md](EMPLEADOS_Y_ROUTING.md) | Fase 6: los 41 puestos (generado) |
| [AFILIADOS.md](AFILIADOS.md) y [../afiliados/TERMINOS_BORRADOR.md](../afiliados/TERMINOS_BORRADOR.md) | Fase 7: programa de afiliados |
| [FINANZAS.md](FINANZAS.md) y [FINANZAS_TABLAS.md](FINANZAS_TABLAS.md) | Fase 9: simulación de rentabilidad |
| [PRUEBAS.md](PRUEBAS.md) | Evidencia: qué se probó y con qué (simulado vs real) |
| [CHECKLIST_VENTAS.md](CHECKLIST_VENTAS.md) | Qué falta para vender |

## Estado en una frase
El router, las cuotas, el panel `/admin/ia`, la pantalla de consumo, el programa de afiliados y la landing de dos caminos están **construidos y probados con proveedores simulados**. **No** se probó con OpenRouter ni con modelos reales (sin acceso a `openrouter.ai` ni credenciales), el catálogo de modelos está **vacío a propósito** (nadie debe activar modelos sin verificar precio y política de datos) y el router está **apagado por defecto** (`AI_ROUTER=on` lo enciende). No se publicó ningún precio ni se activó ningún cobro.
