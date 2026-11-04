# Configurar Resend y DNS (Hostinger) — un paso a la vez

No hagas el siguiente paso hasta terminar el anterior. **No borres ni edites** los registros MX/SPF que ya existan en la raíz de `mmeia.tech` (correo actual); lo de Resend va en subdominio `send` y en `resend._domainkey`.

1. **Resend → Domains → Add Domain** → `mmeia.tech` (región cercana a México/EE. UU.). Resend te muestra los registros a crear. *Copia exactos los valores de Resend; los de abajo son la forma.*
2. **Hostinger → Dominios → mmeia.tech → DNS / Servidores de nombres → Administrar registros.** Añade (no reemplaces):

| Tipo | Nombre | Valor |
|---|---|---|
| TXT | `resend._domainkey` | el valor largo `p=MIGf…` que da Resend (DKIM) |
| MX | `send` | `feedback-smtp.<región>.amazonses.com`, prioridad 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT (opcional, recomendado) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<tu correo de reportes>` |

   Si ya existe un `_dmarc`, **no crees otro**; deja el existente.
3. En Resend pulsa **Verify**. Espera hasta que diga *Verified* (minutos a horas).
4. **Resend → API Keys → Create** con permiso *Sending access* limitado al dominio. No la pegues en chats ni en GitHub.
5. **En el VPS** (carga secretos sin escribirlos en archivos del repo): `sudo bash deploy/convivencia/configurar_ventas.sh`. Remitente recomendado: `Crea tu Oficina IA <acceso@mmeia.tech>` (solo cuando el dominio esté verificado).
6. **Resend → Webhooks → Add endpoint**: `https://app.mmeia.tech/api/email/webhook`, eventos `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`. Copia el *signing secret* (`whsec_…`) y cárgalo con el mismo script (campo `RESEND_WEBHOOK_SECRET`).
7. Comprueba: `npm run correo:diagnostico -- --admin --enviar <tu-correo> --esperar`.
