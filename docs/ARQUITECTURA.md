# Arquitectura y decisiones

Monolito modular: **Next.js (App Router) + TypeScript + Postgres**. UI fina en `src/app`; lógica en `src/server/*`, probada sin navegador.

| Decisión | Por qué | Descartado |
|---|---|---|
| Next.js + TS, server actions | Un despliegue, tipos de punta a punta, poco mantenimiento. | Backend/frontend separados: más costo sin beneficio hoy. |
| Postgres (`pg`) en producción, PGlite en dev/pruebas | Mismo SQL, pruebas rápidas, transacciones. | Supabase: probable después (RLS), pero añade un servicio contratado; se pospone. |
| Aislamiento: toda consulta privada filtra por `company_id` y recibe un `Actor` | Falla cerrado; probado con dos empresas. Siguiente: RLS como segunda barrera. | — |
| Roles owner/admin/member/viewer | Solo owner/admin configuran y aprueban. | — |
| Skills versionadas; plantilla inmutable en código, copia por empresa | Personalizar no altera la plantilla ni a otros clientes. Restaurar crea versión nueva. | — |
| Orquestador propio (padre/hijo, profundidad ≤3, ≤10 tareas/cadena, huella anti-duplicado) | Sin framework multiagente hasta demostrar necesidad. | LangGraph/CrewAI. |
| Herramientas = permiso (`none/read/write`) ∩ skill ∩ conexión activa; escrituras como **solicitud de aprobación** por defecto | La ejecución real solo ocurre vía herramienta y deja `task_events` con la respuesta: evidencia. | — |
| Contenido externo = datos (`<documento_no_confiable>`) | Mitiga inyección; **reduce, no elimina**: por eso lo sensible exige aprobación humana. | — |
| Costos: tarifa obligatoria, bloqueo previo por presupuesto mensual, topes por hora/empresa y día/empleado, tokens y tiempo | Evita gasto sin control. Son estimaciones: fija también límite en la consola del proveedor. | — |
| Conectores tras `ConnectorAdapter`; entidad = empresa | Ampliar sin reconstruir; Composio guarda credenciales (esta app no guarda tokens de terceros). | — |
| Facturación futura | `usage_events` y `companies.plan` ya existen; sin cobros. | — |
| Móvil futuro | Servicios reutilizables tras una API; UI responsive. | — |

## Seguridad implementada
scrypt, sesiones con hash de token (7 días, cookie httpOnly/SameSite), bloqueo tras 5 fallos/15 min, zod, `audit_log`, cron con comparación de tiempo constante, `npm run secrets:check`, AES-256-GCM listo (`connectors/crypto.ts`).

## Límites conocidos
- La tarea corre dentro de la petición HTTP; falta cola de trabajos.
- Sin RLS, verificación de correo, recuperación de contraseña, 2FA ni limitador por IP.
- Delegación: el hijo recibe el resultado parcial del padre; el resultado del hijo no vuelve al padre automáticamente.
- **Sin chat conversacional**: hoy se asignan tareas.
- Búsqueda documental por palabras clave; solo texto pegado (sin PDF/Office).
- «Comparar resultados»: sin comparador lado a lado (cada tarea guarda la versión de skill). «Cambios propuestos por IA»: existe `diffSpecs` y la comparación de versiones; la interfaz del modo principiante aplica sin pantalla de confirmación.
