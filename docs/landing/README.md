# Rediseño comercial de la landing (rama `claude/landing-premium-v2`)

Landing en `/` rediseñada como funnel de ventas extenso (15 secciones), con identidad propia (azul noche, morado, Inter). Código en `src/features/funnel/`; el tablero interno no se tocó.

| Documento | Contenido |
|---|---|
| [INVESTIGACION.md](INVESTIGACION.md) | Fase 1: qué se pudo y qué NO se pudo investigar de Vilma.AI, y qué decisiones se tomaron |
| [AUDITORIA_LANDING_ACTUAL.md](AUDITORIA_LANDING_ACTUAL.md) | La landing anterior y qué se reutilizó |
| [SISTEMA_VISUAL.md](SISTEMA_VISUAL.md) | Tokens, componentes, animación, accesibilidad |
| [AUDITORIA_SUSCRIPCION.md](AUDITORIA_SUSCRIPCION.md) | Estado del cobro y qué falta antes de tener Starter/Pro/Business |
| [EDITAR.md](EDITAR.md) | Cómo cambiar titulares, fotos, precios, preguntas, estados y eventos |
| [PRUEBAS.md](PRUEBAS.md) | Pruebas ejecutadas, evidencia y lo que no se verificó |
| [../integracion/INTEGRACION_PR3_PR4.md](../integracion/INTEGRACION_PR3_PR4.md) | Compatibilidad con el PR #3 y orden de integración |
| [../integracion/PLAN_ROUTER_Y_AFILIADOS.md](../integracion/PLAN_ROUTER_Y_AFILIADOS.md) | Plan por fases (no implementado aquí) y nota sobre el PR #5 |
| [PRIMERA_TAREA_REAL.md](PRIMERA_TAREA_REAL.md) | Qué falta para pagar y ejecutar la primera tarea real |
| [../empleados/PROPUESTA_RETRATOS_8.md](../empleados/PROPUESTA_RETRATOS_8.md) | Propuesta visual de 8 retratos (sin generar) |
| `capturas/` | Una captura por sección, escritorio y celular |

## Estado de otras ramas (no se integró nada)
- **PR #3** (Cerebro Empresarial, tareas guiadas, resultados, consumo): abierto y **sin fusionar** al escribir esto. Esta rama **no incluye su código**. La landing describe esas funciones con la etiqueta **«En revisión»** y usa **cuatro capturas reales** de ese módulo (solo imágenes, con datos de ejemplo). Cuando el PR #3 se fusione y se verifique con la IA real, se cambia su estado en `config/disponibilidad.ts`.
- **PR #1** (investigación de Vilma.AI) y **PR #2** (configurador de correo): no se tocaron.

## Qué NO cambió
Stripe (ni claves ni cobros), Resend, Anthropic, OpenClaw, el acceso por correo, las rutas del panel y el flujo de compra (la prueba E2E de compra sigue en 64/64).

## Dos caminos comerciales (esta actualización)
Header y sección «¿Qué quieres hacer con la IA?»: **Quiero mi Oficina IA** (el software) y **Quiero ser afiliado** (solo lista de interés en `/afiliados`: sin enlaces, comisiones ni condiciones). «Nosotros administramos tu oficina» es un **servicio secundario** por solicitud de diagnóstico (`/servicio-gestionado`), no una tercera plataforma. Un bloque «Disponible / En revisión / Próximamente» sale de `config/disponibilidad.ts`. Contenido editable en `config/caminos.ts`. **No se implementó** el router de modelos ni el programa de afiliados.
