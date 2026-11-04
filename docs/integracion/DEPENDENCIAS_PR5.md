# Dependencias del PR #5 respecto de los PR #3 y #4

Fecha: 2026-11-04. Estado: análisis; nada fusionado ni desplegado.

## Qué contiene el PR #5 (prototipo)
Router de modelos + programa de afiliados + landing de dos caminos, todo en una sola rama que incluye el PR #3 y una versión antigua del PR #4.

## Dependencias
- **PR #3** (tareas guiadas, catálogo de tareas, compra directa): el router lee `src/features/tasks/catalog.ts` y `src/server/tasks`. Dependencia real.
- **PR #4** (landing): el PR #5 trae su propia versión de la landing de dos caminos, que **entra en conflicto** con la actual del PR #4 (Header, Hero, Footer, funnel.css, leadform).
- Afiliados: independiente del router, pero comparte landing y leads.

## Integración segura propuesta (sin fusionar)
1. José fusiona en orden: PR #2 → PR #3 → PR #4 (su decisión).
2. Rama `claude/router-ia-solo`: solo router + OpenRouter + scripts + docs, basada en PR #3, sin landing ni afiliados. Verificada sin conflictos con PR #4 (`git merge-tree`).
3. Afiliados: PR aparte, después, cuando haya condiciones legales y comisiones aprobadas.
4. PR #5 queda solo como referencia; su cierre lo decide José.

## Reglas
- Un PR por negocio/tema. `AI_ROUTER=off` por defecto en todas las ramas.
- Ninguna rama escribe `AI_ROUTER=on`.
