# Procedimiento en el VPS: configurar el correo (Resend) sin tocar Stripe ni precios

Script: `deploy/convivencia/configurar_correo.sh` (SHA-256 `10fdd229648a3373157b5699ad25439f4df71d681d4c854c9d340a52d6cfa3d4`). Solo modifica estas variables: `RESEND_API_KEY`, `MAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `PLATFORM_ADMIN_EMAILS` (solo AGREGA), `RESEND_WEBHOOK_SECRET`.
No toca Stripe, precios, Anthropic, base de datos, `BILLING_ENABLED` ni `PUBLIC_SIGNUP`; lo comprueba con una huella antes/después y restaura el respaldo si algo cambia. No imprime secretos ni enlaces. Reinicia solo `crea-oficina` y solo si escribes SI.

## Qué necesita TU intervención (nadie más puede hacerlo)
| Paso | Quién |
|---|---|
| Crear la API key en Resend y pegarla **en el VPS** cuando el script la pida (no se verá) | Tú |
| Confirmar que Resend muestra `mmeia.tech` como **Verified** | Tú |
| Crear el webhook en Resend y pegar el *Signing secret* | Tú |
| Escribir SI para reiniciar `crea-oficina` y SI para enviar el correo de prueba | Tú |
| Mirar tu bandeja/spam y confirmar que llegó | Tú |

## Pasos (uno a la vez)
1. **Obtén el script en el VPS** (como root). Opción A, si el repositorio es público y la rama está subida:
   ```
   curl -fsSL https://raw.githubusercontent.com/JCMMEIA/Crea-tu-oficina-IA/claude/configurar-correo/deploy/convivencia/configurar_correo.sh -o /root/configurar_correo.sh
   echo "10fdd229648a3373157b5699ad25439f4df71d681d4c854c9d340a52d6cfa3d4  /root/configurar_correo.sh" | sha256sum -c -
   ```
   Debe decir `OK`. Si dice FAILED, no lo ejecutes. Necesita además `lib.sh`; si lo ejecutas desde la carpeta del repo instalado (`/opt/crea-oficina/app/deploy/convivencia`) ya está. Opción B: pega el archivo con `nano` dentro de esa carpeta.
2. **Simulacro** (no cambia nada, solo dice qué está definido):
   ```
   sudo bash configurar_correo.sh
   ```
3. **Aplicar:** `sudo bash configurar_correo.sh --aplicar` y responde a cada pregunta. Enter = no cambiar.
   - *Clave de Resend:* Resend → API Keys → Create API Key → **Sending access** → Add. Pégala cuando lo pida.
   - *Dominio verificado:* responde SI **solo si** Resend dice Verified. Si no, responde no; el script no pondrá remitente y la aplicación dejará los correos en cola con el motivo visible (no se pierde nada).
   - *Dirección pública:* SI para fijar `https://app.mmeia.tech`.
   - *Correo de operador:* Enter si tu correo ya está en la lista; si no, escríbelo para **agregarlo** (no reemplaza los existentes).
   - *Webhook:* Resend → Webhooks → Add Endpoint → URL `https://app.mmeia.tech/api/email/webhook`; eventos `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`. Copia el *Signing secret* (`whsec_…`) y pégalo. Puedes hacerlo después volviendo a correr el script.
4. **Reiniciar:** responde SI. Reinicia solo `crea-oficina`, verifica `/api/health` y compara OpenClaw. Si la aplicación no responde, restaura el respaldo automáticamente.
5. **Comprobar que la aplicación carga la configuración:** el script ejecuta `npm run correo:diagnostico` (muestra definida/no definida, DNS, cola; sin secretos).
6. **Correo real de prueba:** responde SI cuando lo pida (usa `--admin --esperar`, va al primer correo de operador).
7. **Mira tu bandeja y spam**, y abre `https://app.mmeia.tech/admin/correos`.

## Las tres etapas: no confundirlas
| Etapa | Qué significa | Dónde se ve |
|---|---|---|
| **API aceptó** | Resend recibió la orden (estado «aceptado») | `/admin/correos` y salida del diagnóstico |
| **Entregado** | Resend confirma que el servidor del destinatario lo recibió (webhook `email.delivered`, con firma) | `/admin/correos`, columna entrega |
| **Recibido** | **Tú lo ves** en la bandeja (no spam) | Solo tú puedes confirmarlo |
«Aceptado» sin «entregado» tras unos minutos = revisar el webhook o el dominio. «Entregado» pero en spam = revisar DMARC/SPF (ver CONFIGURAR_RESEND_Y_DNS.md).

## Reversión
El respaldo queda en `/var/backups/crea-oficina/env.correo.<fecha>.bak` (permiso 600). Para volver atrás: `sudo cp -p <respaldo> /etc/crea-oficina/env && sudo systemctl restart crea-oficina`.

## Qué NO hace este procedimiento
No activa pagos ni registros públicos, no cambia precios, no toca OpenClaw ni reinicia el servidor, no despliega código nuevo. El panel `/admin/correos` y el comando `correo:diagnostico` existen **si** el VPS ya tiene la versión actual de la aplicación; si no, primero hay que actualizarla con `actualizar_convivencia.sh` (con respaldo y reversión) tras tu autorización.
