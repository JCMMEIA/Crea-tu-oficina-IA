# Fase 5 · Límites de tokens y costo

## Dos límites simultáneos por CUENTA (el dueño de las oficinas)
1. **Créditos mensuales incluidos** = tokens × peso del modelo (peso 1 por defecto; un modelo premium puede pesar más).
2. **Tope interno de gasto en USD** por cuenta y mes (no se muestra como precio al cliente).
Además se conservan los límites existentes (presupuesto por empresa/oficina, ejecuciones por hora y por empleado) y un **tope por tarea** y por llamada.

La cuota abarca **todo lo que consume IA**: empleados, delegaciones, tareas guiadas, reintentos/fallbacks (los intentos inválidos también se cobran) y el contexto enviado (Cerebro, documentos). Las oficinas de una cuenta **comparten** la cuota.

## Tokens ≠ créditos
Se registran por separado: `tokens_used` (lo que procesó la IA) y `credits_used` (lo que se descuenta de la cuota). La pantalla `/consumo` explica la regla al cliente; el peso de cada modelo es visible y editable por el operador (`/admin/ia`). Imágenes, videos y servicios externos **no** comparten esta cuota: tendrán límites propios cuando existan. **No hay recargas automáticas ni consumo ilimitado**: al agotar la cuota las tareas se detienen con un mensaje claro hasta el reinicio mensual o hasta ampliar el plan.

## Mecanismo
- **Reservar** (`reserve`): UNA sentencia `UPDATE … WHERE usados + reservados + nuevo ≤ límite` (créditos y USD a la vez). Es atómica: 20 reservas en paralelo contra un límite de 10 → exactamente 10 pasan (probado en PGlite y en PostgreSQL real).
- **Liquidar** (`settle`) con el consumo real, idempotente; **liberar** (`release`) si la llamada falló; `releaseStale` libera reservas huérfanas (proceso caído).
- **Alertas** al 80 % y 100 % (configurables), una vez por mes y umbral (`ai_alerts`); hoy se muestran en pantalla, **el aviso por correo no está implementado**.

## Valores provisionales (internos, NO publicados) — `ai_plan_limits`
| Plan | Créditos/mes | Gasto máx. USD/mes | Oficinas | Nivel máx. | Tope por tarea |
|---|---|---|---|---|---|
| starter | 500 000 | 6 | 1 | B | 0.25 |
| pro | 2 000 000 | 16 | 1 | C | 0.40 |
| business | 5 000 000 | 40 | 3 | C | 0.60 |
(`emprendedor` = como starter; `prueba`, `agencia` y `avanzado` quedan con topes finitos.) Editables en `/admin/ia`.

## ¿Son sostenibles las cuotas propuestas?
Con los supuestos de `FINANZAS.md` (precios de modelos **no verificados**), si un cliente consume el **100 %** de su cuota: Starter ≈ 11.6 % del ingreso neto en IA si todo fuera premium y ≈ 4.9 % con el router; Pro y Business ≈ 23.2 % premium y ≈ 9.9 % router. Es decir: **sostenibles incluso en el peor caso de uso, bajo esos supuestos**; si los modelos reales costaran el doble o el uso fuera mayormente premium, Pro/Business rozarían el 45 % del neto y habría que bajar cuota o subir precio. La cuota equivale a unas **110 / 440 / 1 100 tareas intermedias** por mes (≈ 4 500 tokens por tarea). Lo que decide el margen real es el **tope en USD**, no los tokens.

## Pendiente
Conectar Starter/Pro/Business al cobro y al alta de oficinas; avisos por correo de cuota; límites para imágenes y video cuando existan.
