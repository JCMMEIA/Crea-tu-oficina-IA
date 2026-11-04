# Instalar el router en el VPS (paquete mínimo, router APAGADO)

**Nada de esto se ha ejecutado en el VPS.** Hazlo solo cuando lo autorices. El router (`AI_ROUTER`) se queda **apagado** en todo el proceso; encenderlo es una decisión posterior y separada.

## 0. Antes (en tu máquina / revisión)
1. Revisa el PR/rama `claude/router-ia-minimo` y anota el **commit exacto** (el que te indique el reporte). No se fusiona con `main` para instalar.
2. En openrouter.ai confirma que la clave que ya está en el servidor tiene un **límite de crédito pequeño (≈ US$2)** y poco saldo.

## 1. Respaldo ya existente
Los respaldos automáticos de `crea-respaldo.service` se mantienen; el instalador lanza uno más antes de cambiar nada.

## 2. Simulacro (no cambia nada)
```
```
El script aún no está en el VPS: tráelo **sin cambiar de rama ni ensuciar el repositorio** (queda en /tmp) y comprueba su huella:
```
sudo -u ctoapp git -C /opt/crea-oficina/app fetch origin claude/router-ia-minimo
sudo -u ctoapp git -C /opt/crea-oficina/app show FETCH_HEAD:deploy/convivencia/instalar_router.sh | sudo tee /tmp/instalar_router.sh >/dev/null
sha256sum /tmp/instalar_router.sh        # compara con la huella del reporte
sudo bash /tmp/instalar_router.sh --verificar --commit <SHA>
```
(Desde /tmp el script usa `lib.sh` y `openclaw_check.sh` de la instalación actual.) Debe decir: árbol limpio, router apagado, fast-forward, **«todos los archivos están en la lista permitida»**, y cuántos commits de `main` llegan además.

## 3. Instalación v2 (release aparte, intercambio atómico, reversión sin recompilar)
> Versión corregida tras el incidente `docs/incidentes/2026-11-INSTALACION_ROUTER_502.md`. **No uses el instalador v1.**
```
sudo bash /tmp/instalar_router.sh --commit <SHA>             # simulacro completo: muestra el plan
sudo bash /tmp/instalar_router.sh --aplicar --commit <SHA>
```
Comprobaciones previas (si alguna falla, no cambia nada): árbol limpio, `AI_ROUTER` apagado, **existe `.next/BUILD_ID` y la app responde ahora**, espacio libre ≥ 2 GB, release y app en el mismo sistema de archivos, commit exacto, fast-forward y lista de archivos permitida.
Pasos (cada uno pide escribir `SI`):
1. Foto de OpenClaw + respaldo (`crea-respaldo.service`) + copia del env (600).
2. **Release aparte** en `/opt/crea-oficina/releases/…` creado con `git archive` (sin `.data`) y compilación allí (Turbopack; si falla, webpack). **La web en marcha no se toca.** Si falla: se borra solo ese release y termina (código 1).
3. Activación por renombrado: `.next` → `.next.prev.<fecha>` y el nuevo ocupa su lugar (y `node_modules` solo si cambia el lock); `git checkout -B router-instalado`.
4. Comprueba `.next/BUILD_ID` y reinicia **solo** `crea-oficina` (único reinicio).
5. Verifica salud, `AI_ROUTER` apagado, las 7 tablas `ai_*` y OpenClaw.
Si algo falla: restaura `.next.prev` (**sin recompilar**), vuelve el código, comprueba `BUILD_ID`, reinicia y verifica (código 1). Si no hubiera ninguna versión compilada, **no reinicia** y sale con código 2 mostrando la recuperación manual: `cd /opt/crea-oficina/app && sudo -u ctoapp env PATH=/opt/crea-oficina/node/bin:$PATH npm run build -- --webpack && sudo systemctl restart crea-oficina`.
Volver a mano: `sudo bash /tmp/instalar_router.sh --revertir` (intercambia carpetas, no compila). Tras confirmar que todo va bien, borra a mano las carpetas `.next.prev.*` (y `node_modules.prev.*`) que ya no necesites. No toca `.data`, bases de datos, env, Stripe, Resend ni OpenClaw.

## 4. Comprobar que OpenClaw sigue funcionando
El instalador guarda una foto «antes» y la compara «después» (proceso, PID, hora de inicio, unidad, reinicios, respuesta HTTP en el puerto 18789, memoria). A mano, solo lectura:
```
sudo bash deploy/convivencia/openclaw_check.sh --guardar /tmp/oc_antes.txt     # antes
sudo bash deploy/convivencia/openclaw_check.sh --comparar /tmp/oc_antes.txt    # después: «INTACTO» o lista de diferencias
systemctl is-active <unidad-de-openclaw>; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18789/
```
Si cambió el PID o la hora de inicio, OpenClaw se reinició (no debería: solo se reinicia `crea-oficina`).

## 5. Prueba de humo: UNA llamada, tope US$0.01 (sin encender el router)
Es independiente del router: usa solo el adaptador de OpenRouter y la clave del servidor. Primero revisa la clave (no cuesta; no muestra la clave):
```
sudo runuser -u ctoapp -- bash -c 'set -a; . /etc/crea-oficina/env; set +a; curl -s -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/key | python3 -c "import sys,json; d=json.load(sys.stdin)[\"data\"]; print({k:d.get(k) for k in (\"label\",\"limit\",\"limit_remaining\",\"usage\",\"is_free_tier\")})"'
```
Simulacro (no llama): 
```
sudo runuser -u ctoapp -- bash -c 'cd /opt/crea-oficina/app && set -a && . /etc/crea-oficina/env && set +a && npm run -s ia:humo -- --modelo anthropic/claude-haiku-5.5 --precio-in 0.10 --precio-out 0.50'
```
Con tu autorización, la llamada real (peor caso ≈ US$0.00002; el programa se niega si supera US$0.01):
```
… npm run -s ia:humo -- --modelo anthropic/claude-haiku-5.5 --precio-in 0.10 --precio-out 0.50 --max-usd 0.01 --confirmo
```
Debe imprimir `✅ Respondió…` con tokens y costo. No requiere `AI_ROUTER=on`: los clientes siguen con el comportamiento anterior.

## 6. Después
Encender el router para clientes NO forma parte de este paquete: requiere modelos verificados en `/admin/ia`, presupuestos y tu autorización (ver `ROUTER.md`, `CREDENCIALES_Y_PRESUPUESTO.md`).
