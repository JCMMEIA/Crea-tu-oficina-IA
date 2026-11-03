# Preparación para el lanzamiento privado — reporte

Fecha: 2026-11-03. Repo: `JCMMEIA/crea-tu-oficina-ia` (rama `main`). Qué hacer tú: **`docs/INSTRUCCIONES_JOSE.md`**. Pasarela: `docs/PASARELA_Y_COMPRAS.md`.
Separo siempre **probado aquí** de **no probado**.

## Prioridad 1 — Despliegue privado (Hostinger, PostgreSQL, HTTPS, seguridad)
| Punto | Estado |
|---|---|
| PostgreSQL real | **PROBADO**: PostgreSQL 16 real (local). **190+ pruebas automáticas pasan contra él** (antes solo PGlite) y el recorrido en navegador (36 comprobaciones) corre sobre la aplicación compilada con esa base. Esto cierra el bloqueante A2 de `PILOTO_HOSTINGER.md` salvo la red/servidor de Hostinger. |
| Respaldo y restauración | **PROBADO**: volcado → restaurar en otra base → mismos datos. Reinicio de la app sobre la base existente: sin pérdida. |
| Revisión de configuración | **NUEVO y probado**: `npm run preflight` dice ✅/❌ por cada variable (sin mostrar valores) y comprueba la conexión a la base. |
| Cabeceras de seguridad | **PROBADO** (HSTS, no-sniff, anti-iframe, referrer, permisos). **Falta** Content-Security-Policy (requiere pruebas con nonce). |
| Rutas protegidas | **PROBADO**: `/admin` solo operadores; cron 401 sin clave; webhook de pago 404 con cobros apagados. |
| Instalador (`deploy/instalar.sh`) | Escrito (Node 22, PostgreSQL, Nginx, HTTPS con Let's Encrypt, servicio, firewall, cron, respaldos, claves generadas al azar). **Solo revisión de sintaxis: NO ejecutado en un VPS real.** Primer despliegue = prueba de verdad; puede necesitar ajustes. |
| HTTPS / dominio / Hostinger | **NO verificado** (no hay cuenta ni dominio en esta sesión). Nota: la plantilla «Node.js + OpenLiteSpeed» de Hostinger **choca** con Nginx: usar Ubuntu 24.04 limpio. |
| Seguridad que sigue faltando | Verificación de correo, recuperación de contraseña, 2FA, límite por IP (hoy solo por correo), CSP, aislamiento por filas en BD (depende del código; probado por pruebas), auditoría externa. Aceptable para un piloto cerrado, no para abrir. |
| Publicación | **No se publicó ni se desplegó nada.** |

## Prioridad 2 — Claude real con Verde Vivo
**ESTADO: NO VERIFICADO. No existe evidencia de ejecución con el modelo real**, porque esta sesión no tiene `ANTHROPIC_API_KEY` (verificado: la variable no existe) y no voy a usar claves ajenas ni inventar resultados.
Preparado: `npm run pilot:claude` ahora **exige** pruebas de que la API respondió (tokens medidos por el proveedor en cada llamada, ≥3 tareas, 66 unidades, 1 aprobación) y **solo entonces** escribe `docs/pilot/evidencia/claude_real.json`. Sin clave imprime «NO VERIFICADO» y sale con error (probado). Costo esperado: centavos (tope interno de 1 USD). Pasos exactos: Parte 2 de `INSTRUCCIONES_JOSE.md`.

## Prioridad 3 — Compra, licencias, activación, pasarela
Ver `docs/PASARELA_Y_COMPRAS.md`. Resumen: recomendación **Stripe México** (alternativas Mercado Pago / Conekta / OpenPay); proveedor Stripe implementado y **probado solo contra un Stripe simulado** (firma, idempotencia, MXN, plan y agencia); claves `sk_live_` rechazadas; `BILLING_ENABLED=false`; no se hizo ningún cobro ni se contactó a Stripe. Hallazgos: sin cancelación por el cliente, sin CFDI, sin conciliación de webhooks perdidos, bajar de plan no recorta lo existente.

## Prioridad 4 — Landing, formulario, privacidad, panel (auditoría)
**Listo (probado en navegador, escritorio y 390 px):** landing, `/demo`, `/gracias`, `/planes`, `/registro`, ayuda; consentimiento obligatorio; honeypot; fuente de tráfico hasta el panel; panel de prospectos con estados, notas, recordatorios; `robots.txt` (oculta admin/app) y `sitemap`; Meta Pixel solo con consentimiento; sin precios inventados.
**Corregido en esta ronda:** el registro ahora enlaza la política de privacidad; el pie muestra el correo de contacto; el panel puede **borrar a un prospecto** (derecho de cancelación); mensaje de retorno del pago ya no dice «pago recibido» antes de confirmarlo; `/admin` no se indexa.
**NO está listo para tráfico real hasta que:**
1. `NEXT_PUBLIC_CONTACT_EMAIL` esté definido **antes de compilar** (el preflight lo exige; sin él la política dice «el correo publicado en este sitio», que no existe).
2. Un **abogado revise la política** (sigue siendo borrador, sin razón social) y existan **términos del servicio** (no hay).
3. Alguien **revise `/admin` a diario**: no hay correo, nadie recibe aviso de un prospecto nuevo.
4. Se acepte que el tope anti-abuso (200 envíos/hora) también podría bloquear envíos reales ante un ataque.
5. Se entienda que «visitas» no son personas únicas y que no hay imagen para compartir en redes (sin Open Graph image).

## Prioridad 5
`docs/INSTRUCCIONES_JOSE.md`.

## Cambios de código (solo indispensables)
`tests/helpers.ts` (pruebas contra PostgreSQL con `TEST_DATABASE_URL`), `src/server/ops/preflight.ts` + `scripts/preflight.ts`, cabeceras en `next.config.ts`, `robots.ts`/`sitemap.ts`, proveedor Stripe + webhook idempotente, `deleteLead`, `deploy/*.sh`, evidencia de Claude en `scripts/pilot/claude_check.ts`.
