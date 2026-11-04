# Eventos de conversión

Definidos en `tracking/events.ts` (una sola fuente):

| Evento | Cuándo | Dónde se cuenta |
|---|---|---|
| `visita` (ruta `/`) | carga de la landing, 1 vez por pestaña | `events` |
| `cta_click` con `cta=comprar-*` | clic en un botón de compra | `events` |
| `plan_visto` | vista de `/planes` | `events` |
| checkout iniciado | se crea la sesión de Stripe | `checkout_intents` |
| compra confirmada | webhook de Stripe válido | `orders` |
| oficina entregada | `orders.status='entregada'` | `orders` |
| oficina activada | empleado + tarea completada | `agencies/tasks` |

Los eventos de navegador son anónimos (sin IP ni identificadores); los de compra salen del servidor, no del navegador, por eso no dependen del consentimiento.
