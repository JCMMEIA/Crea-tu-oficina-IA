# Sistema comercial — auditoría, qué se construyó y qué falta para cobrar

Fecha: 2026-11-03. Evidencia: `docs/comercial/evidencia/` (capturas + `e2e_comercial.json`), `tests/commercial.test.ts` (17 pruebas), `scripts/e2e/commercial.cjs` (36 verificaciones en navegador).

## 1. Auditoría de lo que ya existía (antes de este cambio)

| Pieza | Estado real |
|---|---|
| Landing `/` | Funcionaba, con CTA solo a «acceso anticipado». Sin demo, sin planes, sin enlace a ayuda. |
| Leads | Solo correo/nombre/etapa/mensaje + UTM. **Sin estado de venta, sin panel, sin notas, sin recordatorios, sin fuente de tráfico real, y nadie podía leerlos salvo con SQL.** |
| Medición | Solo píxel de Meta (apagado sin ID y sin consentimiento). **Cero visitas, cero embudo.** |
| Planes | `plans.ts`: solo límites (clientes/empleados), sin precios, sin pantalla, sin licencias. |
| Onboarding | `/empezar` (6 pasos) y demo office: sí funcionaban. **No se reconstruyó.** |
| Ayuda | `/ayuda` con 5 pasos y 5 preguntas; sin tutoriales ni forma de contactar a una persona. |
| Operadores | **No existía el concepto** de «dueño de la plataforma». |

## 2. Qué se construyó

**Captación.** Landing con CTAs a `/demo` y `/registro`, enlaces a planes y ayuda, metadatos SEO. `/demo` (formulario con negocio, teléfono, intereses, horario). `/gracias` distinto para demo (dice que la respuesta es manual). Fuente de tráfico sin cookies (`utm_source` > `fbclid` > dominio de referencia > directo), conservada desde la primera visita hasta el prospecto y hasta el registro. Honeypot y tope por hora. La política de privacidad se actualizó.

**Seguimiento (`/admin`, solo operadores).** Prospectos con filtros, 7 estados de venta, notas, recordatorios (dentro del panel; **no envían nada**), intereses, demos por atender. Resumen del embudo, agencias y licencias, soporte.
- Acceso: solo correos en `PLATFORM_ADMIN_EMAILS`. Sin la variable, nadie entra.

**Compra (cobro DESACTIVADO).** `/planes` pública, `/agencia/plan` con uso real de límites, botón «Quiero este plan» que **solo registra una solicitud**. Arquitectura de licencias (`licenses`, `plan_requests`, `entitlements`), contrato `PaymentProvider` y webhook **sin implementación**: `BILLING_ENABLED=true` por sí solo no activa nada. Licencia manual por operador (no mueve dinero y no cuenta como compra). Precios: **no están definidos**; se muestran «Precio por confirmar» hasta configurar `PLAN_PRICE_USD_*`.

**Activación.** `/agencia/activacion`: 7 pasos que se marcan solos desde la base + «Preparar demostración» (servicios + empleados en la oficina de práctica, idempotente, sin gasto de IA).

**Ayuda.** `/ayuda/tutoriales`: 6 tutoriales, 9 preguntas, formulario «Hablar con una persona» (se guarda y lo ve el operador; **no hay correo conectado**, hay que responder a mano).

**Medición.** Tabla `events` sin IP ni cookies (visita, clic, plan visto). Registros, activaciones, planes solicitados, costo de IA (de `usage_events`), retención 7 días, cancelaciones y compras salen de la base. Compras = «No activo» mientras no haya pasarela; retención = «Sin datos» si no hay agencias con 7 días.

## 3. Pruebas (ejecutadas)
- `npm run check`: ver `docs/REPORTE_DE_PRUEBAS.md` (sección sistema comercial).
- E2E con navegador real, 36/36: landing con atribución de anuncio → demo (sin consentimiento no envía) → gracias → planes (sin cifras) → registro con plan → activación → solicitud de plan (el plan sigue «Prueba») → intruso rechazado en `/admin` → panel muestra visitas/prospecto/demo/registros/«Compras: No activo» → estado, nota, recordatorio → licencia manual cambia el plan y **no cuenta como compra** → soporte llega al panel → móvil 390 px sin scroll horizontal → 0 errores de JavaScript.

## 4. Límites honestos (no verificado / no hecho)
- Los datos del E2E son de prueba; **no hay resultados comerciales reales**. Ninguna cifra del panel es de clientes reales.
- «Visitas» = vistas de landing/demo/registro, no personas únicas.
- No hay correo: ni confirmación al prospecto, ni aviso al equipo, ni respuestas de soporte automáticas. El panel es la bandeja.
- Los recordatorios solo se ven en el panel.
- No se probó contra Postgres de producción ni en Hostinger (ver `PILOTO_HOSTINGER.md`).
- La política de privacidad sigue siendo **borrador** sin revisión legal ni razón social.
- Retención y activación necesitan decenas de agencias para significar algo.
- Cancelación/renovación solo existen como acción manual del operador.

## 5. Para empezar a cobrar (falta)
1. Decidir **precios**, moneda, impuestos, periodo de prueba y política de cancelación/reembolso (José).
2. Elegir y autorizar **pasarela** (p. ej. Stripe/Mercado Pago/PayPal); crear cuenta; implementar `PaymentProvider` (checkout + webhook firmado) y probar en modo de pruebas de la pasarela.
3. Probar la **entrega real del servicio**: pago de prueba → licencia `origen=pasarela` → límites cambian → cancelación vuelve a Prueba. Hoy solo está probado con una pasarela falsa de pruebas unitarias.
4. Términos de servicio, política de privacidad revisada, datos fiscales/facturación.
5. Correo transaccional (confirmaciones, avisos de demo al equipo, soporte).
6. Despliegue con Postgres y `PLATFORM_ADMIN_EMAILS`, `BILLING_ENABLED` y precios configurados (ver `PILOTO_HOSTINGER.md`).
7. IA real verificada (Claude con API key) y topes de costo, porque el costo de IA es variable.
