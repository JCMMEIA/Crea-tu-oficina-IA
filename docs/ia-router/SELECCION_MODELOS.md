# Selección de modelos: gratuito, económico y avanzado

## Estado: PENDIENTE — ningún modelo seleccionado
Falta el acceso a `openrouter.ai` (ver `OPENROUTER_INVESTIGACION.md`). Lo que sí queda definido es **cómo** se elige, para que la decisión sea verificable y repetible.

| Espacio | Para qué | Estado | Modelo | Precio (entrada/salida por millón) | Fecha de consulta |
|---|---|---|---|---|---|
| **Gratuito** | Nivel A con información **pública** únicamente | PENDIENTE | — | — | — |
| **Económico** | Nivel B (tareas empresariales; datos internos) con política compatible | PENDIENTE | — | — | — |
| **Avanzado (respaldo)** | Nivel C y respaldo si el económico falla | PENDIENTE | — | — | — |

## Criterios obligatorios (si no se cumple, se descarta)
| | Gratuito | Económico | Avanzado |
|---|---|---|---|
| Precio | 0 en entrada **y** salida (sin precio ≠ gratis) | > 0, salida ≤ US$3/M (tope inicial) | > 0, salida ≤ US$25/M (tope inicial) |
| Contexto | ≥ 16 000 | ≥ 32 000 | ≥ 100 000 |
| Herramientas | no necesarias | **sí** (probado, no solo declarado) | **sí** |
| Política de datos | Aceptable que no sea ideal **porque solo recibe datos públicos** | **«sin entrenamiento» verificada** en el proveedor concreto que atiende la petición | «sin entrenamiento»; **retención cero** si se usará con información confidencial |
| Disponibilidad | Se acepta inestable (nunca es el único camino) | Estable; con proveedor alterno | Estable |
| Español y formato | ≥ 90 % de las 8 tareas con todas sus secciones | ≥ 90 % y utilidad humana ≥ 4/5 | 100 % y utilidad ≥ 4.5/5 |
Los topes de precio son un punto de partida editable; el tope real lo marca el presupuesto de la cuenta.

## Verificación manual por candidato (ficha)
Fecha · precio vigente (entrada/salida) · contexto · ¿admite herramientas y JSON? (probado) · **proveedores que lo sirven y la política de datos de cada uno** (entrenamiento, retención, región) · límites de uso (por minuto/día; saldo mínimo) · disponibilidad observada · latencia medida · resultado de `ia:evaluar` (estructura, español, cifras inventadas, afirmaciones de acciones no hechas, utilidad, tono, costo real) · decisión.

## Puntuación para desempatar (solo entre los que pasan todo lo anterior)
`puntaje = 0.40·utilidad(0–1) + 0.25·estructura(0–1) + 0.20·costo(1 = el más barato) + 0.15·latencia(1 = la más rápida)`. Un modelo con tasa de error > 10 % en la prueba queda fuera aunque puntúe alto.

## Reglas que NO cambian con la selección
Los gratuitos **nunca** reciben el Cerebro Empresarial ni datos de clientes (hoy cualquier tarea con ficha del negocio es «interna»). Un fallo de un gratuito **no** escala a un modelo de pago salvo regla expresa de la cuenta. Nada se activa sin «verificado» y «activo» en `/admin/ia`. Anthropic directo puede ser el avanzado si OpenRouter no ofrece una política de datos adecuada.
