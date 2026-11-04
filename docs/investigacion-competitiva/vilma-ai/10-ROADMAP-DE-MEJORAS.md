# 10 · Roadmap de mejoras (propuesta; nada se construye sin aprobación de José)

Esfuerzos en días de trabajo de desarrollo, estimación gruesa (HIPÓTESIS).

## 1. Bloqueos para vender
| # | Qué | Por qué bloquea | Esfuerzo |
|---|---|---|---|
| 1 | Verificar correo real (Resend + DNS + webhook) en el VPS | Sin acceso al correo, la compra no sirve | 0.5 (+ pasos de José) |
| 2 | Compra con Stripe en modo prueba de punta a punta | Hoy solo simulada | 0.5 |
| 3 | Precio y moneda definidos; textos de cobro/cancelación | La compra no abre sin precio | 0.5 (decisión de José) |
| 4 | Medir tokens reales por tarea (20 tareas) | Define precios y cuotas con datos | 1 |
| 5 | Privacidad y términos revisados por un profesional | Requisito antes de anuncios | externo |

## 2. Funciones indispensables del MVP (primera tarea útil sin saber programar)
| # | Qué | Esfuerzo |
|---|---|---|
| 6 | **Perfil del negocio inyectado a la IA** (usar `companies.profile` + tono/valores/reglas) | 2 |
| 7 | **Catálogo de tareas con formulario** (8 tareas P1 de `05`), con ejemplo y costo estimado | 4 |
| 8 | **Resultado descargable** (Markdown y PDF) y guardado por tarea | 2 |
| 9 | **Primera tarea guiada** en el onboarding: elegir tarea → 3 preguntas → resultado | 2 |
| 10 | **Cuota visible** (tareas incluidas, medidor, aviso al 80 %, qué pasa al agotarse) | 3 |

## 3. Mejoras comerciales
| # | Qué | Esfuerzo |
|---|---|---|
| 11 | Workflows P1 como recetas encadenadas con orden fijo (8) | 5 |
| 12 | Planes Starter/Pro/Business con cuotas (tras medir costos) | 3 |
| 13 | Retratos de empleados y lista curada para el lanzamiento | 1 (+ autorización de gasto) |
| 14 | Pilotos con 2–3 negocios reales → testimonios con permiso | calendario |
| 15 | Correos de activación (día 1, 3, 7) y de «cuota al 80 %» | 2 |

## 4. Después del lanzamiento
Chat con historial por empleado; memoria de hechos aprobados; recuperación con embeddings (solo si se justifica); workflows P2/P3; conexiones reales (Meta, Shopify, WhatsApp) probadas con cuentas de pilotos; API de Conversiones de Meta; paquetes de tareas extra; programa de afiliados; generación de imágenes (costo aparte).

## Qué se puede lanzar sin retrasar ventas
Con los puntos 1–3 y 6–9 ya se puede **vender con honestidad** una oficina que entrega un primer resultado útil (aprox. 15–17 días de desarrollo + los pasos de configuración de José). Todo lo del bloque 4 puede esperar.
