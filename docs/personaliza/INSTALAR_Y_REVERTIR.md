# Personaliza tu oficina — instalación segura y reversión

> **Nada de esto se ha ejecutado en el VPS.** Hazlo solo cuando lo autorices. No reinicia OpenClaw, no enciende `AI_ROUTER`, no escribe el archivo `env`, no toca Stripe, Resend ni `.data`.

## Qué se instala y por qué NO es la rama del PR #8
El VPS tiene instalado el router (commit `a6cc7d4`, PR #7). El PR #8 nace de `main`, que **no contiene** ese commit, así que el instalador v2 (`instalar_router.sh`) lo rechazaría («no avanza limpio / archivos fuera de la lista»). Por eso se prepara una rama de instalación:

| Rama | Contenido | Para qué |
|---|---|---|
| `claude/personaliza-tu-oficina` (PR #8, contra `main`) | Solo la función | Revisión y fusión a `main` |
| `claude/personaliza-sobre-router` | PR #7 (router, apagado) + PR #8 | **Instalar en el VPS** con `instalar_personaliza.sh` |

La rama de instalación desciende de `a6cc7d4` (fast-forward). El único conflicto con el router fue `schema.sql` (ambos añaden sentencias idempotentes al final) y se resolvió conservando las dos.

## Compatibilidad con la versión instalada
- Verificada en el repositorio: la rama de instalación desciende de `a6cc7d4`, compila (`next build`), pasa la revisión de tipos y las pruebas.
- **No verificada en el servidor** (no tengo acceso ni debo tenerlo): la versión realmente instalada. El paso 2 (`--verificar`) lo comprueba en solo lectura y se niega a seguir si no coincide.

## Migración
Una sola sentencia al final de `schema.sql`, que la aplicación ya ejecuta en cada arranque:
`ALTER TABLE agencies ADD COLUMN IF NOT EXISTS office_design jsonb NOT NULL DEFAULT '{}'::jsonb;`
- Aditiva e idempotente; con valor por omisión constante no reescribe la tabla (PostgreSQL ≥ 11): bloqueo de milisegundos sobre `agencies`.
- Oficinas existentes: `'{}'` = se ven exactamente como antes. `agencies.brand` no se toca.
- El código anterior ignora la columna (nunca hace `SELECT *` de `agencies` hacia la interfaz con esa columna) y sigue funcionando.

## Instalación (con tu autorización, paso a paso)
Datos: `RAMA=claude/personaliza-sobre-router` y `SHA=<commit completo de 40 caracteres que indique el reporte del PR>`.

1. **Traer el instalador sin ensuciar el repositorio** (queda en /tmp) y anotar su huella:
   ```bash
   sudo -u ctoapp git -C /opt/crea-oficina/app fetch origin "$RAMA"
   sudo -u ctoapp git -C /opt/crea-oficina/app show FETCH_HEAD:deploy/convivencia/instalar_personaliza.sh | sudo tee /tmp/instalar_personaliza.sh >/dev/null
   sha256sum /tmp/instalar_personaliza.sh
   ```
2. **Verificar (solo lectura)**. Debe decir: árbol limpio, router apagado, `.next/BUILD_ID` presente, app responde, espacio ≥ 2 GB, «El commit coincide», **fast-forward**, «todos los archivos están en la lista permitida».
   ```bash
   sudo bash /tmp/instalar_personaliza.sh --verificar --rama "$RAMA" --commit "$SHA"
   ```
3. **Simulacro** (muestra el plan; no cambia nada):
   ```bash
   sudo bash /tmp/instalar_personaliza.sh --rama "$RAMA" --commit "$SHA"
   ```
4. **Instalar** (solo con autorización; pide escribir SI antes de cada paso que cambia algo):
   ```bash
   sudo bash /tmp/instalar_personaliza.sh --aplicar --rama "$RAMA" --commit "$SHA"
   ```
   Hace: respaldo de `crea-oficina` y copia del env (600) → compila en un release aparte (la web en marcha no se toca) → intercambia carpetas por renombrado → reinicia **solo** `crea-oficina` (única vez; unos segundos) → comprueba `/api/health`, `AI_ROUTER` apagado, las 7 tablas del router, la columna `office_design` y OpenClaw igual. Si algo falla, vuelve solo a la versión anterior.
5. **Revisar a mano**: entrar a `/agencia/personalizar` y a `/agencia/oficina-3d`; abrir una oficina de un cliente; comprobar en el celular.

## Reversión (preserva la base de datos y todas las oficinas)
- **Inmediata**: `sudo bash /tmp/instalar_personaliza.sh --revertir` → restaura `.next` anterior y el código (no recompila), verifica `BUILD_ID` y reinicia solo `crea-oficina`.
- **La base de datos NO se revierte ni se borra nada.** La columna `office_design` queda sin uso (inofensiva); los diseños guardados se conservan por si se vuelve a instalar. **No ejecutes `DROP COLUMN`**: perderías los diseños y no aporta nada.
- Para guardar una copia de los diseños antes de cualquier cambio manual (solo lectura):
  ```bash
  sudo -u postgres psql -d "$DB_NAME" -Atc "COPY (SELECT id, office_design FROM agencies WHERE office_design <> '{}'::jsonb) TO STDOUT"
  ```
- Respaldos automáticos de `crea-respaldo.service` + el que lanza el instalador (en `$BACKUPS`).
- Si el instalador devuelve código 2 (no hay versión compilada): **no** reinicia; sigue la «recuperación manual» que imprime.
- Para volver al router sin la función: la revertida deja el VPS en `a6cc7d4` (o el commit que hubiera antes), con `AI_ROUTER` apagado.

## Después de instalar
Las carpetas `.next.prev.<fecha>` (y `node_modules.prev.<fecha>` si cambió `package-lock.json`) se conservan; bórralas cuando estés tranquilo. Para dejar de usar la rama de instalación, fusiona primero el PR #7 y luego el PR #8 en `main` (el orden evita conflictos).
