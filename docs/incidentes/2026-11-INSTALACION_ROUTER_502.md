# Incidente: la instalación del router tumbó la plataforma (HTTP 502)

**Fecha:** la reportada por José (completar). **Duración:** temporal; recuperada manualmente. **Impacto:** Crea tu Oficina IA respondió 502 durante la instalación y el rollback. Sin pérdida de datos conocida. Router no instalado, `AI_ROUTER=off`.

## Qué pasó (hechos verificados)
1. El instalador v1 compiló **dentro de la carpeta en marcha** (`/opt/crea-oficina/app`) con `next build` (Turbopack) como usuario `ctoapp`.
2. La compilación falló: Turbopack intentó **leer el directorio `.data`** (`.data/pglite`, propiedad de root) → `Permission denied`.
3. El rollback hizo `git reset` al commit anterior y **volvió a compilar en el mismo sitio**; esa recompilación falló por la misma causa. Sin `.next/BUILD_ID` el servicio quedó en 502.
4. La recuperación manual funcionó con `npm run build -- --webpack` (webpack no recorre `.data`).

## Causa raíz (reproducida en local, 2026-11)
`src/server/db/index.ts` construye la ruta del almacén de desarrollo con `path.join(process.cwd(), ".data", "pglite")`. El análisis de archivos de Turbopack lo interpreta como «todo el directorio `.data`» y lo lee al compilar. Reproducción: copia del repositorio con `.data/pglite` de root (modo 700) y `next build` como usuario sin privilegios → falla con `reading dir ".data" … Permission denied (os error 13)`. Con `/*turbopackIgnore: true*/` sobre `process.cwd()` el mismo escenario **compila bien**.

## Fallos de diseño del instalador v1 (todos corregidos en v2)
| # | Fallo | Corrección |
|---|---|---|
| 1 | Compilaba en la carpeta que sirve la web: una compilación fallida destruía `.next` | Compila en un **release aparte** (`git archive` del commit: sin `.data`, sin secretos). La web en marcha no se toca hasta que hay una compilación completa |
| 2 | El rollback **recompilaba** | El rollback **restaura por renombrado** las carpetas guardadas (`.next.prev.<fecha>`; `node_modules` si cambió el lock). Recompilar es el último recurso y también ocurre en un release aparte |
| 3 | Reiniciaba sin comprobar que hubiera build | Nunca reinicia sin `.next/BUILD_ID` y `.next/server`; si no los hay, sale con código 2 **sin reiniciar** y da la recuperación manual |
| 4 | Solo Turbopack | Si falla, reintenta con `--webpack` (limpiando solo `.next` del release) |
| 5 | No comprobaba el estado previo | Se niega si no hay versión compilada que proteger, si la app ya está caída, si falta espacio o si release y app están en sistemas de archivos distintos |
| 6 | Causa en el código | `turbopackIgnore` en `src/server/db/index.ts` (sin cambio de comportamiento) |

## Qué NO se tocó (y las pruebas lo verifican)
`.data` (contenido, permisos, dueño, fecha), `/etc/crea-oficina/env` (huella idéntica), bases de datos, Stripe, Resend y OpenClaw (el instalador solo ejecuta `systemctl restart crea-oficina` y `start crea-respaldo.service`).

## Evidencia
- Pruebas `tests/instalar_router_recuperacion.test.ts` (15) y `tests/instalar_router.test.ts` (11): instalación; compilación sin `.data`; webpack de respaldo; fallo total de compilación sin tocar nada ni reiniciar; falla de salud → restauración sin recompilar; carpetas perdidas + recompilación fallida → código 2 sin reiniciar; último recurso exitoso; cambio de `package-lock`; `--revertir`; negativas.
- Compilación REAL de un release (`git archive` + `npm ci` + `npm run build`, Turbopack) como usuario sin privilegios mientras existía un `.data` de root (700) en la carpeta en marcha: BUILD_ID generado.
- `npm run check`: 341 pruebas, tsc y secretos limpios.

## Pendiente conocido (fuera de este paquete)
`deploy/convivencia/actualizar_convivencia.sh` (en `main`) tiene el mismo diseño que v1 (compila en el sitio y el rollback recompila). **No lo uses para actualizar hasta corregirlo** (PR aparte, mismo patrón de release + intercambio).
