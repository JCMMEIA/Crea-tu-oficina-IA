# Roadmap hacia SaaS comercial

> Actualizado 2026-11-03 por el giro B2B2B: el cliente es la **agencia**. Hecho: modelo Agencia→Cliente, catálogo, propuestas, landing. Próximo: ver los puntos 1, 2 y «Pendiente» de [ARQUITECTURA_AGENCIAS.md](ARQUITECTURA_AGENCIAS.md) (administrador de plataforma, invitaciones, RLS, facturación con autorización, dominios propios, licencia de reventa).

1. **Desbloqueo (José):** claves de Claude y Composio → verificar ejecución real y una integración real (Meta Ads o Sheets) con cuenta de prueba.
2. **Fase 2:** verificar adaptador Composio; herramientas para Instagram/Notion/Slack/Drive; MCP; WhatsApp oficial.
3. **Fase 3:** chat con agentes, retorno hijo→padre, comparador de versiones, confirmación de cambios propuestos por IA, plantilla del flujo de anuncios de 9 pasos.
4. **Fase 4:** cola de trabajos, webhooks entrantes, alertas por correo/Slack.
5. **Fase 5:** RLS, 2FA, verificación de correo, recuperación de contraseña, limitador por IP, E2E en CI, observabilidad, backups, privacidad y términos, carga de archivos con escaneo y embeddings.
6. **Comercial (requiere autorización de José):** planes sobre `companies.plan`, facturación (suscripción+consumo) con `usage_events`, marketplace, plantillas por industria, app móvil sobre una API.
