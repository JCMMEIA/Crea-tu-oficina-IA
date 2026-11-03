# Landing y medición

Ruta `/` (sin sesión): título «Crea tu propia agencia de inteligencia artificial sin empezar desde cero», subtítulo, demostración con **capturas de la aplicación real** (`public/demo/*.png`, generadas por `scripts/e2e/screenshots.cjs` con datos ficticios), beneficios, cómo funciona, ejemplos de servicios, qué es real hoy vs en construcción, formulario de acceso anticipado, preguntas frecuentes. Además `/acceso-anticipado`, `/gracias`, `/privacidad`.

**Sin promesas:** no hay ingresos garantizados ni conexiones presentadas como operativas; las integraciones se declaran «en verificación».

## Acceso anticipado
Tabla `leads`: correo único (reenvío = actualiza), consentimiento obligatorio, UTM y `fbclid` guardados, honeypot anti-bots y tope de 200/hora. Para leer los leads: consulta directa a la base (no hay panel de administrador de plataforma todavía).

## Meta Ads (preparado, inactivo)
- `NEXT_PUBLIC_META_PIXEL_ID` vacío ⇒ **no se carga nada y no aparece banner**.
- Con ID definido: aviso de cookies; el píxel solo se carga si la persona **acepta**; `PageView` al cargar y evento estándar `Lead` en `/gracias`.
- Parámetros de campaña (`utm_*`, `fbclid`) se conservan en el formulario y en la base.
- **Pendiente:** API de Conversiones (servidor) y deduplicación de eventos, que requieren token de Meta; verificación del dominio; revisión legal de la política de privacidad (es un **borrador**).
- Nada de esto se probó contra Meta real (no hay píxel ni cuenta).
