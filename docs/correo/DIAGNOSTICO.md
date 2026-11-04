# Diagnóstico: el enlace de acceso nunca llega

## Lo que se encontró en el código (verificado)
1. **Fallo silencioso sin proveedor.** Si faltaban `RESEND_API_KEY` o `MAIL_FROM`, el correo quedaba en cola sin ningún error visible; la pantalla decía «te enviamos un enlace» igual. Ahora el correo queda marcado con el motivo y el panel `/admin/correos` lo muestra.
2. **Se perdía el mensaje de Resend.** Un 403 («dominio no verificado») se guardaba como error genérico. Ahora se guarda el código y el mensaje del proveedor y se traduce a causa + solución.
3. **«Enviado» no significaba «entregado».** Antes un 200 de Resend se marcaba como enviado y ahí terminaba. Ahora el estado es `aceptado` hasta que el webhook de Resend confirma `delivered` (o `bounced`, `complained`, `delayed`).
4. **Sin enlace absoluto** si faltaba `SITE_URL`: ahora el envío falla con `sin_sitio` en vez de mandar un enlace roto.

## Lo que NO se pudo verificar (honesto)
La causa real **en tu servidor** no se puede ver desde aquí (sin acceso al VPS, a Resend ni al DNS de mmeia.tech). Las causas más probables, en orden:
1. No hay `RESEND_API_KEY`/`MAIL_FROM` cargados en el servidor.
2. El dominio `mmeia.tech` no está verificado en Resend (Resend responde 403/422).
3. El remitente usa un dominio distinto al verificado.
4. El correo se acepta pero cae en spam por falta de SPF/DKIM/DMARC.
5. El temporizador de la cola (`crea-tick-cola`) no corre.

## Cómo saber cuál es (un comando)
En el VPS, desde la carpeta de la app:
```
npm run correo:diagnostico -- --admin
```
Imprime, sin mostrar claves: configuración, estado de la cola, alcance del proveedor, DNS, y causa + solución de cada problema. Lo mismo se ve en `/admin/correos` (botón «Comprobar DNS»).
