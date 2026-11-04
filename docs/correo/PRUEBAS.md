# Las 7 etapas de verificación

| # | Etapa | Cómo se comprueba | Estado hoy |
|---|---|---|---|
| 1 | El servidor acepta la solicitud | `/recuperar` + `emails` en cola | Verificado en pruebas automáticas y E2E (servidor simulado) |
| 2 | Resend acepta el envío | `provider_status` 200 en `/admin/correos` | **Sin verificar**: requiere clave real |
| 3 | El proveedor confirma entrega | webhook → `delivery_status=delivered` | Lógica y firma Svix probadas con eventos simulados; **sin verificar** contra Resend real |
| 4 | Llega al buzón | revisión humana (bandeja y spam) | **Sin verificar** |
| 5 | El enlace abre | `/acceso` con HTTPS | Verificado en E2E (local, simulado) |
| 6 | Inicia sesión | enlace de un solo uso, 30 min | Verificado en E2E |
| 7 | Entra al panel de administración | correo en `PLATFORM_ADMIN_EMAILS` | Verificado en E2E con correo ficticio |

Aceptación de la API (2) **no** es entrega (3) ni llegada al buzón (4). Las etapas sin verificar se cierran ejecutando el comando de diagnóstico en el VPS después de los pasos de CONFIGURAR_RESEND_Y_DNS.md.
