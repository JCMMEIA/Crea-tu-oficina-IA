# Investigación de OpenRouter — estado al 2026-11-04

## Acceso a la documentación oficial: BLOQUEADO
Se intentó abrir `openrouter.ai/docs/api/reference/overview`, `…/limits`, `openrouter.ai/models` y `openrouter.ai/pricing`: **el dominio no resuelve desde este entorno** (`ENOTFOUND`; `getent hosts openrouter.ai` sin respuesta). **No se tocó ninguna regla de red.**

**Permiso exacto que hay que habilitar** (lo haces tú, no yo): en la barra de título de la sesión → menú del entorno en la nube → **Edit** → **Network access** → añade **`openrouter.ai`** en *Allowed domains* (la API vive en la misma raíz: `openrouter.ai/api/v1`) y deja marcada la casilla de paquetes. Alternativa: subir el nivel de acceso de red del entorno. Pasos oficiales: https://code.claude.com/docs/en/cloud-environments#network-access. No hace falta ninguna clave para leer la documentación ni el catálogo público.

Mientras no exista ese acceso **no hay precios, límites, políticas de datos ni capacidades documentados por mí** y **no se ha seleccionado ningún modelo**: hacerlo con datos de memoria sería decidir gasto con cifras posiblemente viejas.

## Lo único que hay: fragmentos de búsqueda de terceros (no son la fuente oficial, sin verificar)
Consultados el 2026-11-04; sirven solo para planear.
| Dato | Lo que dicen las fuentes | Fuentes |
|---|---|---|
| Modelos gratuitos (`:free`) | Tope de **20 solicitudes por minuto**; el tope diario depende de las compras de la cuenta: **50/día** con menos de 10 créditos comprados y **1 000/día** con 10 o más; límites por cuenta, no por clave | [klymentiev.com](https://klymentiev.com/blog/openrouter-free-tier), [truefoundry.com](https://www.truefoundry.com/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you) |
| Cantidad | ~19 modelos de texto gratuitos a inicios de octubre de 2026 (17 con sufijo `:free`); ~422 modelos de texto en total a finales de octubre. Cambian con frecuencia | [truefoundry.com](https://www.truefoundry.com/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you), [benchlm.ai](https://benchlm.ai/hosts/openrouter) |
| Privacidad | Una fuente dice que **9 de los 19 gratuitos corren en proveedores cuya política admite entrenar con tus datos** → los gratuitos solo para información pública | [truefoundry.com](https://www.truefoundry.com/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you) |
| Enrutamiento por privacidad | `provider.data_collection` («allow»/«deny») y `provider.zdr` (solo endpoints con retención cero); una fuente advierte que `data_collection` **no verifica por sí solo** las condiciones de retención de cada proveedor | [openrouter.ai (doc, fragmento)](https://openrouter.ai/docs/client-sdks/typescript/models/sttrequestprovider) |
| Comisión | Varias fuentes mencionan una comisión de **5.5 %** al comprar créditos; **no confirmada** en la página oficial | [betterclaw.io](https://www.betterclaw.io/blog/openrouter-vs-direct-api-agents), [omidsaffari.com](https://omidsaffari.com/blog/openrouter-pricing) |
Una fuente cita ~200 solicitudes/día por modelo: contradice a las demás y se descarta.

## Cómo se completa (cuando haya acceso a `openrouter.ai`)
1. `npm run ia:catalogo` lee el **catálogo público** (sin clave, sin costo) y escribe una preselección con fecha de consulta (`CATALOGO_OPENROUTER_<fecha>.md`).
2. Se lee a mano la **página de cada candidato y de sus proveedores** (precio vigente, contexto, política de datos, límites, disponibilidad) y se llena la ficha de `SELECCION_MODELOS.md`.
3. Se prueba con `ia:humo` y `ia:evaluar` (ver `PRUEBA_REAL_OPENROUTER.md`).
Sin esos pasos, este documento NO debe usarse para fijar precios ni elegir modelos.
