# Instalar el router en el VPS (paquete mínimo, router APAGADO)

**Nada de esto se ha ejecutado en el VPS.** Hazlo solo cuando lo autorices. El router (`AI_ROUTER`) se queda **apagado** en todo el proceso; encenderlo es una decisión posterior y separada.

## 0. Antes (en tu máquina / revisión)
1. Revisa el PR y anota la **rama** y el **commit completo** (40 caracteres) que indique el reporte. Hoy: rama `claude/humo-sonnet-seguro` (PR #7), que contiene lo ya instalado (`a6cc7d4`) más la corrección de la prueba de humo. No se fusiona con `main` para instalar.
2. En openrouter.ai confirma que la clave que ya está en el servidor tiene un **límite de crédito pequeño (≈ US$2)** y poco saldo.

## 1. Respaldo ya existente
Los respaldos automáticos de `crea-respaldo.service` se mantienen; el instalador lanza uno más antes de cambiar nada.

## 2. Traer el instalador y verificar (solo lectura)
Define la rama y el commit (el instalador se niega a instalar si no coinciden). Pega el commit del reporte en lugar de `PEGA_AQUI_EL_COMMIT_REVISADO`:
```bash
RAMA=claude/humo-sonnet-seguro
SHA=PEGA_AQUI_EL_COMMIT_REVISADO
```
El script aún no está en el VPS: tráelo **sin cambiar de rama ni ensuciar el repositorio** (queda en /tmp) y compara su huella con la del reporte:
```bash
sudo -u ctoapp git -C /opt/crea-oficina/app fetch origin "$RAMA"
sudo -u ctoapp git -C /opt/crea-oficina/app show FETCH_HEAD:deploy/convivencia/instalar_router.sh | sudo tee /tmp/instalar_router.sh >/dev/null
sha256sum /tmp/instalar_router.sh
```
Verificación de solo lectura (no cambia nada):
```bash
sudo bash /tmp/instalar_router.sh --verificar --rama "$RAMA" --commit "$SHA"
```
(Desde /tmp el script usa `lib.sh` y `openclaw_check.sh` de la instalación actual.) Debe decir: árbol limpio, router apagado, **«El commit coincide…»**, **fast-forward** desde la versión instalada, **«todos los archivos están en la lista permitida»**, y cuántos commits de `main` llegan además.

## 3. Instalación v2 (release aparte, intercambio atómico, reversión sin recompilar)
> Versión corregida tras el incidente `docs/incidentes/2026-11-INSTALACION_ROUTER_502.md`. **No uses el instalador v1.** **Instalar requiere tu autorización expresa.**
Simulacro completo (muestra el plan, no cambia nada):
```bash
sudo bash /tmp/instalar_router.sh --rama "$RAMA" --commit "$SHA"
```
Instalación (solo con autorización; `--rama` y `--commit` son obligatorios, sin ellos se niega):
```bash
sudo bash /tmp/instalar_router.sh --aplicar --rama "$RAMA" --commit "$SHA"
```
Comprobaciones previas (si alguna falla, no cambia nada): árbol limpio, `AI_ROUTER` apagado, **existe `.next/BUILD_ID` y la app responde ahora**, espacio libre ≥ 2 GB, release y app en el mismo sistema de archivos, rama y commit exactos, fast-forward y lista de archivos permitida.
Pasos (cada uno pide escribir `SI`):
1. Foto de OpenClaw + respaldo (`crea-respaldo.service`) + copia del env (600).
2. **Release aparte** en `/opt/crea-oficina/releases/…` creado con `git archive` (sin `.data`) y compilación allí (Turbopack; si falla, webpack). **La web en marcha no se toca.** Si falla: se borra solo ese release y termina (código 1).
3. Activación por renombrado: `.next` → `.next.prev.<fecha>` y el nuevo ocupa su lugar (y `node_modules` solo si cambia el lock); `git checkout -B router-instalado`.
4. Comprueba `.next/BUILD_ID` y reinicia **solo** `crea-oficina` (único reinicio).
5. Verifica salud, `AI_ROUTER` apagado, las 7 tablas `ai_*` y OpenClaw.
Si algo falla: restaura `.next.prev` (**sin recompilar**), vuelve el código, comprueba `BUILD_ID`, reinicia y verifica (código 1). Si no hubiera ninguna versión compilada, **no reinicia** y sale con código 2 mostrando la recuperación manual.
Volver a mano: `sudo bash /tmp/instalar_router.sh --revertir` (intercambia carpetas, no compila). Tras confirmar que todo va bien, borra a mano las carpetas `.next.prev.*` (y `node_modules.prev.*`) que ya no necesites. No toca `.data`, bases de datos, env, Stripe, Resend ni OpenClaw.

## 4. Comprobar que OpenClaw sigue funcionando
El instalador guarda una foto «antes» y la compara «después» (proceso, PID, hora de inicio, unidad, reinicios, respuesta HTTP en el puerto 18789, memoria). A mano, solo lectura (pon en `UNIDAD_OPENCLAW` el nombre de la unidad que muestra la foto «antes»):
```bash
sudo bash /opt/crea-oficina/app/deploy/convivencia/openclaw_check.sh --guardar /tmp/oc_antes.txt
sudo bash /opt/crea-oficina/app/deploy/convivencia/openclaw_check.sh --comparar /tmp/oc_antes.txt
UNIDAD_OPENCLAW=PON_AQUI_LA_UNIDAD_DE_OPENCLAW
systemctl is-active "$UNIDAD_OPENCLAW"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18789/
```
(`--comparar` responde «INTACTO» o lista las diferencias.)
Si cambió el PID o la hora de inicio, OpenClaw se reinició (no debería: solo se reinicia `crea-oficina`).

## 5. Prueba de humo: UNA llamada a Claude Sonnet 5.5 (sin encender el router)
Independiente del router, de `AI_ROUTER` y del catálogo de `/admin/ia`. Usa solo la clave del servidor (nunca se imprime). Detalle: `PRUEBA_HUMO_SONNET.md`. Cada comando es completo y se copia tal cual (solo funcionan tras instalar el commit que trae `ia:humo` con estas restricciones).

**5.1 Simulacro local** (cero llamadas, cero costo; muestra privacidad, proveedores y costo máximo estimado):
```bash
sudo runuser -u ctoapp -- env HOME=/opt/crea-oficina/home PATH=/opt/crea-oficina/node/bin:/usr/bin:/bin bash -c 'cd /opt/crea-oficina/app && set -a && . /etc/crea-oficina/env && set +a && npm run -s ia:humo'
```
**5.2 Consulta de la clave, solo lectura** (no factura; muestra si tiene límite propio o guardrail; no crea ni asigna nada):
```bash
sudo runuser -u ctoapp -- env HOME=/opt/crea-oficina/home PATH=/opt/crea-oficina/node/bin:/usr/bin:/bin bash -c 'cd /opt/crea-oficina/app && set -a && . /etc/crea-oficina/env && set +a && npm run -s ia:humo -- --consultar-clave'
```
**5.3 La llamada real — SOLO con tu autorización expresa** (una solicitud, sin reintentos):
```bash
sudo runuser -u ctoapp -- env HOME=/opt/crea-oficina/home PATH=/opt/crea-oficina/node/bin:/usr/bin:/bin bash -c 'cd /opt/crea-oficina/app && set -a && . /etc/crea-oficina/env && set +a && npm run -s ia:humo -- --autorizo-una-llamada-facturable'
```
Envía exactamente una solicitud con `provider.only = [amazon-bedrock/us-east-1, amazon-bedrock/eu-west-1]`, `zdr=true`, `data_collection="deny"`, `allow_fallbacks=false` y `max_price` = tarifas verificadas × 1.25. Si el cuerpo no cumple exactamente eso, o el peor caso estimado no cabe en US$0.01, no envía nada. No requiere `AI_ROUTER=on`.

## 6. Después
Encender el router para clientes NO forma parte de este paquete: requiere modelos verificados en `/admin/ia`, presupuestos y tu autorización (ver `ROUTER.md`, `CREDENCIALES_Y_PRESUPUESTO.md`).
