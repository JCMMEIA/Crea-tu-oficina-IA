# Modelo de venta directa y varias oficinas por cuenta — reporte

Fecha: 2026-11-04. Auditoría: `docs/COMPRA_DIRECTA_AUDITORIA.md`. **Nada se publicó ni se desplegó. Los cobros reales siguen apagados.**

## Lo que existe ahora
**Flujo:** Meta Ads → Landing → botón «Crear mi oficina IA» → Stripe Checkout (Stripe pide el correo) → webhook firmado → **recién entonces** se crean cuenta (sin contraseña), oficina privada, plan y suscripción → correo con enlace de acceso (30 min, un solo uso) → asistente de configuración (nombre, tipo de negocio, plantilla, departamentos y empleados con valores sugeridos) → primera tarea → panel con **NUEVA OFICINA IA** y **MIS OFICINAS**.

| Requisito | Cómo se cumple |
|---|---|
| Sin registro previo, sin demos, sin aprobaciones manuales | `/registro` cerrado por defecto; landing sin formularios de demo; el operador solo ve errores |
| Compra sin cuenta | `/comprar` crea una *intención* (sin cuenta ni acceso) y redirige a Stripe |
| No crear agencia hasta el webhook | Probado: antes del pago 0 agencias, 0 pedidos, 0 cuentas de comprador |
| Idempotencia | `orders.checkout_session_id` único + derecho de creación atómico + eventos de Stripe deduplicados. Probado: mismo pago 5 veces (4 en paralelo) → 1 agencia, 1 pedido, 1 cuenta, 1 correo |
| Cliente existente | Se vincula por la sesión de quien compra o por correo; nunca duplica usuarios |
| Aislamiento | Cada oficina = agencia con sus clientes, empleados, tareas, archivos, límites, plan y suscripción. Pruebas unitarias, en PostgreSQL y en navegador (abajo) |
| Varias oficinas por cuenta | «Mis oficinas» (entrar con un clic) y «Nueva oficina» (elige negocio/plantilla/empleados, **ve el precio antes**, paga; la oficina nace solo con el pago confirmado o un derecho disponible) |
| Sin cobros duplicados | Un derecho = una oficina; pagar dos veces el mismo flujo en 20 min **reutiliza el mismo pago abierto** |
| Pausar / cancelar una oficina sin afectar otras | Pausa (también detiene el cobro en Stripe) y «cancelar al final del periodo». Datos nunca se borran |
| Comprobantes, renovaciones, cancelaciones, correos, recuperación, soporte | Facturas guardadas desde `invoice.paid`; estados `pago_pendiente`/`cancelada`; correos de bienvenida, acceso, pago fallido y cancelación; `/recuperar` (respuesta idéntica exista o no el correo); ayuda y soporte existentes |
| Seguridad | Stripe solo `sk_test_` (live bloqueado); registro cerrado; **tienda cerrada** salvo que haya: cobros activos + precio en pesos + correo configurado + **IA verificada** con una llamada real (<48 h) |
| No mostrar empleados simulados como reales | La app no tiene proveedor simulado; sin IA verificada no se vende |
| Dashboard | `/admin/conversion`: visitantes, clics de compra, pagos iniciados, pagos confirmados, oficinas entregadas y **activadas**, ingresos, pedidos, costo de adquisición |

## Pruebas (ejecutadas)
- **225/225** pruebas automáticas, también **225/225 contra PostgreSQL 16 real**. Nuevas: entrega e idempotencia (incluida concurrencia), eventos de suscripción **fuera de orden**, enlaces de un solo uso y caducidad, correos (sin token en la base, reintentos, sin doble envío), compuerta de venta, derechos de creación (concurrentes), pausas/cancelaciones y **aislamiento entre oficinas y entre cuentas**.
- **E2E en navegador (63/63)** — `scripts/e2e/compra_directa.sh`, evidencia en `docs/comercial/evidencia_compra/`: tienda cerrada → operador verifica IA → landing con anuncio → pago → webhook (firma mala rechazada, 5 reenvíos) → una oficina y un correo → enlace (abrirlo no lo gasta; reusarlo falla) → configuración con valores predeterminados → **primera tarea ejecutada por el flujo de IA real** → panel con los dos botones → segunda oficina (precio visible, anti doble pago) → misma cuenta con 2 oficinas → otro comprador con cookies falsificadas **no ve nada ajeno** → pausar una (no ejecuta IA, la otra sí) → cancelar otra → comprobante, pago fallido (aviso + correo) → recuperar acceso → dashboard (CAC «Sin datos» hasta registrar gasto; luego $500 con $1,000 y 2 compras).
- Regresión: el flujo de agencias y sus pruebas de aislamiento anteriores siguen pasando.

### ⚠️ Qué NO está verificado (honestidad)
- **Stripe, Resend y Anthropic fueron SIMULADOS** (servidores locales `scripts/e2e/mocks.cjs`). Se prueba **nuestro código** de punta a punta; **no** las plataformas reales. Formatos de webhook/API según su documentación pública. Falta un pago de **prueba** real con claves `sk_test_` y un correo real.
- «Primera tarea real»: la ejecutó el proveedor Anthropic de la app contra un servidor simulado; con **Claude real sigue sin verificarse**.
- Reembolsos y disputas **no** se automatizan (se gestionan en Stripe; el operador pausa/cancela). Sin CFDI/IVA. Los compradores no tienen contraseña (solo enlace por correo).
- Dominio de correo: hay que verificar SPF/DKIM de `mmeia.tech` en Resend, o los correos caerán en spam.
- Las E2E antiguas (`redesign.cjs`, `commercial.cjs`) validan la landing anterior y fallan en esos puntos por diseño; el flujo central sí pasa.

## Dashboard — definiciones
Visitantes = vistas de la landing (no personas únicas; sin cookies ni IP). Activada = oficina con ≥1 empleado y ≥1 tarea completada. CAC = gasto en anuncios que **tú registras** ÷ primeras compras; sin gasto registrado: «Sin datos».

## Instrucciones de despliegue en TU VPS (convivencia con OpenClaw)
Orden recomendado; **nada de esto se hace sin tu autorización**:
1. (Una vez) terminar la instalación pendiente: `continuar_fase8.sh` (ver `CONVIVENCIA_OPENCLAW.md`).
2. **Actualizar a esta versión**: `cd /root/crea-instalador && git pull && cd deploy/convivencia && sudo bash actualizar_convivencia.sh` (simulacro) y luego `… --aplicar`. Hace respaldo, compila con tope de memoria, reinicia **solo** `crea-oficina`, comprueba y vuelve atrás si falla. Las tablas nuevas se crean solas al arrancar (con respaldo previo).
3. **Cargar las claves sin que se muestren**: `sudo bash configurar_ventas.sh` (precio en MXN, claves `sk_test_`/`whsec_` de Stripe, Resend, Anthropic y sus tarifas). Solo acepta claves de PRUEBA; los cobros se encienden con la frase `ACTIVAR PRUEBAS`.
4. En **Stripe (modo prueba)** crea un webhook a `https://app.mmeia.tech/api/billing/webhook` con los eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; copia su `whsec_…`. En su portal de cliente permite cancelar y actualizar pago.
5. En **Resend**: crea cuenta, verifica el dominio `mmeia.tech` (SPF/DKIM) y crea la clave.
6. Tu acceso de operador (sin registro): `cd /opt/crea-oficina/app && sudo -u ctoapp bash -c 'set -a; . /etc/crea-oficina/env; set +a; PATH=/opt/crea-oficina/node/bin:$PATH npm run admin:link -- TU@CORREO'` → imprime un enlace de 30 min. (Tu correo debe estar en `PLATFORM_ADMIN_EMAILS`.)
7. `/admin/conversion` → «Verificar IA ahora» (una llamada real, centavos). La tienda se **abre sola** solo cuando cobros + precio + correo + IA estén listos; `npm run tienda:estado` dice qué falta.
8. Prueba con tarjetas de prueba de Stripe (`4242 4242 4242 4242`): compra → correo → acceso → configuración → primera tarea. **Solo después** de revisar eso se te pedirá autorización para claves reales.

## Autorizaciones que necesito de ti
(1) Actualizar la VPS (paso 2). (2) Cuentas/claves de Stripe (modo prueba), Resend y Anthropic (tu dinero y tus cuentas). (3) Precio en pesos. (4) Pagar una compra de prueba real en modo prueba. (5) **Más adelante y por separado**: claves reales de Stripe (`STRIPE_ALLOW_LIVE`), abrir anuncios.

## Pendiente (por fases)
Pago de prueba real de punta a punta; Claude real; reembolsos/disputas; CFDI; crear contraseña opcional; política de privacidad y términos revisados por un abogado.
