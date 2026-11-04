# Compatibilidad de nuestro router con OpenRouter

**Método:** un servidor HTTP local imita el contrato **supuesto** (formato compatible con OpenAI) y `tests/openrouter_contrato.test.ts` (9 pruebas) verifica nuestro adaptador y el router sobre él. **Esto prueba nuestro código contra ese contrato; NO prueba que OpenRouter real se comporte así.** La columna «verificación real» queda para la prueba real.

| Aspecto | Qué hace nuestro adaptador | Origen de la suposición | Probado (contrato local) | Verificación real |
|---|---|---|---|---|
| Endpoint | `POST {base}/chat/completions` (base `https://openrouter.ai/api/v1`, configurable) | Interfaz compatible con OpenAI | ✔ | Pendiente |
| Autenticación | `Authorization: Bearer <clave>`; la clave nunca aparece en errores, base de datos ni auditoría | Estándar | ✔ | Pendiente |
| Mensajes y herramientas | `system` + historial; `tools` como funciones; `tool_calls` ↔ nuestras llamadas; resultados como mensajes `tool` | Interfaz OpenAI | ✔ | Pendiente (probar con un modelo que admita herramientas) |
| Límite de salida | `max_tokens` | Estándar | ✔ | Pendiente |
| Contabilidad de uso | `usage: { include: true }`; costo del proveedor solo si `usage.cost` es **número**; si no, el router estima con el precio del catálogo y marca `cost_source=estimado` | **No confirmado** (no se pudo leer la doc) | ✔ (ambos casos) | **Pendiente: comprobar que `cost` llega y coincide con el panel de OpenRouter** |
| Privacidad | interna → `provider.data_collection="deny"`; confidencial → además `provider.zdr=true`; siempre `allow_fallbacks=false` | `data_collection` y `zdr`: fragmento de la doc; `allow_fallbacks`: memoria | ✔ (se envían) | **Pendiente: confirmar en la actividad de OpenRouter qué proveedor atendió y que respeta la política** |
| Errores | 401/403 → clave rechazada; 402 → sin saldo; 400 → solicitud inválida; **408/429/5xx/red/respuesta vacía → transitorio** → el router pasa al siguiente modelo | Códigos HTTP estándar | ✔ | Pendiente (provocar un 429 en un gratuito) |
| Límites de modelos gratuitos | Un 429 es transitorio y dispara el fallback; el router **no** reintenta el mismo modelo en la misma llamada | 20/min y 50–1 000/día según fuentes de terceros | ✔ (429) | Pendiente |
| Modelos con sufijo `:free` y otros ids | Se pasan tal cual como `model_id` | Convención conocida | ✔ | Pendiente |
| Salida JSON (`response_format`) | **No se usa todavía** (`needsJson` es falso en las 8 tareas) | — | — | Pendiente si se añaden tareas con JSON |
| `models` (fallback del lado de OpenRouter), `order`/`sort`, `max_price` | **No se usan:** el router decide el orden y el presupuesto. `max_price` podría ser una segunda barrera de costo | — | — | Evaluar con la doc |
| Streaming | No se usa | — | — | — |
| Encabezados opcionales (`HTTP-Referer`, `X-Title`) | Se envía `X-Title` | Opcionales | ✔ | Pendiente |

## Compatibilidad con el router (verificada con proveedores simulados, `tests/router.test.ts`)
Nivel/sensibilidad → candidatos → reserva atómica → llamada → validación → liquidación/fallback; tope por llamada y por tarea; ningún gratuito recibe datos internos; sin escalar a pago sin regla; concurrencia correcta. Con un solo modelo activo, un error transitorio detiene la tarea (no hay otro al que pasar): conviene registrar al menos un respaldo antes de la prueba.

## Riesgos conocidos
1. Si `usage.cost` no llega o difiere, el costo queda como estimación (visible en `/admin/ia`). 2. Si el formato de herramientas de algún modelo difiere, ese modelo falla con «argumentos inválidos» y se salta. 3. `data_collection=deny` reduce los proveedores disponibles: más 4xx/errores de «sin proveedor» (el router lo trata como fallo y prueba otro modelo).
