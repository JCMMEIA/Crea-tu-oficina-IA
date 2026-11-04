# Costos y límites

## Qué controla el sistema hoy (verificado)
- **Presupuesto mensual de IA** por cliente/oficina (`companies.monthly_budget_usd`, por defecto US$ 10) y por oficina completa (`agencies.monthly_budget_usd`, por defecto US$ 20), tope de ejecuciones por hora y por empleado/día. El bloqueo ocurre **antes** de llamar a la IA y el mensaje explica el motivo.
- **No existe una cuota en tokens por plan:** el límite es en dólares de costo estimado. «Tokens incluidos» por plan sería un cambio de producto pendiente (ver PENDIENTES).
- Pantallas: `/consumo` separa **tokens consumidos**, **costo estimado** (tarifa configurada, no es una factura) y **límites**; `/agencia/consumo` reparte por cliente. Aviso al 80 %, bloqueo al 100 %.

## Costo estimado por tarea — ESTIMACIÓN
Supuestos (no son tarifa oficial ni medición): modelo a US$ 3 entrada / US$ 15 salida por millón de tokens (mismos valores de las pruebas). Los tokens por tarea son los del catálogo (`estTokens`) y **no incluyen** la enseñanza del empleado ni el Cerebro (hasta ≈ 1 500 tokens de entrada); con ellos el costo real podría ser 1.5–2.5 veces mayor. **Hay que medirlo con `npm run tareas:verificar`.**

| Tarea | Tokens entrada / salida (catálogo) | Costo estimado sin Cerebro | Ejecuciones con US$ 10 |
|---|---|---|---|
| Anuncios: 3 propuestas | 2,200 / 900 | US$ 0.0201 | 497 |
| Plan de contenido semanal | 2,000 / 1,100 | US$ 0.0225 | 444 |
| Guion de video corto | 1,800 / 700 | US$ 0.0159 | 628 |
| Responder a un prospecto | 2,000 / 700 | US$ 0.0165 | 606 |
| Propuesta comercial | 2,200 / 1,100 | US$ 0.0231 | 432 |
| Responder duda de cliente | 1,700 / 500 | US$ 0.0126 | 793 |
| Atender queja o reseña | 1,900 / 600 | US$ 0.0147 | 680 |
| Seguimiento posventa | 1,600 / 450 | US$ 0.0115 | 865 |

## Escenarios por cliente (mes) — ESTIMACIÓN con costo promedio ≈ US$ 0.02 (sin Cerebro) y ≈ US$ 0.045 (con factor 2.2)
| Escenario | Tareas/mes | Optimista | Prudente |
|---|---|---|---|
| Prueba | 20 | US$ 0.40 | US$ 0.90 |
| Normal | 100 | US$ 2.00 | US$ 4.50 |
| Intenso | 400 | US$ 8.00 | US$ 18.00 → el tope de US$ 10 bloquea antes |
Tope máximo por cliente = su presupuesto mensual (US$ 10 por defecto): **nunca gasto ilimitado**. Costos que NO están en estas cifras: comisión de Stripe, correo, servidor, soporte.
