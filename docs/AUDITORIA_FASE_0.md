# Auditoría Fase 0 (2026-11-03)

Alcance: lectura de repos disponibles en la sesión (archivos y ramas). **No se modificó ninguno.** No se revisaron PRs ni el tablero.

| Repo | Hallazgo | Reutilización |
|---|---|---|
| `JCMMEIA/JCMMEIA` | Reglas comunes y separación de datos ("se comparte el método, nunca los datos"). | Se adoptan las **reglas** (un conector por negocio, sin secretos en git, sin datos reales en el producto). |
| `mentes-maestras-ia` | `main` solo README. Ramas `respaldo/mm-agency-os/*`: panel Next.js + Drizzle + Postgres (login scrypt, auditoría, adaptador de IA, topes de costo, aprobación humana). Rama `claude/plugin-mm-20261102`: plugin con 32 agentes y 5 skills. Decisión de José: el panel no se toca hasta la fase C. | **Solo patrones.** No se copió código ni prompts: son de otro negocio y pueden incluir material con licencia (mentes-maestras-ia#7). |
| `alquimia-agentes` | README solo; sin código en `main`. | Nada (otro negocio). |

No auditados: `alquimia-charms`, `AGENTE-GENERADOR-INGRESOS`, `Alchemia-Charms` (fuera del alcance de la sesión, mezclan negocios).

## Viabilidad
| Pieza | Estado |
|---|---|
| Claude API (`@anthropic-ai/sdk`, clave de API oficial) | Viable; **sin clave en la sesión → ninguna llamada real**. |
| Composio | Adaptador escrito de memoria (API v3); **sin verificar** (sin clave y `docs.composio.dev` no accesible desde la sesión). |
| MCP | Encaja como otro `ConnectorAdapter`; no implementado. |
| Meta Ads, Shopify, Google, Notion, Slack, GitHub, Asana | Vía Composio; pendiente con cuentas reales. |
| WhatsApp Business | Solo API oficial de Meta; adaptador pendiente. |
| TikTok, Higgsfield, Mercado Libre | Marcadas **no disponibles** en la interfaz. |
