# Crea tu Oficina IA

Plataforma SaaS multiempresa para construir una oficina con empleados de inteligencia artificial, con supervisión humana. **Producto independiente**: no contiene código, datos ni credenciales de Mentes Maestras ni de ningún negocio de José.

> Estado: **MVP.** Núcleo (Fases 1, 3 y 4) en código y probado con simulaciones; Fase 2 (Composio) con adaptador **sin verificar**. Lee [docs/REPORTE_DE_PRUEBAS.md](docs/REPORTE_DE_PRUEBAS.md) antes de afirmar que algo "funciona".

## Instalar (computadora)

```bash
npm install
cp .env.example .env.local     # edítalo; nunca subas este archivo
npm run dev                    # http://localhost:3000
```
Sin configurar nada puedes registrarte, construir la oficina, contratar, editar skills y ver permisos y aprobaciones. **Los empleados no ejecutan tareas** hasta definir `ANTHROPIC_API_KEY` y las tarifas (la interfaz lo dice; nada se simula). Guía: [docs/GUIA_CLAUDE_Y_COMPOSIO.md](docs/GUIA_CLAUDE_Y_COMPOSIO.md).

Base de datos: sin `DATABASE_URL` usa PGlite (Postgres embebido, solo desarrollo, en `.data/`). En producción, Postgres.

## Comandos
`npm run check` (tipos + pruebas + escaneo de secretos) · `npm run build` · `npm run automations:tick` · `POST /api/cron/tick` con `Authorization: Bearer $CRON_SECRET`.

## Documentación
[Auditoría (Fase 0)](docs/AUDITORIA_FASE_0.md) · [Arquitectura](docs/ARQUITECTURA.md) · [Integraciones](docs/INTEGRACIONES.md) · [Catálogo](docs/CATALOGO_EMPLEADOS.md) · [Pruebas](docs/REPORTE_DE_PRUEBAS.md) · [Roadmap](docs/ROADMAP.md)
