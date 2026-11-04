# 06 · Precios, consumo y rentabilidad

Tres tipos de dato, siempre separados: **OBSERVADO** (publicado por Vilma, vía resumen del usuario; no verificado por mí), **ESTIMACIÓN** (cálculo con supuestos declarados) e **HIPÓTESIS** (apuesta a validar).

## A. Precio observado de Vilma (fuente: resumen facilitado por el usuario + fragmentos de búsqueda 2026-11-04)
| Dato | Valor | Estado |
|---|---|---|
| Plan PRO en la web principal | US$37/mes | Observado (según resumen) |
| Otras páginas comerciales | Muestran **límites de proyectos y condiciones distintos** | Observado, **contradicción**; detalle NO VERIFICADO |
| Oferta de lanzamiento anual, plan Max (búsqueda) | 500 USD/año | Observado en fragmento; sin abrir la página |
| Blog de afiliados (búsqueda) | 37 USD/mes | Fuente de terceros afiliados, no oficial |
| Consumo | Las operaciones consumen **tokens**; hay **límite mensual** por suscripción | Observado (según resumen) |
| Créditos de imágenes, nº de proyectos, nº de agentes por plan, renovación, cancelación, upsells | — | **NO VERIFICADO** (no se entregó) |

**Cómo puede vender muchos agentes sin consumo ilimitado:** porque el producto cobra por *acceso* y limita el *consumo* mensual de tokens (CONFIRMADO según resumen). Los agentes son configuraciones (prompt + contexto), no máquinas aparte; el costo real lo mueve el volumen de tokens. Sus costos internos y márgenes son **DESCONOCIDOS**; no se estiman aquí.

## B. Nuestro estado (VERIFICADO EN NUESTRO CÓDIGO)
- Planes en código: `prueba / emprendedor / agencia / avanzado`, limitados por **nº de clientes y empleados**, **sin límite de tokens por plan** (`src/server/agency/plans.ts`). Precios por variable de entorno; sin variable = «por confirmar».
- Control de gasto: presupuesto mensual en USD **por empresa** (default 10) y **por oficina/agencia** (default 20), tope por hora y por empleado/día, bloqueo *antes* de llamar al modelo (`src/server/usage/index.ts`). Funciona y está probado.
- Lo que falta para venderlo como «tokens incluidos»: convertir ese presupuesto USD en una **cuota visible para el cliente** (tokens o «tareas incluidas»), con medidor y aviso al 80 %, y definir qué pasa al agotarse (pausar, comprar más, subir de plan).
- Modelo por defecto `claude-sonnet-5-5`; precios por token configurables (`MODEL_INPUT_USD_PER_MTOK`, `MODEL_OUTPUT_USD_PER_MTOK`).

## C. Costo variable por cliente — ESTIMACIÓN
**Supuestos (hay que validarlos con datos reales; cambian con el modelo y la tarifa vigente de Anthropic, que debe revisarse):** precio de modelo US$3 / US$15 por millón de tokens (entrada/salida) — el mismo que usan nuestras pruebas simuladas, **no** una cotización oficial; tarea típica 6 000 tokens de entrada (enseñanza + conocimiento + instrucción) y 1 500 de salida.

| Tarea | Entrada/Salida | Costo por tarea |
|---|---|---|
| Ligera | 4 000 / 1 000 | US$0.027 |
| **Típica** | 6 000 / 1 500 | **US$0.041** |
| Pesada | 12 000 / 3 000 | US$0.081 |

| Escenario mensual (tarea típica) | Tareas/mes | Costo de IA |
|---|---|---|
| Prueba | 40 | ≈ US$1.6 |
| Normal | 150 | ≈ US$6.1 |
| Intenso | 600 | ≈ US$24 |
| Abusivo (tope) | 1 500 | ≈ US$61 |
| Normal con tareas pesadas | 150 | ≈ US$12 |

Un **workflow de 3 pasos** ≈ 3 tareas ≈ US$0.12; cadena máxima de 10 ≈ US$0.41. Costos extra a sumar (HIPÓTESIS, verificar): comisión de Stripe (porcentaje + cargo fijo; depende de país y método), correo (Resend, cuota gratuita limitada), VPS (costo fijo ya existente), soporte humano. Imágenes: hoy no ofrecemos generación de imágenes; si se añade, es un costo separado.

## D. Propuesta de planes Starter / Pro / Business — HIPÓTESIS para decidir
Principio: **cobrar por oficina y por uso incluido; nunca ilimitado.** Los precios son puntos de partida para discutir; **no se activa ningún cobro**.

| | Starter | Pro | Business |
|---|---|---|---|
| Para quién | Emprendedor que prueba | Negocio activo | Negocio con varios departamentos |
| Oficinas IA | 1 | 1 | 1 (con más empleados) y opción de añadir oficinas |
| Empleados | hasta 6 | hasta 15 | todos (41) |
| Tareas incluidas/mes | 100 | 300 | 900 |
| Workflows | P1 (8) | P1+P2 (16) | los 20 |
| Automatizaciones programadas | 2 | 10 | 30 |
| Canales (WhatsApp/Telegram) | — | 1 | 2 |
| Documentos de conocimiento | 10 | 50 | 200 |
| Al agotar la cuota | pausa + comprar paquete | pausa + paquete o subir | aviso al 80 % + paquete |
| **Costo de IA estimado a consumo total** | ≈ US$4 | ≈ US$12 | ≈ US$36 |
| **Precio sugerido a validar** | US$19–29/mes | US$49–69/mes | US$129–179/mes |

Lógica: a consumo total el costo de IA debe quedar **por debajo del 30–35 % del precio** para dejar margen a comisiones, soporte y fallos. Con los supuestos de arriba se cumple; si el modelo real cuesta el doble o las tareas pesan más, hay que subir precio o bajar cuota. **Precio anual:** 2 meses gratis (HIPÓTESIS). **Retención:** ver `08`.

## E. Qué comprobar antes de fijar precios
1. Medir tokens reales por tarea con 10–20 tareas verdaderas por empleado (hoy solo hay pruebas simuladas).
2. Confirmar tarifa vigente del modelo y comisión de Stripe México.
3. Abrir las páginas de precios de Vilma y registrar fecha, plan, límites y condiciones (no fue posible desde aquí).
