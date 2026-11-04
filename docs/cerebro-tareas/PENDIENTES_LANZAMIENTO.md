# Requisitos pendientes para lanzar (lista precisa)

**Bloqueos para vender**
1. **Verificar con la IA real** (única forma de afirmar que las tareas «funcionan»): en el VPS, con credenciales cargadas, `npm run tareas:verificar`; guardar la salida como evidencia. *Requiere ANTHROPIC_API_KEY y tarifa del modelo; cuesta centavos.* — **Pendiente, no ejecutado.**
2. Medir tokens reales por tarea y ajustar `estTokens` y los topes (hoy son estimaciones).
3. Correo de acceso entregado de verdad y compra Stripe en modo prueba de punta a punta (ver PR #2 y `docs/correo/`). — Pendiente, fuera de esta rama.
4. Precio y moneda definidos; textos de cobro y cancelación.

**Antes de abrir tráfico**
5. Probar el flujo con 2–3 negocios reales de piloto; revisar calidad en español de cada una de las 8 tareas y ajustar su texto.
6. Decidir si «tokens incluidos por plan» reemplaza o complementa el presupuesto en dólares.
7. Privacidad/términos: el Cerebro envía datos del negocio a un proveedor de IA; debe estar declarado y revisado por un profesional.
8. Aviso en pantalla de que las propuestas pueden contener errores y las revisa la persona (ya hay aviso de «propuesta»; falta texto legal).

**Mejoras ya identificadas (no bloquean)**
- Retratos de empleados; formato `.docx`/PDF nativo; historial de versiones de ediciones; relleno del perfil desde el sitio web del cliente; panel del Cerebro en el onboarding de compra.
- Las capturas completas muestran la barra inferior móvil sobre el contenido (artefacto de captura de página completa; no ocurre al navegar).
