# Fases 3 y 4 · Router inteligente y fallback

Código: `src/server/ai/` (`router.ts`, `classify.ts`, `profiles.ts`, `config.ts`, `quota.ts`, `backends.ts`). **Un solo router** para todas las oficinas y los 41 puestos.

## Flujo de cada llamada del motor de tareas
1. **Clasificar** (`classifyTask`): nivel A/B/C y sensibilidad pública/interna/confidencial, con los motivos guardados. Entradas: perfil del puesto (`profiles.ts`), nivel de la tarea guiada, tamaño de instrucción y contexto, nº de herramientas, delegación, uso del Cerebro (siempre «interna»).
2. **Elegir candidatos** (`planRoute`, función pura): solo modelos **activos y verificados**; permitidos por el plan (categorías y nivel); aptos por política de datos; con herramientas/JSON/contexto si hace falta; cuyo **costo máximo** cabe en el tope por llamada, el tope por tarea y el presupuesto restante. Orden: A → gratuito, económico, premium · B → económico, premium, gratuito · C → premium, económico (si está autorizado para C); dentro de cada categoría, el más barato; un modelo con mal historial reciente (≥50 % de fallos en ≥5 llamadas) pasa al final.
3. **Reservar** cuota (atómica) por el peor caso; si no cabe → `QuotaError` y **no se llama a ningún modelo**.
4. **Llamar** al proveedor (OpenRouter o Anthropic directo) con la privacidad de la sensibilidad (`data_collection: deny`, `zdr` si es confidencial).
5. **Validar** (secciones pedidas, longitud mínima, JSON si aplica).
6. **Liquidar** con el consumo real (o **liberar** si la llamada falló) y **registrar** cada intento en `ai_calls`.
7. Si falla o es inválida → siguiente candidato autorizado, hasta `maxAttempts` (3 por defecto). Sin alternativa → la tarea se detiene con una explicación.

## Garantías (con prueba automática)
- Nunca escala a un modelo cuyo costo máximo supere el presupuesto disponible. Un gratuito que falla **no pasa a uno de pago** salvo `allowPaidFallback` y con reserva de cuota.
- Información confidencial solo a modelos de retención cero verificada; interna solo a «sin entrenamiento» (y gratuitos solo si la cuenta lo permite). Con la ficha del negocio en el prompt, casi toda tarea es **interna**: los modelos gratuitos quedan para contenido público.
- Sin reintentos infinitos ni bucles: tope de intentos y cada modelo se intenta una vez por llamada. El router lanza un error **no transitorio** para que el motor no repita toda la cadena.
- Las herramientas con efectos externos **no se ejecutan dentro del router**: el motor las ejecuta (las de escritura esperan aprobación) y los resultados quedan en el historial; un fallback solo repite la llamada al modelo, nunca la acción.
- Una respuesta inválida **sí se cobra** (consumió tokens) y cuenta para el tope por tarea.

## Registro por intento (`ai_calls`)
Modelo solicitado y usado, proveedor, tokens de entrada/salida, créditos, costo (con su origen: `proveedor` o `estimado`), nº de intento, motivo del fallback, latencia, resultado de validación, nivel y sensibilidad. Visible en `/admin/ia`.

## Cómo encenderlo (sin desplegar nada automáticamente)
1. En `/admin/ia` registra y **verifica** al menos un modelo (precio, política) y actívalo. 2. Carga `OPENROUTER_API_KEY` (privado, en el servidor) si usarás OpenRouter. 3. Pon `AI_ROUTER=on` en el entorno y reinicia **solo** `crea-oficina`. Apagado, el comportamiento anterior (Anthropic directo) no cambia.

## Límites conocidos
Los campos de OpenRouter se implementaron según la interfaz compatible con OpenAI y los fragmentos de documentación de la Fase 2: **no se probaron contra OpenRouter real**. Imágenes, videos y servicios externos no existen todavía en la plataforma; cuando existan tendrán límites independientes (no se mezclan con tokens).
