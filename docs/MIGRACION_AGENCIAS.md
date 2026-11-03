# Plan de migración: de empresa única a Plataforma → Agencia → Cliente

Revisión de la arquitectura actual (2026-11-03): el tenant es `companies`; cada servicio recibe un `Actor {userId, companyId, role}` y todas las consultas filtran por `company_id`. Eso **se conserva**: la empresa cliente pasa a ser la unidad de aislamiento de datos de trabajo (departamentos, empleados, skills, tareas, conexiones, conocimiento, uso).

## Estrategia: añadir una capa, no reescribir
| Cambio | Detalle |
|---|---|
| Nueva tabla `agencies` | Marca blanca (nombre, especialidad, logo, color, lema), plan y presupuesto de IA de la agencia. |
| `companies.agency_id` | Cada empresa cliente pertenece a **una** agencia. Migración idempotente: las empresas del MVP reciben una agencia propia y sus propietarios pasan a `agency_owner`. |
| `agency_members` | Roles de agencia: `agency_owner`, `agency_admin`, `agency_member`. Los usuarios de la empresa cliente siguen en `memberships` (owner/admin/member/viewer). |
| **Un único puente** `actAs(agencyActor, companyId)` | Verifica en backend que la empresa pertenece a la agencia y devuelve un `Actor` de empresa (agency_owner→owner, agency_admin→admin, agency_member→member). Así **todos los servicios existentes funcionan sin tocarlos** y el aislamiento entre agencias depende de un solo punto probado. |
| Catálogo de servicios, skills reutilizables, propuestas, leads | Tablas nuevas con `agency_id`; el catálogo de plataforma (plantillas) sigue inmutable. |
| Límites | Plan de la agencia (clientes, empleados) + presupuesto de IA mensual de agencia, además del de cada cliente. |
| Compatibilidad | `signup()` del MVP se conserva (crea agencia + empresa + ambas membresías). Las 25 pruebas originales siguen verdes. |

## Reglas de autorización
1. Un usuario de agencia solo ve/gestiona clientes con `companies.agency_id = su agencia`.
2. Un usuario de cliente solo opera su empresa (`memberships`); no tiene acceso a funciones de agencia.
3. Toda función de agencia recibe `AgencyActor` y filtra por `agency_id`; toda función de empresa recibe `Actor` y filtra por `company_id`.
4. Los IDs de otras agencias/clientes responden «no encontrado», no «prohibido» (no revelan existencia).

## Fases
1. Esquema + migración + autorización + pruebas de aislamiento. 2. Servicios de agencia (clientes, catálogo, skills, despliegue, propuestas, costos, métricas). 3. Interfaz de agencia y modo cliente con marca. 4. Landing, acceso anticipado y medición. 5. Documentación y evidencia.

## Fuera de alcance de hoy (pendiente)
Cobros y suscripciones reales, invitaciones por correo, administrador de plataforma, dominios propios por agencia, licencias de reventa.
