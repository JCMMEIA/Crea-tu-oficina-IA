# Auditoría del sistema actual → modelo LANDING → PAGO → OFICINA AUTOMÁTICA

Fecha: 2026-11-04. Qué había, qué se reutilizó y qué faltaba. («Oficina IA» = una **agencia**: ya era un inquilino aislado con sus clientes, empleados, tareas, límites y plan.)

| Pieza | Estado antes | Decisión |
|---|---|---|
| **Landing** (`/`) | Embudo de «acceso anticipado» y demostraciones 1 a 1 | **Reescrita**: CTA «Crear mi oficina IA» directo al pago; precio configurable; si la tienda está cerrada, lista de espera |
| **Stripe** (`commercial/stripe.ts`, webhook, firma, idempotencia por evento, claves live bloqueadas) | Solo para una agencia YA existente | **Reutilizado y extendido**: checkout sin cuenta previa, portal de pagos, cancelar al final del periodo, pausar cobro |
| **Licencias / planes / límites** | Funcionaban (tests) | Reutilizado; la compra ahora crea el plan |
| **Usuarios y auth** | Registro con contraseña (abierto o por lista) | **Nuevo**: cuentas sin contraseña creadas al comprar + enlaces de acceso de un solo uso. Registro público **cerrado** por defecto |
| **Agencias** (`agencies`, `agency_members`) | Ya soportaba varias agencias por usuario **en el modelo de datos**… | …pero la sesión elegía siempre «la primera por orden alfabético» → **defecto corregido** (oficina activa elegida y revalidada) |
| **Acceso a empresas** (`actorFromToken`) | Resolvía la empresa por «la primera agencia» del usuario | **Defecto corregido**: ahora por la agencia a la que pertenece esa empresa |
| **Onboarding** (`/empezar`, 6 pasos) | Funcionaba | Reutilizado; añadido «tipo de negocio» con servicios y empleados predeterminados |
| **Panel administrativo** (`/admin`) | Prospectos, licencias, soporte, métricas | Reutilizado; **añadido** `/admin/conversion` (embudo, CAC, pedidos, verificar IA, cortesías) |
| **Correo** | **No existía** | **Nuevo**: cola en base + Resend (reintentos, sin duplicados) |
| **Verificación de IA antes de vender** | No existía | **Nuevo**: compuerta de venta |
| **Empleados simulados** | La app no los usa (solo scripts de prueba); el asistente de práctica rotula «ejemplo ilustrativo» si no hay IA | Se mantiene: con IA no verificada, la tienda **no abre** |

## Defectos reales hallados y corregidos durante el trabajo
1. `agencyActorFromToken` ignoraba cualquier selección de oficina (siempre la primera).
2. `actorFromToken` accedía a empresas por «la primera agencia» (con varias oficinas habría dado acceso con la agencia equivocada).
3. El envío de correos reclamaba un mismo correo desde dos procesos a la vez → **doble envío** (arreglado con «arrendamiento» y reintentos con espera; prueba de regresión).
4. Un correo fallido se reintentaba 5 veces seguidas en la misma pasada (arreglado).
5. Formularios dentro de `<p>` en el panel producían un error de hidratación de React (arreglado).
6. Preguntas frecuentes y textos de ayuda decían «hoy no se cobra nada»: habrían sido falsos al abrir ventas (actualizados).
