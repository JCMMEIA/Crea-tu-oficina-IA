# Fase 2 · Investigación de OpenRouter

## Qué se pudo y qué NO
- **No se pudo abrir `openrouter.ai`** (`/models`, `/collections/free-models`, `/pricing`, `/docs`) desde este entorno: el nombre no se resuelve. **Por eso este documento NO trae lista de modelos, precios, latencias ni calidad.** Inventarlos sería peligroso: el router decide gastos con ellos.
- Solo hay **fragmentos de resultados de búsqueda** (no páginas abiertas por mí). Lo que dicen, **sin verificar**:
  - Los modelos gratuitos (`:free`) tienen tope de **20 solicitudes por minuto**; el tope diario depende de las compras de la cuenta: **50/día** con menos de 10 créditos comprados y **1 000/día** con 10 o más. Otra fuente cita ~200/día: contradice, se considera poco fiable. Los límites son por cuenta, no por clave.
  - El enrutamiento por proveedor admite `provider.data_collection` («allow»/«deny») y `provider.zdr` (solo endpoints con retención cero). Una fuente advierte que el filtro `data_collection` **no verifica por sí solo** las condiciones de retención de cada proveedor.
  - Los campos `usage.include` y `usage.cost` y el comportamiento de `openrouter/free` **no se pudieron confirmar**.
- Para completar: permitir `openrouter.ai` en la red del entorno (Configuración del entorno → Network access) o pegar aquí las páginas.

## Categorías (conceptuales, no una lista de modelos)
| Categoría | Para qué | Riesgos |
|---|---|---|
| **Gratuita** | Nivel A con información pública | Sin disponibilidad garantizada; límites por minuto y día; la política de datos suele ser menos favorable → **no recibe información interna** salvo regla expresa de la cuenta |
| **Económica** | Nivel B (guiones, correos, propuestas) | Calidad variable: se mide con `scripts/ia/evaluar.ts` antes de activarla |
| **Premium** | Nivel C y respaldo | Costo alto: solo si cabe en el presupuesto reservado |

## Cómo verificar un modelo ANTES de activarlo (checklist para `/admin/ia`)
1. Precio de entrada y salida **de la página del modelo** (anotar fecha). 2. Ventana de contexto. 3. ¿Admite herramientas y JSON? (probarlo, no solo leerlo). 4. Política de datos del proveedor concreto (entrenamiento, retención) → `data_policy`. 5. Latencia y tasa de error medidas con `scripts/ia/evaluar.ts` sobre las 8 tareas. 6. Límites de uso del plan gratuito, si aplica. 7. Recién entonces marcar «verificado» y «activo». El sistema **rechaza** activar un modelo sin verificar.

## Decisión de diseño
**No se depende de `openrouter/free` ni de un modelo gratuito concreto:** el router elige entre los modelos que TÚ activaste, siempre con un respaldo de pago autorizado por la cuenta. Un `openrouter/free` podría registrarse como un modelo más (gratuito, nivel A, política desconocida → solo datos públicos) si se verifica.
