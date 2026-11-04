# Selección de modelos y plan de prueba real — consultado el 2026-11-04

Fuentes (consultadas hoy desde el entorno, sin clave y sin costo): catálogo público `https://openrouter.ai/api/v1/models`, `/models/{id}/endpoints`, `/endpoints/zdr`, y las páginas oficiales *Limits*, *Provider Logging*, *Zero Data Retention*, *Provider Routing*, *Usage Accounting* y *Errors* (`openrouter.ai/docs/...`). Los precios cambian: se vuelven a leer con `npm run ia:catalogo` antes de la prueba.

**Qué es hecho verificado y qué no:** precios, contexto, parámetros, disponibilidad (uptime) y lista de endpoints con retención cero salen de la API pública. **No** verificado: calidad real (solo la mide la prueba real) y la política de datos *por endpoint* (el catálogo público no la trae; se confirma con la clave en `GET /api/v1/models/user` y con `data_collection:"deny"`, que OpenRouter aplica filtrando proveedores).

## Los tres modelos

| Función | Modelo | Precio por millón de tokens (entrada / salida) | Contexto | Capacidades | Datos |
|---|---|---|---|---|---|
| Gratuito (solo información **pública**) | `google/gemma-4-31b-it:free` | 0 / 0 | 262 144 | herramientas, JSON | Un solo proveedor (Google AI Studio), **no** está en la lista de retención cero: nunca datos del cliente. Sin uptime publicado: poco fiable. |
| Económico (tareas de negocio) | `anthropic/claude-haiku-5.5` | 0.10 / 0.50 | 1 000 000 | herramientas, JSON | Endpoints con retención cero (Google, Bedrock) y otros; uptime 100 % (Bedrock intermitente). |
| Avanzado / respaldo | `anthropic/claude-sonnet-5.5` | 2.00 / 10.00 | 1 000 000 | herramientas, JSON | Endpoints con retención cero (Google, Bedrock); uptime 100 %. |

Los precios del mismo modelo varían según el proveedor (p. ej. Haiku 0.10/0.50 o 0.11/0.55): el costo real lo informa OpenRouter en `usage.cost`.

Por qué estos: (1) las 8 tareas guiadas son todas de sensibilidad **interna** (marketing, ventas, atención: datos del negocio y mensajes de clientes), así que necesitan proveedores que no recolecten datos; (2) Haiku 5.5 es casi tan barato como los modelos de peso abierto y trae retención cero disponible; (3) el respaldo es de la misma familia, con varios proveedores distintos, y mejor redacción para quejas y propuestas. Alternativas vistas para la prueba comparativa opcional: `openai/gpt-5.4-nano` (0.10/0.625, retención cero vía Azure), `google/gemini-3.5-flash-lite` (0.15/1.25, retención cero), `openai/gpt-5-mini` (0.125/1.0). Descartados por ahora los de peso abierto más baratos (p. ej. `openai/gpt-oss-120b`, 0.027/0.101): decenas de proveedores pequeños con políticas dispares; se pueden reconsiderar con política verificada.

**Límites del gratuito (oficial):** 20 solicitudes por minuto; 50 por día si has comprado menos de US$10 de créditos, 1 000 por día con ≥ US$10. Un gratuito que falla no escala a pago (regla del router).

## Modelo por tarea (propuesta, a confirmar con la prueba)

| Tarea | Nivel | Modelo | Costo estimado por ejecución* | Sustituto si falla o se pide más calidad |
|---|---|---|---|---|
| Responder la duda de un cliente | A | Haiku 5.5 | ≈ US$0.0005 | Sonnet 5.5 |
| Mensaje de seguimiento posventa | A | Haiku 5.5 | ≈ US$0.0005 | Sonnet 5.5 |
| Anuncios: 3 propuestas | B | Haiku 5.5 | ≈ US$0.0009 | Sonnet 5.5 |
| Plan de contenido semanal | B | Haiku 5.5 | ≈ US$0.0009 | Sonnet 5.5 |
| Guion de video corto | B | Haiku 5.5 | ≈ US$0.0009 | Sonnet 5.5 |
| Responder a un prospecto | B | Haiku 5.5 | ≈ US$0.0009 | Sonnet 5.5 |
| Propuesta comercial | B | Haiku 5.5 (Sonnet si la prueba lo exige) | ≈ US$0.0009 (Sonnet ≈ US$0.017) | Sonnet 5.5 |
| Atender una queja o reseña | B | Haiku 5.5 (Sonnet si la prueba lo exige) | ≈ US$0.0009 (Sonnet ≈ US$0.017) | Sonnet 5.5 |

\* Con los supuestos del simulador (nivel A ≈ 2 000 tokens de entrada y 500 de salida; nivel B ≈ 3 500 y 1 000). Ninguna de las 8 tareas usa el modelo gratuito, porque ninguna es solo información pública; el gratuito queda para contenido público (p. ej. ideas de contenido sin datos del cliente), si la prueba lo aprueba.
Ejemplo mensual: 100 tareas de un cliente ≈ US$0.07 con Haiku; ≈ US$1.4 si todas fueran Sonnet.

## Compatibilidad del adaptador con la API real (revisada contra la documentación oficial)

Compatible: ruta `/chat/completions`, `Authorization: Bearer`, `max_tokens`, `provider.allow_fallbacks`, `provider.data_collection:"deny"`, `provider.zdr:true`, y `usage.cost` / `prompt_tokens` / `completion_tokens` / `provider` en la respuesta. Correcciones hechas (solo lo necesario):
1. `usage:{include:true}` está **obsoleto** y no hace nada (la respuesta ya trae el uso siempre): se dejó de enviar.
2. Los topes de gasto de la clave devuelven **403** con `error.metadata.limit_source` (no 401): antes se tomaba por «clave rechazada»; ahora se trata como «tope de gasto agotado» y detiene la tarea con explicación.
3. Un **402** con `limit_source = openrouter_in_flight_budget` es transitorio (se reintenta tras `Retry-After`); un 402 normal es saldo agotado.
Pruebas locales: contrato 10 pruebas + router + catálogo + configuración, todas pasan (45), sin costo. **Aún no probado contra el servicio real** (requiere clave): que el formato de herramientas funcione con estos modelos y que `zdr:true` no deje sin endpoints a Haiku.

## Claves necesarias
- `OPENROUTER_API_KEY` (única necesaria para estos tres modelos; el router no necesita clave de Anthropic porque llega a Claude a través de OpenRouter).
- `ANTHROPIC_API_KEY`: **no existe en este entorno** (verificado: la variable no está definida) y los reportes anteriores del repo la dan por no verificada. Si el VPS la tiene, se comprueba sin imprimirla: `grep -c '^ANTHROPIC_API_KEY=.\+' /ruta/.env` (devuelve 1 si hay valor, 0 si no). Solo hace falta para el modo actual (`AI_ROUTER` apagado), no para el router.

## Prueba real con límite estricto
1. En OpenRouter: crear una **clave nueva solo para esta prueba** con *credit limit* de **US$2** (límite por clave, sin reinicio) y cargar **US$5** de saldo con la recarga automática desactivada. Con ≥ US$10 comprados el gratuito sube a 1 000 solicitudes/día; con US$5 son 50/día, suficiente para la prueba.
2. En el VPS: `deploy/convivencia/configurar_openrouter.sh` (la clave se teclea oculta, no se muestra ni se guarda en el historial; deja `AI_ROUTER=off`).
3. Comprobación sin costo: `GET /api/v1/key` (muestra límite y saldo) y `GET /api/v1/models/user` (qué modelos están realmente disponibles con tus ajustes de privacidad).
4. `npx tsx scripts/ia/evaluar.ts docs/ia-router/modelos_prueba.json --dry-run --max-usd 0.50` → plan de 24 llamadas, **costo máximo posible US$0.16** (si cada respuesta llenara los 1 800 tokens de salida; el real será menor, ≈ US$0.02–0.05). Sin `--dry-run` el programa se detiene al llegar al tope real de US$0.50. Solo usa datos inventados (Café Luna).
5. Lectura humana de las 8×3 respuestas y llenado de la hoja; criterios en `PRUEBA_REAL_OPENROUTER.md`. Si Haiku pasa, se registra «verificado» en `/admin/ia`. El router se mantiene apagado hasta que José lo autorice.

Doble límite: el tope del programa (US$0.50) y el tope de la clave (US$2) más el saldo (US$5): ningún error del programa puede gastar más que la clave.
