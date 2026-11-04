# 09 · Comparación con Crea tu Oficina IA

Columna «Vilma» = lo que publica, según el resumen facilitado por el usuario (no verificado por mí). Columna «Nosotros» = verificado leyendo el repositorio (`a4d48d4`). Estado: **Funciona** (código + pruebas), **Parcial**, **Diseñado** (existe diseño/datos sin uso real), **No existe**.

| Función | Qué ofrece Vilma | Evidencia | Qué tenemos | Estado real | Qué mejorar | Prioridad | Dificultad | Impacto |
|---|---|---|---|---|---|---|---|---|
| Cerebro por cliente/oficina | Foundation: productos, ofertas, audiencia, tono, objetivos, valores, documentos | Resumen usuario | Documentos con permisos por empleado (`knowledge_docs`) | **Parcial** | Ficha estructurada (tono, valores, reglas) + inyección compacta | **P0** | Baja–media | Muy alto |
| Perfil del negocio usado por la IA | Los agentes lo consultan automáticamente | Resumen usuario | `companies.profile` se captura, **no se lee** al ejecutar | **Diseñado (sin efecto)** | Inyectarlo en cada tarea | **P0** | Baja | Muy alto |
| Memoria compartida | Foundation compartido; memoria conversacional NO VERIFICADO | Resumen/—| Solo traspaso en delegación | **Parcial** | Hechos aprobados y ejemplos aprobados | P2 | Media | Medio |
| Empleados especializados | 15+ (18+ en Max), nombres NO VERIFICADOS | Resumen/búsqueda | 41 con nombre, puesto, ficha, foto-monograma | **Funciona** | Retratos, ficha ya hecha; falta lista curada para el lanzamiento | P1 | Baja | Alto |
| Chat directo con un especialista | Sí | Resumen usuario | Tarea con instrucción libre (no hilo conversacional) | **Parcial** | Chat con historial por empleado | P2 | Media | Alto |
| Tareas preparadas y formularios | Plantillas con preguntas y metodología | Resumen usuario | Ejemplos de práctica, sin formularios | **No existe** | Catálogo de tareas con formulario | **P0** | Media | Muy alto |
| Workflows multi-paso | Etapas conectadas con Foundation | Resumen usuario | Delegación dinámica (tope 10), probada | **Parcial** | Recetas fijas con formulario y costo previo | **P0** | Media | Muy alto |
| Resultados descargables | Documentos guardables/descargables | Resumen usuario | Solo en pantalla | **No existe** | Exportar Markdown/PDF/DOCX | **P0** | Baja | Alto |
| Control de tokens/costos | Tokens y límite mensual por suscripción | Resumen usuario | Presupuesto USD por empresa/oficina, topes por hora/día, bloqueo previo; resumen en `/oficina` | **Funciona** (interno) | Mostrar cuota al cliente (tokens/tareas), aviso 80 %, comprar más | **P0** | Media | Alto |
| Onboarding | NO VERIFICADO | — | Asistente de 6 pasos, oficina de práctica, compra directa → oficina automática | **Funciona**, pero la primera tarea no es guiada | Primera tarea útil guiada | **P0** | Media | Muy alto |
| Suscripciones y límites | PRO US$37/mes, límites de proyectos | Resumen usuario | Stripe, pedidos, derechos de oficina, suscripciones/facturas; límites por clientes/empleados | **Funciona** (modo prueba; sin cobro real) | Planes Starter/Pro/Business con cuota | P1 | Media | Alto |
| Correo de acceso | NO VERIFICADO | — | Resend + seguimiento + panel | **Parcial**: entrega real sin verificar | Verificar en el VPS | **P0** | Baja | Crítico |
| Conexiones externas | NO VERIFICADO | — | Conectores con aprobación (Composio) | **Parcial**: no verificadas con cuentas reales | Probar 1–2 reales | P2 | Media | Medio |
| Mensajería (WhatsApp/Telegram) | NO VERIFICADO | — | Implementado con aprobaciones y pruebas simuladas | **Parcial** | Verificar con canal real | P3 | Media | Medio |
| Aislamiento entre proyectos | NO VERIFICADO | — | Por `company_id`, probado | **Funciona** | — | — | — | Alto (confianza) |
| Oficina 3D / visual | No documentado | — | Existe | **Funciona** | Diferenciador a destacar | P3 | — | Medio |
| Amplitud (ventas, finanzas, operaciones, atención) | Enfocado en marketing (INFERIDO) | Búsqueda | 7 departamentos, 41 empleados | **Funciona** | Ser el eje del mensaje | P1 | Baja | Alto |
| Prueba social | NO VERIFICADO | — | Ninguna real aún (no se inventa) | **No existe** | Pilotos con permiso | P1 | Media | Alto |

## Respuesta corta
Lo que Vilma publica y nuestros clientes **todavía no pueden hacer**: (1) elegir una tarea con formulario guiado, (2) lanzar un workflow de varios pasos predefinido, (3) descargar el resultado, (4) ver una cuota de uso clara y (5) tener un perfil de negocio que la IA realmente use. Lo que **nosotros ya tenemos** y no está documentado en Vilma: amplitud por departamentos, aprobaciones, aislamiento probado y control de gasto previo.
