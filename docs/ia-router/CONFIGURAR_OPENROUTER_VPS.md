# Procedimiento: cargar la clave de OpenRouter en el servidor

El script `deploy/convivencia/configurar_openrouter.sh` (probado con 7 pruebas automáticas) **solo** modifica `OPENROUTER_API_KEY` y deja `AI_ROUTER=off`. No toca Stripe, Anthropic, Resend, precios, base de datos ni registro público (lo comprueba con una huella antes/después y restaura el respaldo si algo cambia), no imprime la clave, **nunca enciende el router** y reinicia solo `crea-oficina` si escribes SI. No toca OpenClaw. **Nada de esto se ha ejecutado en producción.**

## Antes de empezar (tú, en OpenRouter)
1. Crea una cuenta/clave **solo para pruebas**, con **saldo de US$5** y, si existe la opción, **límite de crédito de la clave de US$2**. Recarga automática **desactivada**. No copies la clave a ningún chat; mantén la pestaña abierta para pegarla en el paso 3.

## En el VPS (como root)
1. **Obtener el script** (rama `claude/router-ia-solo`, hasta que se fusione; verifica el hash):
   ```
   cd /opt/crea-oficina/app/deploy/convivencia
   curl -fsSL https://raw.githubusercontent.com/JCMMEIA/Crea-tu-oficina-IA/claude/router-ia-solo/deploy/convivencia/configurar_openrouter.sh -o configurar_openrouter.sh
   sha256sum configurar_openrouter.sh    # compáralo con el hash que aparece en el PR
   ```
2. **Simulacro** (no cambia nada, solo dice qué está definido):
   ```
   sudo bash configurar_openrouter.sh
   ```
3. **Cargar la clave** (te la pide sin mostrarla):
   ```
   sudo bash configurar_openrouter.sh --aplicar
   ```
   Pega la clave cuando lo pida. Responde `SI` para reiniciar solo `crea-oficina` (el script comprueba que responde y, si no, **revierte solo**).
4. **Comprobar que el router sigue apagado y qué falta** (solo lectura): el script ejecuta `npm run ia:preparado`. Debe decir «AI_ROUTER está APAGADO» y listar lo que falta (modelos verificados). **Es lo esperado.**
5. **Registrar modelos** en `https://app.mmeia.tech/admin/ia` cuando existan modelos verificados (ver `SELECCION_MODELOS.md`); ajusta las reglas: tope por llamada **0.05**, gratuito→pago **desactivado**.
6. **Prueba de humo** (UNA llamada a Sonnet 5.5, con restricciones fijadas en la solicitud): ver `INSTALAR_ROUTER_VPS.md`, sección 5, y `PRUEBA_HUMO_SONNET.md`. Sin `--autorizo-una-llamada-facturable` solo hace un simulacro local.
7. **Evaluación con las 8 tareas** (después del paso 6): `ia:evaluar` con `--dry-run` primero y luego `--max-usd 1` (ver `PRUEBA_REAL_OPENROUTER.md`).

## Reversión
- Restaurar el archivo: `sudo cp -p /var/backups/crea-oficina/env.openrouter.<fecha>.bak /etc/crea-oficina/env && sudo systemctl restart crea-oficina`.
- Revocar la clave: en OpenRouter (Keys → Delete). El router sigue apagado; nada depende de ella.

## Qué NO se debe hacer
No pegar la clave en el chat, en GitHub, en correos ni en capturas; no poner `AI_ROUTER=on` hasta tener modelos verificados, presupuestos y la prueba real aprobada por ti.
