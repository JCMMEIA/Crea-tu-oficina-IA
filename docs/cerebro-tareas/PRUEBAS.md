# Pruebas y evidencia

## Qué es real y qué es simulado (sin mezclar)
| Capa | Prueba | ¿IA real? |
|---|---|---|
| Lógica (contexto, validación, aislamiento, límites, resultados, descargas) | `tests/guided.test.ts` (19) con proveedor guionado que **captura el prompt enviado** | No (simulado a propósito para inspeccionar lo que se envía) |
| Interfaz de punta a punta con dos clientes | `scripts/e2e/tareas_guiadas.sh` (navegador real, PostgreSQL real, servidor real) | **No:** la IA es un servidor local simulado (`scripts/e2e/mocks.cjs`); sus textos llevan la marca «SIMULADO» |
| Calidad de la IA real | `npm run tareas:verificar` | **Sí**, pero **no se ejecutó**: este entorno no tiene `ANTHROPIC_API_KEY`. Sin credenciales el script se niega a correr y lo dice. |

**Por tanto: la plataforma está verificada de punta a punta con una IA simulada; la calidad de los resultados con la IA real NO está verificada todavía.** Se cierra con un comando en el VPS (ver PENDIENTES).

## Aceptación (E2E, 2 clientes) — todo ✓ en la última corrida
1 Configurar su negocio · 2 Contratar un empleado (desde la propia tarea) · 3 Elegir una tarea guiada (8 en catálogo) · 4 Ver preguntas prellenadas desde el perfil · 5 Ejecutar con contexto (el nombre del negocio llega en el prompt) · 6 Obtener un resultado con las secciones pedidas · 7 Guardarlo, editarlo y descargarlo (.md y .html; la descarga usa el texto editado; el original se conserva) · 8 Consultar consumo (1 200 + 400 tokens → US$ 0.0096, límites separados).
**Aislamiento con dos oficinas:** B se prellena con SU perfil; su resultado no menciona a Café Luna; no puede abrir ni descargar el resultado de A (404); su lista, su consumo y su Cerebro son suyos; en la base de datos cada resultado pertenece a una sola oficina.
**Límites:** al superar el presupuesto, la pantalla explica el motivo y bloquea el botón; repetir la misma tarea no gasta de nuevo.
Capturas (escritorio y celular): `evidencia/capturas/`.

## Regresión
`npm run check` completo (tsc, todas las pruebas, secretos). Los cambios en pruebas existentes se limitan a lo necesario por el nuevo bloque de contexto.

## Cómo repetirlo
```
E2E_PGURL=postgres://usuario:clave@127.0.0.1:5544 bash scripts/e2e/tareas_guiadas.sh docs/cerebro-tareas/evidencia
ANTHROPIC_API_KEY=… MODEL_INPUT_USD_PER_MTOK=… MODEL_OUTPUT_USD_PER_MTOK=… npm run tareas:verificar     # IA real (cuesta centavos)
```
