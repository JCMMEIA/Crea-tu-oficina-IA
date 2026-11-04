# Fase 9 · Simulación financiera

**Esto es una simulación, no una medición.** Tablas completas en [FINANZAS_TABLAS.md](FINANZAS_TABLAS.md), generadas por `scripts/finanzas/simular.ts`; todos los supuestos están en el objeto `SUPUESTOS` y se cambian ahí.

## Supuestos clave (todos HIPÓTESIS, ninguno medido)
- Precios provisionales sin publicar: $499 / $999 / $2,499 MXN; 60 % / 30 % / 10 % de mezcla; IVA 16 % **incluido** en el precio (confirmar con contabilidad).
- **Precios de modelos:** premium US$3/15 por millón (el valor usado en las pruebas, **no una cotización oficial**); económico US$0.30/1.20 (hipótesis pura). Mezcla del router por **tokens**: 5 % gratuito, 60 % económico, 35 % premium (los gratuitos son pocos porque casi toda tarea lleva datos internos). Comisión de OpenRouter 5.5 % (**recordatorio no verificado**). Reintentos y fallbacks: +8 % de tokens. Tipo de cambio 18.5. Stripe 3.6 % + $3 por cobro (confirmar).
- Afiliados: 30 % de los clientes referidos, 60 % de ellos aún dentro de los 12 cobros, 20 % de comisión sobre el neto.
- Infraestructura, soporte y servicios externos: valores supuestos por escala.
- **No incluye:** ISR ni otros impuestos sobre utilidades, adquisición de clientes (anuncios), desarrollo, nómina, contingencias legales. El «margen» es de **contribución**, antes de todo eso.

## Qué dice (bajo esos supuestos)
| Clientes | Uso medio (50 % de la cuota) — margen con router | Ahorro del router frente a todo-premium |
|---|---|---|
| 10 | ≈ 79 % | ≈ $434 MXN/mes |
| 100 | ≈ 84 % | ≈ $4 339 |
| 1 000 | ≈ 85 % | ≈ $43 388 |
| 10 000 | ≈ 85 % | ≈ $433 875 |
El router reduce el costo de IA **≈ 57 %** frente a enviar todo a un modelo premium, pero la IA es solo **≈ 1 a 10 % del ingreso neto**: lo que más pesa en el margen son Stripe (~4 %), la comisión de afiliados (~3.6 % efectivo) y, a escala, soporte e infraestructura. Con uso alto (90 %) el margen del router sigue ≈ 81 %.

## Riesgos que la simulación NO captura
1. **Los precios y la calidad reales de los modelos** (sin verificar). 2. **Disponibilidad de los gratuitos** (no garantizada) y límites diarios. 3. **Más tokens de lo esperado** por tarea (contexto, herramientas, delegación en cadena). 4. **Concentración:** unos pocos clientes pesados; la cuota y el tope en USD los acotan. 5. **Reembolsos/contracargos** y fraude de afiliados. 6. **Tipo de cambio** (ingresos en MXN, costos de IA en USD). 7. **Impuestos:** IVA (diferenciado arriba) e ISR (no modelado). 8. Dependencia de un agregador (OpenRouter): por eso Anthropic directo queda como proveedor alterno en el catálogo.

## Cómo hacerla real
Medir con `scripts/ia/evaluar.ts` (8 tareas × cada modelo) y con 2 semanas de uso piloto; sustituir los supuestos por promedios medidos de `ai_calls` (tokens por tarea, mezcla real, tasa de fallback) y volver a correr el script.
