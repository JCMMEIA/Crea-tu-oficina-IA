# 04 · Cerebro empresarial

## A. Qué publica Vilma (fuente: resumen facilitado por el usuario; no verificado por mí)
- **Foundation / «Cerebro del proyecto»**: reúne productos, ofertas, audiencia, tono, objetivos, valores y documentación. — CONFIRMADO según resumen.
- **Los agentes lo consultan automáticamente** para personalizar respuestas. — CONFIRMADO según resumen.
- Los workflows **pueden usar** el Foundation. — CONFIRMADO según resumen.
- Buyer persona, memoria conversacional, contexto compartido entre agentes, actualización y separación de datos entre proyectos: **NO VERIFICADO** (no se facilitó texto). La idea de «proyectos» sugiere separación por proyecto: **INFERIDO**.
- **Arquitectura interna (embeddings, RAG, prompts largos): DESCONOCIDO.** No hay evidencia pública en lo entregado.

## B. Qué tenemos nosotros (VERIFICADO EN NUESTRO CÓDIGO)
| Pieza | Estado real | Evidencia |
|---|---|---|
| Documentos de conocimiento por oficina | **Funciona.** Tabla `knowledge_docs` (título, tipo, texto ≤200 000 caracteres), pantalla «Lo que debe saber mi negocio» | `src/server/knowledge/index.ts`, `src/app/(app)/conocimiento/page.tsx` |
| Permiso por empleado | **Funciona.** Cada documento puede limitarse a ciertos empleados (`allowed_employee_ids`) | `searchForEmployee` |
| Recuperación | **Básica:** coincidencia de palabras (sin embeddings), máx. 3 documentos × 1 500 caracteres por tarea | `searchForEmployee` |
| Protección contra inyección | **Funciona.** El contenido se envuelve como `documento_no_confiable` | `wrapUntrusted`, `src/server/tasks/index.ts:107-120` |
| Perfil del negocio (sector, productos, clientes, competidores, metas, problemas, apps) | **Se captura y se guarda pero NO se usa:** ninguna ruta de ejecución de tareas lee `companies.profile` (búsqueda en `src/server/tasks`, `skills`, `models`: 0 coincidencias) | `profileAction` en `src/app/actions.ts`; columna `companies.profile` |
| Memoria compartida entre empleados | **Solo traspaso:** al delegar, la tarea hija recibe el contexto y el resultado parcial del padre; no hay memoria entre tareas ni historial conversacional | `delegate_task`, `src/server/tasks/index.ts:144-148` |
| Tono, buyer persona, valores | **No existen como campos.** Solo texto libre dentro de documentos | — |
| Aislamiento entre oficinas | **Funciona** y se prueba (todo por `company_id`; pruebas de aislamiento y E2E) | `tests/*`, E2E compra |

**Conclusión:** tenemos la *tubería* (documentos + permisos + recuperación + protección), pero falta el *contenido estructurado* y que el perfil llegue a la IA. Esa es la mayor brecha frente al patrón Foundation.

## C. Diseño propuesto: Cerebro Empresarial (original, para todos los departamentos)
**Principio:** una sola ficha estructurada por oficina + documentos libres, inyectada de forma compacta y con trazabilidad.

1. **Ficha base (siempre se inyecta, ≤ ~600 tokens):** nombre y giro, qué vende (productos/servicios con precio), cliente ideal, tono de voz (3 adjetivos + ejemplos de frases permitidas/prohibidas), objetivos del trimestre, valores, restricciones legales («nunca prometer…»). Reutiliza `companies.profile` y añade `tono`, `valores`, `reglas`.
2. **Capas por departamento:** `marketing` (marca, personas, canales), `ventas` (oferta, objeciones, precios, proceso), `finanzas` (política de cobro, margen mínimo), `operaciones` (proveedores, tiempos), `atención` (políticas de devolución, FAQ), `administración` (contactos, calendario fiscal). Cada documento lleva `departamento` y se inyecta solo a empleados de ese departamento (+ los marcados «toda la oficina»). Se apoya en `allowed_employee_ids` existente.
3. **Memoria de hechos aprobados:** tabla `brain_facts` (hecho, fuente = tarea/documento/usuario, estado = propuesto/aprobado). Los empleados **proponen** hechos nuevos («el cliente prefiere envío gratis»); el dueño aprueba. Nunca se escribe memoria sin aprobación.
4. **Resultados como memoria:** un resultado marcado «bueno» por el usuario pasa a ser ejemplo reutilizable (few-shot) para esa tarea.
5. **Recuperación mejorada:** primero palabras (ya existe), después embeddings **solo si** las pruebas muestran fallas; no añadir infraestructura antes.
6. **Frescura:** fecha de actualización visible; aviso «este documento tiene más de 90 días».
7. **Seguridad/privacidad:** todo por `company_id`; nada cruza oficinas; contenido de usuarios siempre como datos no confiables; borrado real a petición.
8. **Medición:** registrar qué fragmentos se usaron por tarea (para depurar «por qué dijo eso») y su costo en tokens.

**Esfuerzo:** pasos 1–2 pequeño (días); 3–4 mediano; 5 solo si hace falta.
