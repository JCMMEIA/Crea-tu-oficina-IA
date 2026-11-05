# Prueba de humo de OpenRouter — Claude Sonnet 5.5 (UNA llamada, restringida)

**Defecto corregido.** La versión anterior usaba sensibilidad `public`, no enviaba `provider.only` ni `provider.max_price`, y `--max-usd` era solo una comprobación previa: ningún límite se imponía al proveedor.

## Qué hace ahora
- **Una** solicitud a `anthropic/claude-sonnet-5.5`, sin reintentos, sin herramientas, sin modelos alternativos, con prompt ficticio fijo y `max_tokens` = 16.
- Solicitud exacta (verificada por pruebas): `provider = { allow_fallbacks:false, data_collection:"deny", zdr:true, only:["amazon-bedrock/us-east-1","amazon-bedrock/eu-west-1"], max_price:{prompt:2.75, completion:13.75} }`.
- `max_price` = tarifas verificadas (US$ 2.20 entrada / US$ 11 salida por millón; catálogo público de OpenRouter, endpoints `amazon-bedrock/us-east-1` y `/eu-west-1`, ambos en la lista ZDR, 2026-11) × margen 1.25 (el mismo `PRICE_MARGIN` del router; una prueba comprueba que coinciden).
- Antes de llamar valida el cuerpo completo y calcula un **peor caso conservador** (≈ 121 tokens de entrada × 1.25 + 16 de salida, a los topes de precio) ≈ **US$ 0.0006**. Si el cuerpo no es exactamente el autorizado o el peor caso no cabe en el presupuesto (máximo US$ 0.01, no se puede subir), **no envía nada**.
- Muestra antes de ejecutar: privacidad, proveedores, topes de precio, costo máximo estimado y si hay clave (sí/no, nunca el valor).
- **Sin `--autorizo-una-llamada-facturable` solo hay simulación local** (cero llamadas). Las banderas antiguas (`--confirmo`, `--modelo`) ya no autorizan nada.
- Independiente de `AI_ROUTER`, del catálogo y de la base de datos; no cambia la privacidad global ni el límite US$0.05 del panel.
- La clave solo se envía a `https://openrouter.ai/api/v1` (o a un servidor local de pruebas).

## Importante
Los cálculos de tokens son **estimaciones conservadoras de control, no un límite absoluto de facturación**: el conteo es aproximado, el proveedor puede facturar tokens de razonamiento y el costo final lo informa OpenRouter. Lo que sí impone el proveedor es `max_price` y `max_tokens`.
`zdr:true` sigue además la configuración de privacidad de la cuenta de OpenRouter (ver `INFORME_PANEL_PRIVACIDAD_COSTOS.md`).

## ¿La clave tiene guardrail propio?
Desde este entorno **no se pudo comprobar** (no hay clave aquí y no se debe pedir). `ia:humo -- --consultar-clave` hace un único `GET /key` de solo lectura (no factura) y muestra: límite propio de la clave, gasto, y los presupuestos/guardrails que le aplican. **No crea ni asigna guardrails**: eso requiere tu autorización en openrouter.ai.

## Reversión
Cambio acotado a `scripts/ia/prueba_humo.ts`, `scripts/ia/humo_lib.ts`, su prueba y estos documentos; basta revertir el commit. No toca el router, el esquema ni el panel.
