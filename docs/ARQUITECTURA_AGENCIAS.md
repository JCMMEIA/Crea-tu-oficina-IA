# Arquitectura B2B2B: Plataforma → Agencia → Cliente → Departamentos → Agentes → Tareas

Ver el plan de migración en [MIGRACION_AGENCIAS.md](MIGRACION_AGENCIAS.md). Esta página describe lo **implementado**.

## Modelo
```
Plataforma (este software)
 └─ Agencia (agencies)            ← cliente que paga: usuarios agency_members (owner/admin/member)
     ├─ Identidad (nombre, lema, color, logo), plan, presupuesto de IA de la agencia
     ├─ Catálogo comercial (agency_services) y skills reutilizables (agency_skill_templates)
     ├─ Propuestas (proposals)
     └─ Empresas cliente (companies.agency_id)  ← unidad de aislamiento de datos
         ├─ usuarios del cliente (memberships: owner/admin/member/viewer)
         └─ Departamentos → Empleados (skills versionadas) → Tareas, aprobaciones, conexiones, conocimiento, uso
```

## Autorización (backend)
| Capa | Mecanismo |
|---|---|
| Sesión | `actorFromToken` (empresa) y `agencyActorFromToken` (agencia) leen la sesión por **hash de token**; la cookie `cto_company` solo *sugiere* la empresa y se **revalida siempre**. |
| Agencia → cliente | **Único puente `actAs(agencyActor, companyId)`**: exige `companies.agency_id = agencia del actor`; si no, «Empresa no encontrada» (no revela existencia). Mapea roles: `agency_owner→owner`, `agency_admin→admin`, `agency_member→member`. |
| Funciones de agencia | Reciben `AgencyActor`, comprueban `assertAgencyCan(...)` y filtran `WHERE agency_id = $actor.agencyId`. |
| Funciones de empresa | Reciben `Actor`, comprueban `assertCan(...)` y filtran `WHERE company_id = $actor.companyId` (sin cambios respecto al MVP). |
| Usuario de cliente | Solo tiene `memberships`: no resuelve `AgencyActor`, y `actorFromToken(token, otraEmpresa)` devuelve `null` aunque sea de la misma agencia. |
| UI | Las páginas no confían en la URL: `notFound()` si la empresa/propuesta no es de la agencia; probado en navegador (404 y cookie falsificada ignorada). |

**Límite conocido:** los servicios de empresa confían en el `Actor` que reciben; el `Actor` solo se construye en `actorFromToken`/`actAs`. Segunda barrera pendiente: RLS de Postgres.

## Límites y costos
Plan de la agencia (`prueba`: 2 clientes y 8 empleados; hay `emprendedor/agencia/avanzado`) · presupuesto mensual de IA **de la agencia** (suma de sus clientes) · presupuesto y tope por hora **por cliente** · tope diario por empleado · tarifa obligatoria. `estimateServiceCost` = tareas/mes × tokens supuestos (4000 entrada / 1200 salida) × tarifa configurada; sin tarifa, **no estima**.

## Marca blanca
La oficina del cliente muestra nombre, logo y color de la agencia (logo: URL https o PNG/JPG/WEBP ≤150 KB; SVG y `javascript:` rechazados). **Pendiente:** dominio propio por agencia, ocultar totalmente el nombre del producto en correos/documentos, términos de licencia de reventa.

## Preparado para suscripciones (sin cobros)
`agencies.plan`, `billing_status`, `external_customer_id`, `PLANS` con límites, `usage_events` por empresa/empleado/tarea. No hay integración de pagos ni se activó ningún cobro.

## Pendiente
Administrador de plataforma · invitaciones por correo (hoy la agencia crea el usuario con contraseña inicial) · cambio de contraseña por el usuario · facturación · licencias de reventa · RLS · chat con agentes · cola de trabajos · múltiples agencias por usuario.
