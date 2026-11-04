# Auditoría de dependencias del router de IA (2026-11-04)

Base de producción: `main` (`a4c9e67`, incluye el PR #2). Ramas auditadas: PR #3 (`claude/cerebro-tareas-guiadas`), PR #4 (`claude/landing-premium-v2`), `claude/router-ia-solo` (`01b2b42`, construida SOBRE el PR #3) y el paquete nuevo `claude/router-ia-minimo` (SOBRE `main`).

## Qué necesita realmente el router
| Pieza | Archivos | ¿Depende del PR #3? |
|---|---|---|
| Núcleo | `src/server/ai/{types,config,quota,profiles,router,backends,catalogo}.ts` | No |
| Clasificación | `src/server/ai/classify.ts` | Solo la rama «tarea guiada» (nivel por tarea + secciones a validar). Sin ella usa el perfil del puesto y heurísticas |
| Integración con el motor | `src/server/models/index.ts` (`getProvider`), `src/server/tasks/index.ts` | No (el motor de tareas ya está en `main`) |
| Base de datos | `src/server/db/schema.sql` (+7 tablas `ai_*`, todo `CREATE TABLE IF NOT EXISTS`, sin ALTER ni DROP) | No |
| Panel del operador | `src/app/admin/ia/page.tsx`, `admin/layout.tsx`, `admin_actions.ts` | No |
| Scripts | `scripts/ia/{preparado,catalogo_openrouter,prueba_humo}.ts`, `deploy/convivencia/{configurar_openrouter,instalar_router}.sh` | No |
| **Solo en `router-ia-solo` (necesitan PR #3)** | nivel por tarea en `features/tasks/catalog.ts`, cuota mostrada en `usage/report.ts` y `consumo/page.tsx`, `scripts/ia/{evaluar,empleados_routing}.ts`, `scripts/finanzas/simular.ts` | **Sí** |

## Resultado
`claude/router-ia-minimo` = `main` + 21 archivos de código (más pruebas y docs). No incluye landing (PR #4), afiliados, Mi Plan de Libertad, Cerebro ni tareas guiadas (PR #3). El instalador del VPS (`instalar_router.sh`) **rechaza** cualquier archivo fuera de esa lista.

## Compatibilidad con las demás ramas (`git merge-tree`)
- `main`: sin conflicto · PR #4: sin conflicto.
- PR #3: conflictos triviales de «añadir al final» en `package.json` (scripts) y `schema.sql` (tablas): se resuelven conservando ambos lados.
- `claude/router-ia-solo`: es la versión completa; tras fusionar el paquete mínimo habrá que **rebasarla** (conflictos en `classify.ts`, `tasks/index.ts`, pruebas, `schema.sql`) y dejarla como PR de «router con tareas guiadas» sobre el PR #3.
- Mi Plan de Libertad: mismo conflicto trivial de `package.json`/`schema.sql`.

## Recomendación
**Instalar primero el paquete independiente del router, NO el PR #3.** El PR #3 trae 46 archivos (Cerebro, 8 tareas guiadas, consumo) que no se han revisado ni probado en producción y no son necesarios para probar OpenRouter. Después, el PR #3 se integra por su cuenta y `router-ia-solo` se rebasa encima para recuperar nivel por tarea, cuota visible y evaluación con las 8 tareas.
