# Prueba real de calidad y costos con las 8 tareas guiadas

**Principios:** solo datos públicos e inventados (Café Luna): ningún dato real de clientes sale hacia ningún modelo. Presupuesto total pequeño y con topes **en cada capa**. Producción no se toca: el router sigue **apagado** (`AI_ROUTER=off`); las pruebas usan scripts que llaman a los proveedores directamente. Nada de esto se ha ejecutado todavía.

## Fases
| Fase | Qué | Costo | Quién/dónde |
|---|---|---|---|
| **P0** | `npm run ia:catalogo` → preselección de candidatos; verificación manual de política, precio y límites; ficha en `SELECCION_MODELOS.md` | **0** (sin clave) | donde `openrouter.ai` sea alcanzable |
| **P1** | Registrar los 3 modelos en `/admin/ia` (verificados, **inactivos**); `npm run ia:preparado` | 0 | VPS |
| **P2** | `npm run ia:humo -- --modelo ID --precio-in X --precio-out Y --max-usd 0.01 --confirmo` por modelo (1 llamada de ≈ 100 tokens) | ≤ US$0.01 por modelo | VPS (la clave solo existe allí) |
| **P3** | `npm run ia:evaluar -- modelos.json --dry-run` (muestra el máximo posible) y luego `--max-usd 1`: **3 modelos × 8 tareas × 1** = 24 llamadas | ≤ **US$1** (tope duro) | VPS |
| **P4** | Escenario de fallo en un entorno de prueba: forzar un id de modelo inexistente o agotar el límite del gratuito y comprobar el fallback, los registros (`ai_calls`) y las cuotas; router encendido **solo en ese proceso** | ≤ US$0.20 | entorno de prueba, no producción |

## Qué mide `ia:evaluar` (automático) y qué se revisa a mano
Automático: secciones pedidas completas, español, **cifras nuevas** que no estaban en la entrada (posible invento), si **afirma haber publicado o enviado**, tokens, **costo real**, latencia. A mano (hoja en el informe): utilidad 1–5, tono 1–5, ¿se podría enviar tal cual?

## Criterios de aceptación (por modelo)
| | Gratuito | Económico | Avanzado |
|---|---|---|---|
| Secciones completas | ≥ 90 % de las 8 | ≥ 90 % | 100 % |
| «Afirma acción no hecha» | 0 | 0 | 0 |
| Cifras inventadas | ≤ 1 caso en 8 | ≤ 1 caso | 0 |
| Utilidad humana (promedio) | ≥ 3.5 | ≥ 4.0 | ≥ 4.5 |
| Latencia p95 | < 90 s | < 60 s | < 60 s |
| Errores no transitorios | ≤ 10 % | ≤ 5 % | ≤ 5 % |
| Costo real vs estimado | n/a | dentro de ±50 % | dentro de ±50 % |
Además: el costo reportado por el proveedor (`usage.cost`) coincide con el panel de OpenRouter (±5 %); en la actividad de OpenRouter, ninguna llamada fue atendida por un proveedor que contradiga la política elegida; y el fallo forzado de P4 termina en otro modelo **sin superar el tope**.

## Costo máximo (cómo se calcula; los números dependen de los modelos elegidos)
Por llamada: `(tokens_entrada × precio_entrada + 1 800 × precio_salida) / 1 000 000`. El script lo calcula **antes** de llamar y se detiene por sí solo al llegar al tope real acumulado. Ejemplo de forma (precios **inventados** solo para ilustrar): con entrada US$0.2/M y salida US$0.8/M ≈ US$0.002 por llamada → 8 tareas ≈ US$0.015; con US$3/M y US$15/M ≈ US$0.03 por llamada → 8 tareas ≈ US$0.25. **Con precios reales se recalcula con `--dry-run`.**

## Entregable de la prueba
`docs/ia-router/EVALUACION_REAL.md` (tabla con costo y latencia por modelo y tarea) + decisión por espacio (gratuito, económico, avanzado) en `SELECCION_MODELOS.md`, con fecha. Solo entonces se discute encender el router en un piloto.
