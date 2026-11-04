# Integración segura de los PR #3 y #4 (sin fusionar)

## Resultado de la revisión de compatibilidad
Se probó en una rama **temporal local** (ya eliminada, nunca subida): `main` + PR #4 + PR #3.

| Comprobación | Resultado |
|---|---|
| Conflictos de texto (git) | **Ninguno.** La fusión fue automática. Ningún archivo es modificado por ambos PR (intersección vacía). |
| `tsc` sobre el árbol fusionado | Limpio |
| Pruebas automáticas (árbol fusionado) | **285 pasan**, incluida la red de seguridad nueva (`tests/landing.test.ts`, bloque «integración con el catálogo real de tareas guiadas») que **solo corre cuando el catálogo del PR #3 existe** y verifica que las 8 tareas de la landing coinciden con él (claves, empleados, áreas) |
| E2E de compra (Stripe/Resend/IA simulados) | 64/64 |
| E2E de tareas guiadas (dos clientes) | sin fallos |
| E2E de la landing (incluye axe y las páginas nuevas) | 104/104 |

## Dónde se tocan sin chocar (riesgos semánticos)
| Tema | Riesgo | Mitigación |
|---|---|---|
| **Estado de las funciones** | La landing dice «En revisión» para Cerebro, tareas, resultados y consumo (lo que construye el PR #3). Si el #3 se fusiona y se verifica y nadie actualiza la landing, quedaría desactualizada (conservadora, no engañosa) | Un solo archivo: `src/features/funnel/config/disponibilidad.ts`. La prueba exige que sigan «en revisión» hasta cambiarlas **a propósito** |
| **Las 8 tareas** | La landing tiene su propia copia de títulos/ejemplos (`config/tareas.ts`); el PR #3 tiene el catálogo real | La prueba de integración compara claves, empleados y áreas. Mejora posterior: que la landing lea el catálogo en vez de copiarlo |
| **Capturas** | 4 imágenes de `public/landing/` salen del módulo del PR #3 (con datos de ejemplo); si su interfaz cambia, quedan viejas | Regenerarlas con `scripts/e2e/tareas_guiadas.sh` tras cambios de interfaz |
| **Esquema de base de datos** | Solo el #3 agrega una tabla (`guided_runs`), con `CREATE … IF NOT EXISTS` (aditivo) | Sin migraciones destructivas; reversión = revertir el commit |
| **Estilos** | La landing usa su propio `funnel.css`; el #3 usa clases del panel | Sin solapamiento |
| **Caché de tipos de Next** | Alternar ramas deja `.next/types` viejo y `tsc` falla con rutas inexistentes | Borrar `.next` antes de `tsc` al cambiar de rama |
| **PR #5** | Es un **prototipo apilado** que ya incluye #3 y #4 | No fusionarlo: ver `docs/integracion/PLAN_ROUTER_Y_AFILIADOS.md` |

## Orden recomendado (cada paso: `npm run check` + los 3 E2E + capturas)
1. **#2 (configurador de correo)**: independiente; se ejecuta en el VPS con simulacro primero.
2. **#4 (landing)**: **no depende del #3** y ya etiqueta lo que no está disponible; es seguro fusionarlo antes. Tienda cerrada, sin precios.
3. **#3 (Cerebro y tareas guiadas)**: tras verificar la IA real (`npm run tareas:verificar`).
4. **Actualizar `disponibilidad.ts`** (y la landing) solo después de ese paso.
Cada PR se puede revertir por separado. Antes de desplegar: respaldo y `actualizar_convivencia.sh` (con reversión), con tu autorización.

## Qué NO se hizo
No se fusionó, cerró ni modificó ningún PR; no se desplegó; no se tocó Stripe, Resend, Anthropic ni OpenClaw.
