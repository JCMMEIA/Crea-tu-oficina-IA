# Guía: Claude y Composio

Las claves las escribe **el propietario**, solo en `.env.local` (fuera de git). Nunca en chats, documentos ni capturas.

## Claude
1. En la consola de Anthropic crea una clave solo para esta app y **fija un límite de gasto mensual** (único tope estricto).
2. `.env.local`: `ANTHROPIC_API_KEY`, `MODEL_ID` y tarifas `MODEL_INPUT_USD_PER_MTOK` / `MODEL_OUTPUT_USD_PER_MTOK` (sin tarifa la app **no ejecuta**).
3. Reinicia, asigna una tarea a un empleado y revisa el consumo.

## Composio
1. Crea clave de API y configura las *auth configs* de cada app.
2. `COMPOSIO_API_KEY` y `APP_SECRET` (`openssl rand -base64 32`).
3. «Conecta tu empresa» → Conectar → autoriza → Probar conexión. El id de empresa es la entidad: cada empresa, sus propias cuentas.
4. **Verifica** rutas y slugs en `src/server/connectors/index.ts` contra la documentación vigente: se escribieron sin acceso a ella.

## Producción
`DATABASE_URL`, `CRON_SECRET`, HTTPS, y un programador que llame cada 15 min a `POST /api/cron/tick`. No desplegar sin la Fase 5.
