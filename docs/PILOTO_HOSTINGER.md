# Lista para desplegar un piloto PRIVADO en Hostinger

Estado: **nada de esto se ha hecho ni verificado** (no hay cuenta de Hostinger en esta sesión; no se desplegó nada). Lo de Hostinger marcado «confirmar» no lo pude comprobar con su documentación.

## A. Bloqueantes (sin esto no se debe invitar a nadie)
| # | Falta | Detalle |
|---|---|---|
| 1 | **Plan con Node.js y proceso permanente** | Un **VPS** es lo más seguro (confirmar si su plan «Node.js» corre procesos largos y cron). El hosting solo-PHP **no sirve**. Requiere Node 22. Los avisos y reintentos usan `after()` y una cola dentro del proceso: **no funcionan en serverless** |
| 2 | **PostgreSQL** | Producción usa `DATABASE_URL` (`pg`). **Esa ruta nunca se probó contra un Postgres real** (todas las pruebas usaron PGlite). Primera tarea: levantar Postgres (en el VPS o Neon/Supabase), correr `npm run check` y el piloto contra él. El esquema se crea al arrancar (`CREATE … IF NOT EXISTS`, varias sentencias en una sola consulta: **sin verificar** con `pg`) |
| 3 | **Claves del piloto** (solo en variables de entorno, nunca en git) | `APP_SECRET` (`openssl rand -base64 32`), `CRON_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY` + `MODEL_ID` + `MODEL_INPUT_USD_PER_MTOK` + `MODEL_OUTPUT_USD_PER_MTOK` (sin tarifa **no ejecuta**) |
| 4 | **Tope de gasto en la consola de Anthropic** | Los topes internos son estimaciones (agencia 20 US$/mes, cliente 5 US$/mes en el piloto). El tope del proveedor es el único estricto |
| 5 | **Cerrar el registro** | `SIGNUP_ALLOWED_EMAILS=correo1,correo2`. Sin esto cualquiera con la URL crea una agencia |
| 6 | **HTTPS + dominio** | Las cookies de sesión son `Secure` en producción y los webhooks de Telegram/WhatsApp exigen HTTPS público. Nginx (o similar) como proxy + certificado (Let's Encrypt) |
| 7 | **Verificar Claude real** | `npm run pilot:claude` en el servidor. Hasta entonces la IA es **no verificada** |
| 8 | **Programador** | Cada 15 min: `POST /api/cron/tick` (automatizaciones) y cada minuto `POST /api/jobs/tick` (cola/avisos), ambos con `Authorization: Bearer $CRON_SECRET`. Confirmar que Hostinger permite cron/`curl` |
| 9 | **Salida de red** | El servidor debe poder llamar a `api.anthropic.com` (y `api.telegram.org`/`graph.facebook.com` si se usan). Confirmar |
| 10 | **Respaldos y registro de errores** | Copia diaria de Postgres; guardar logs (pm2/journald). No existe monitoreo |

## B. Para arrancar el piloto
1. Crear la cuenta de la dueña de Nova con un correo autorizado (`/registro`) y repetir el flujo: agencia → cliente «Verde Vivo» → contratar los 3 empleados → **Inventario → cargar el CSV real** → «Revisar inventario ahora».
2. Crear la automatización diaria (hoy es «cada N minutos», no «a las 8:00»).
3. Telegram (opcional): bot con @BotFather; variables `TELEGRAM_*`; `npm run pilot:telegram`; `setWebhook` a `https://TU-DOMINIO/api/channels/telegram` con el secreto.
4. Quitar los datos de práctica y no usar el CSV «Verde Vivo (inventado)» con datos reales mezclados.

## C. Seguridad que NO está (aceptable para un piloto cerrado de pocas personas, no para abrir)
Verificación de correo · recuperación de contraseña · 2FA · límite de intentos por IP · seguridad por filas en Postgres (el aislamiento depende del código, probado con pruebas) · auditoría externa. La política de privacidad es un **borrador sin revisión legal**.

## D. Decisiones pendientes de José
Quién opera el servidor y las claves · presupuesto mensual de IA del piloto · confirmar la regla de resurtido y el CSV real de Verde Vivo · si el piloto se limita a pocas personas con correo autorizado · fecha límite para decidir si se pasa a un piloto con clientes reales (hoy: **no**).
