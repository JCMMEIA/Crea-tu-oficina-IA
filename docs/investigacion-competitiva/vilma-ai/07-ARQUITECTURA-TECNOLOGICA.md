# 07 · Arquitectura tecnológica

Regla: solo información pública o aportada. No se accedió a sistemas privados ni se analizó código protegido.

## A. Vilma.AI
| Componente | Estado | Base |
|---|---|---|
| Sitio comercial en GoHighLevel | **INFERIDO** | Los dominios `ghl.vilma.ai/...` (oferta, home) sugieren páginas de ese CRM/constructor; solo afecta a ventas, no al producto |
| Modelos de lenguaje | **DESCONOCIDO** | No se entregó evidencia de qué modelos usan |
| Orquestación de agentes | **DESCONOCIDO** (existe el concepto: agentes + workflows por etapas, según resumen) | — |
| Herramientas / integraciones externas | **NO VERIFICADO** | — |
| Memoria / base de conocimientos | **CONFIRMADO en concepto** (Foundation consultado automáticamente, según resumen); implementación **DESCONOCIDA** | Resumen del usuario |
| Medición de consumo | **CONFIRMADO en concepto** (tokens, límite mensual por suscripción, según resumen); mecanismo **DESCONOCIDO** | Resumen del usuario |
| Facturación y administración de clientes | **DESCONOCIDO** (hay suscripciones; procesador no indicado) | — |
| Procesamiento de tareas (colas, tiempos) | **DESCONOCIDO** | — |

No hay base para describir su arquitectura más allá de lo anterior. Cualquier diagrama sería ficción.

## B. Nuestra arquitectura (VERIFICADO EN NUESTRO CÓDIGO)
Next.js 16 (App Router) + TypeScript; PostgreSQL (PGlite en pruebas); motor de tareas con `runTask/runWorkflow`; proveedor de modelo Claude por API; skills versionadas por empleado; conocimiento con permisos; conectores (Composio) con aprobación para escrituras; presupuesto y límites previos al modelo; compra directa con Stripe (webhook idempotente) → oficina automática; correo por Resend con seguimiento de entrega; mensajería (Telegram/WhatsApp) con aprobaciones; auditoría. 256 pruebas automáticas pasan.
