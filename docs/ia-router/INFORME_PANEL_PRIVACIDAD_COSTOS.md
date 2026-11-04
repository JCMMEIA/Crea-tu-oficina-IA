# Router IA: panel /admin/ia, privacidad y costos — informe de corrección

Rama `claude/router-panel-fix` (sobre `claude/router-ia-minimo`, versión en producción `ecc04a2`). Router **apagado**; sin llamadas a OpenRouter; sin tocar producción, secretos ni OpenClaw.

## Fase 1 · Por qué no se guardó el modelo
**Causa raíz (reproducida con pruebas):** no fue un fallo de sesión ni de base de datos. El flujo `guardar → validar → redirigir` rechazaba entradas normales y **ocultaba el motivo**:
| Entrada típica de una persona o asistente | Resultado anterior |
|---|---|
| «Identificador interno» = `anthropic/claude-haiku-5.5` (barra), mayúsculas o vacío | Error de validación |
| Precio `0,10`, `$0.10`, contexto `1,000,000` | «Invalid input: expected number, received NaN» (inglés) |
| «Activo» sin «Verificados» | Error (correcto, pero sin decir qué marcar) |
| Mismo proveedor y modelo con otro id interno | Error SQL crudo (`duplicate key … ai_models_provider_model_id_key`) |
El error solo vivía en `?error=…` de la URL: al recargar `/admin/ia` desaparecía, el formulario (dentro de un `<details>` cerrado) perdía lo escrito y el éxito era **silencioso** (sin mensaje). Para quien probaba, «el catálogo seguía vacío».
**Corrección:** `saveModel` idempotente (clave real = proveedor + id de modelo; transacción con auditoría; lectura posterior), números en formato humano, id interno opcional y saneado, mensajes en español con el nombre del campo, aviso de éxito con id/estado, formulario que se conserva abierto tras un error, botón **Editar**, conteo «modelos registrados», proveedor usado en «Últimos intentos», y etiquetas de accesibilidad (axe sin hallazgos serios). Archivos: `src/server/ai/config.ts`, `src/app/admin_actions.ts`, `src/app/admin/ia/page.tsx`.

## Fase 2 · Privacidad: lo que se APLICA, no lo que se etiqueta
Documentación oficial (openrouter.ai/docs/guides/routing/provider-selection y /features/zdr, consultada 2026-11): existen `provider.allow_fallbacks` (boolean, por defecto true), `provider.data_collection` ("allow"|"deny", por defecto allow), `provider.zdr` (boolean), `provider.only` (lista de slugs) y `provider.max_price` ({prompt, completion} en US$/M).
Hallazgos y cambios:
1. `data_collection:"deny"` y `zdr:true` solo filtran **endpoints de OpenRouter**; con ellos, OpenRouter aún elige el proveedor entre los que cumplan. Para **fijar** proveedores se necesita `provider.only`. Nuevo campo por modelo `allowed_providers` (slugs como `amazon-bedrock`, `google-vertex`; el slug base cubre sus regiones).
2. **Falla cerrado:** para información interna o confidencial, un modelo de OpenRouter sin proveedores aprobados se excluye del enrutamiento (con el motivo) y el adaptador se niega a enviar (cero solicitudes HTTP). La etiqueta `data_policy` ya no basta.
3. Cuerpo verificado por pruebas: pública → `allow_fallbacks:false` + `only` + `max_price`; interna → + `data_collection:"deny"`; confidencial → + `zdr:true`.
4. Ante 404 «no hay endpoints que cumplan la política» o falta de clave: no se reintenta fuera de la lista; pasa al siguiente modelo autorizado o se detiene sin gastar.
**Límites que NO puedo verificar desde el código:** (a) `zdr:true` sigue la configuración de privacidad de la cuenta de OpenRouter (en cuentas self-serve puede incluir endpoints de «Safety Retention»: sin entrenamiento, con retención solo para prevenir abuso). Configura en openrouter.ai/settings/privacy «ZDR only» y desactiva el entrenamiento con prompts. (b) La etiqueta de un modelo directo de Anthropic (`provider=anthropic`) es una declaración humana: la API no la hace cumplir. (c) Slugs válidos de un modelo (consulta pública, sin costo): `https://openrouter.ai/api/v1/models/<id>/endpoints` → campo `tag`. Para Haiku 5.5 hoy: `amazon-bedrock`, `google-vertex` (en la lista ZDR) y también `anthropic`, `azure`, `claude-on-aws` (no listados como ZDR).

## Fase 3 · Costos
Ya correcto y probado: tope por llamada (`maxCallUsd`), por tarea (`max_task_usd`, incluyendo respuestas inválidas ya cobradas) y mensual (reserva atómica; llamadas en paralelo no se pasan), liberación de reservas al fallar y liquidación con el costo real del proveedor.
**Riesgo encontrado:** el precio de catálogo puede diferir del real (p. ej. Haiku 0.10/0.50 en el endpoint global y 0.11/0.55 en regionales) y el conteo de tokens de entrada es aproximado. **Cambios:** (1) a OpenRouter se le envía `max_price = precio × 1.25` (tope aplicado en la API); (2) el costo máximo reservado y el tope por llamada usan ese margen; (3) si el costo real supera el máximo estimado se anota en la llamada; (4) **freno automático:** si supera 1.5× el máximo estimado, el modelo se desactiva solo, queda auditado y el exceso se limita a una llamada.
**Configuración inicial conservadora** (botón «Aplicar configuración de prueba controlada»): máximo **US$0.05 por llamada** y **2 intentos**. Solo cambia reglas del router; no toca cuotas ni precios de planes (probado por huella) ni enciende el router. Un plan `prueba` ya existe con tope por tarea US$0.05 y presupuesto mensual US$0.50.

## Fase 4 · Validación
- Pruebas nuevas: `ia_panel_modelos` (21), `ia_privacidad` (11), `ia_costos` (14); las anteriores del router/contrato siguen en verde.
- E2E real (Next + PostgreSQL, sin IA): `scripts/e2e/ia_panel.sh` — guardar con los formatos problemáticos, recargar, idempotencia, editar, desactivar, errores en español con formulario conservado, configuración de prueba, simulador sin llamadas, router apagado, móvil, axe. Capturas en `docs/ia-router/evidencia-panel/`.
- Compatibilidad con el instalador v2 y su rollback: el cambio de esquema es una sola columna `ADD COLUMN IF NOT EXISTS … DEFAULT '{}'` (idempotente; el INSERT de la versión anterior sigue funcionando — probado), el instalador acepta los archivos nuevos (lista permitida actualizada) y el rollback restaura `.next` sin recompilar.

## Plan seguro de despliegue (no ejecutado)
1. Revisar y aprobar el PR (sin fusionar a `main`).
2. En el VPS: `--verificar` y simulacro del instalador v2 con el commit del PR (desciende de `ecc04a2`: fast-forward). Aprobar y `--aplicar --commit <SHA>`.
3. En `/admin/ia`: registrar Haiku 5.5 con `amazon-bedrock, google-vertex`, verificado y activo; aplicar «prueba controlada»; probar el simulador con nivel B interno.
4. Prueba de humo de UNA llamada (`ia:humo`, tope US$0.01) con tu autorización. El router sigue apagado hasta otra decisión.

## Corrección posterior (revisión del PR #6)
1. **Margen de salida.** La primera versión aplicaba el margen a los tokens/precio de entrada pero no al precio de salida, mientras que el `max_price` enviado sí era ×1.25 en ambos: la reserva podía quedar hasta 25 % por debajo de lo que la API permitía gastar (ejemplo con salida alta: reservaba US$0.0604 y el tope de la API permitía US$0.0755). Ahora hay una sola fuente de verdad en `router.ts`: `priceCeiling` (precio × `PRICE_MARGIN`, en entrada y salida; es el `max_price`) y `worstCaseCost` = tokens de entrada estimados × `INPUT_TOKEN_MARGIN` × tope de entrada + `max_tokens` de salida × tope de salida. Ese costo se compara con los límites por llamada, tarea y mes y es el que se reserva.
   **Son estimaciones de control, no una garantía absoluta de facturación:** el conteo de tokens de entrada es aproximado, el proveedor puede contar tokens de razonamiento como salida, el costo final lo informa OpenRouter, y los topes no cubren comisiones de la plataforma ni de recarga de saldo. Por eso se liquida siempre el costo real y existe el freno por anomalía.
2. **Identificadores con sufijo.** `${base}-${n}`.slice(0, 60) perdía el sufijo con bases de 60 caracteres (el candidato nunca cambiaba: bucle infinito). Ahora `withSuffix` recorta la **base** y conserva el sufijo, y `uniqueId` tiene un tope de seguridad (1000 intentos) con un mensaje claro.
