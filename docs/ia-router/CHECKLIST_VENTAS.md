# Checklist de preparación para ventas

Marca ✔ solo con evidencia. Lo que ya está resuelto en código aparece como «código listo», no como «operativo».

## Bloquean la venta
- [ ] **Verificar la IA real** con el router apagado (`npm run tareas:verificar`) y luego con el router encendido y 1–2 modelos verificados.
- [ ] **Permitir `openrouter.ai`** (o pegar sus páginas) y completar `OPENROUTER_INVESTIGACION.md`; verificar precio y política de datos de cada modelo antes de activarlo en `/admin/ia`.
- [ ] **Medir calidad, costo y latencia reales** con `scripts/ia/evaluar.ts` y sustituir los supuestos de `FINANZAS.md` por promedios de `ai_calls`.
- [ ] **Correo de acceso entregado de verdad** (PR #2) y **compra con Stripe en modo prueba** de punta a punta.
- [ ] **Decidir y conectar Starter/Pro/Business** al cobro y al alta de oficinas (hoy un solo plan; «Business = 3 oficinas» requiere 3 derechos de oficina por compra). Aprobar precios y cuotas; hasta entonces **no publicar** (`PLANES_APROBADOS=false`).
- [ ] **Privacidad y términos** revisados: el Cerebro y las tareas envían datos del negocio a proveedores de IA (OpenRouter y los proveedores de cada modelo); declarar y, si hace falta, ofrecer solo modelos de retención cero.
- [ ] **Fusionar y verificar los PR #3 y #4** (este PR los incluye).

## Operación
- [ ] Alertas de cuota por correo (hoy solo en pantalla).
- [ ] Monitor de gasto diario de OpenRouter/Anthropic con tope de seguridad en la cuenta del proveedor.
- [ ] Revisar semanalmente `ai_calls`: tasa de fallback, modelos con mal historial, costo real vs estimado.
- [ ] Retratos de los empleados, testimonios reales (solo con permiso) y casos de éxito **reales** antes de usarlos en anuncios.
- [ ] Antes de Meta Ads: correo, compra de prueba, primera tarea útil en <10 min, medición UTM, píxel/API de Conversiones.

## Lo que NO se hizo (a propósito)
No se desplegó nada, no se activó Stripe real, no se publicaron precios, no se tocó OpenClaw ni las credenciales de Resend/Anthropic, no se abrieron inscripciones públicas de afiliados, no se activaron modelos ni se cargaron claves de OpenRouter.
