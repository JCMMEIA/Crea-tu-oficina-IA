# Mi oficina en el celular — WhatsApp y Telegram

Permite a propietarios de agencia y clientes autorizados hablar con sus empleados de IA por **Telegram** (Bot API) y **WhatsApp** (Business Platform / Cloud API): enviar ideas, asignar tareas, consultar avances, recibir resultados y aprobar acciones. Sección web: `/celular`.

## Auditoría del motor de tareas (punto de partida) y qué se reutilizó
| Pieza existente | Uso en mensajería |
|---|---|
| `createTask` (huella anti-duplicado, profundidad/cadena, empleado activo) | **Única** vía de creación: el chat registra `created_by = canal:<canal>` |
| `runWorkflow/runTask` (límites de presupuesto/hora/día, tarifa, timeout, reintentos transitorios, herramientas por permiso, evidencia en `task_events`) | Ejecución idéntica a la web; el chat no tiene un motor paralelo |
| `decideApproval` + `approvals` | La aprobación por chat llama a la misma función (ejecuta con evidencia) |
| `actAs` / `memberships` / `can()` | El acceso de la persona se **recalcula en cada mensaje** (`messaging/access.ts`) |
| `audit` | Vinculación, revocación, ajustes, credenciales (sin secretos ni códigos) |
| **Huecos que cubrí** | No había cola (la tarea corría en la petición) → tabla `jobs` + `processJobs`; las aprobaciones no caducaban → `approvals.expires_at` (72 h) comprobado en `decideApproval`; faltaba origen de la tarea → `channel_tasks` |

## Arquitectura
```
Telegram/WhatsApp → /api/channels/{telegram,whatsapp}  (autentica: secret_token / HMAC-SHA256 sobre cuerpo crudo)
   → handleInbound (idempotente por id de mensaje) → coordinador → createTask (motor existente) → job run_task
   → [cola `jobs`: reintentos con espera, deduplicación, recuperación de bloqueos]
   → runWorkflow → notificaciones/respuestas en `outbox` (idempotente, preferencias, límites, ventana 24 h) → adaptador del canal
```
El webhook responde 200 de inmediato y el trabajo sigue en segundo plano (`after()`); además `POST /api/jobs/tick` (cron, `CRON_SECRET`) o `npm run jobs:tick` reintenta y envía avisos/resúmenes.

## Vinculación segura
1. Sesión autenticada → «Conectar» + **consentimiento** → código de 8 caracteres (sin O/I/L/0/1), **un solo uso, vence a los 10 min**, solo se guarda su hash (HMAC con `APP_SECRET`); aparece una vez en pantalla (estado de la acción: ni URL ni cookie ni registros).
2. La persona lo envía **desde el canal** (Telegram: `t.me/<bot>?start=<código>`; WhatsApp: `wa.me/<número>?text=<código>`). La identidad verificada es el **id numérico de Telegram / el número que firma Meta**, jamás el @usuario.
3. Protecciones: 5 fallos/15 min por cuenta del canal → bloqueo; tope global de fallos por hora; un código nuevo invalida los anteriores; una cuenta de canal no puede estar activa en dos personas; el código se **redacta** en mensajes guardados.
4. Chats no vinculados: nunca se ejecutan órdenes; solo reciben instrucciones de vinculación (máx. 1 por hora). Solo chats privados (Telegram).

## Coordinador, comandos y aprobaciones
Lenguaje natural («Investiga cinco competidores para mi cliente Alquimia») o comandos: `mis clientes`/`cambiar empresa`, `mis empleados`, `tareas pendientes`, `estado <id>`, `ver resultados [id]`, `asignar <empleado>: …`, `aprobar|rechazar|confirmar <código>`, `notificaciones`, `baja`, `ayuda`.
- Empresa: la mencionada («cliente X») **si tiene acceso**; si no existe entre las suyas → «no la encontré» (sin revelar si existe en otra agencia); si tiene varias, **pregunta**. Empleado: heurística local por puesto/descripción/responsabilidades (ponderada por rareza); si es ambiguo, **pregunta**; si falta detalle, **pide más datos**. *No usa IA para interpretar* (pendiente).
- Aprobaciones: aviso con código **ligado a esa acción y a esa persona** (30 min, un solo uso, hash). «sí/ok/dale» **no** aprueban. Acciones sensibles (publicar, presupuesto, mensajes a clientes, precios, descuentos): **dos pasos** (`APROBAR` → detalle → `CONFIRMAR`, 5 min). Se **re-comprueban permisos actuales** y vigencia; 5 códigos erróneos bloquean 10 min.

## Seguridad multiagencia
Aislamiento por `actorFor/actAs` (mismas reglas que la web); revocación (propia o del administrador de la agencia dentro de su alcance; no revoca a quien pertenece a otra organización); `channel_messages` trazan cada mensaje (texto con códigos redactados); webhooks autenticados; idempotencia por `(canal, id de mensaje)` + deduplicación de trabajos; límites: 15 mensajes/min por persona, 30 mensajes/h salientes, avisos/día por agencia, presupuesto de IA existente; texto del chat = **entrada no confiable** (va como tarea; los permisos los decide el backend). Secretos de plataforma solo en variables de entorno; `agency_channel_credentials` guarda secretos por agencia **cifrados (AES-256-GCM)** — preparado, sin uso todavía.

## Notificaciones
Preferencias por persona (tareas terminadas, errores, aprobaciones, alertas, resumen diario), consentimiento registrado, deduplicación por clave, tope diario por agencia. **WhatsApp:** respuestas libres solo dentro de 24 h desde el último mensaje del usuario; fuera de la ventana solo plantilla aprobada (`WHATSAPP_TEMPLATE_NOTIFY`) o el aviso se **omite** y queda registrado. Alertas: aprobaciones pendientes (incl. las creadas en la web) y consumo ≥ 80 %.

## Marca blanca (alcance honesto)
Por agencia: nombre del asistente, bienvenida, tono, empleados asignables, avisos/día, resúmenes. **Todas las agencias comparten el bot/número central**: la cuenta remitente NO lleva la marca de la agencia (no se promete aislamiento visual). Bots/números propios: fase posterior (base de credenciales cifradas lista).

## Requisitos externos (SIN verificar: no pude acceder a core.telegram.org ni developers.facebook.com)
**Telegram:** crear bot con @BotFather; `setWebhook` a `https://<dominio>/api/channels/telegram` con `secret_token` = `TELEGRAM_WEBHOOK_SECRET`; variables `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`. **WhatsApp:** cuenta Meta Business, app con producto WhatsApp, número registrado en Cloud API (sin WhatsApp personal activo en él), token permanente de usuario del sistema, webhook `https://<dominio>/api/channels/whatsapp` suscrito a «messages» con `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DISPLAY_NUMBER`; plantilla de utilidad aprobada para avisos fuera de la ventana; verificación de empresa y **costos por mensaje/conversación** según la tarifa vigente de Meta (consultarla antes de activar). Endpoints, cabeceras y formatos están escritos de memoria: **contrastarlos con la documentación vigente** al conectar cuentas.

## Texto, voz y archivos
Solo **texto** está habilitado. Voz, imágenes y documentos: se reconocen y se responde que aún no están habilitados; ya existe la validación (`attachments.ts`: tipo, tamaño, nombre) pero **no se descargan ni procesan archivos ni hay transcripción**.
