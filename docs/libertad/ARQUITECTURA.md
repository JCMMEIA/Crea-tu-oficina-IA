# Mi Plan de Libertad — arquitectura (MVP)

Rama `claude/mi-plan-libertad`, basada en el PR #3 (Cerebro y tareas guiadas). No incluye router OpenRouter, afiliados ni landing (esos viven en otras ramas/PR). Estado: **construido y probado en local; no fusionado, no desplegado**.

## Decisiones clave
1. **El agente es un flujo determinista, no un chat de IA.** El cuestionario (`src/features/libertad/cuestionario.ts`) decide la siguiente pregunta con reglas de ramificación; las cifras salen del motor (`engine/`). Así los cálculos son reproducibles, el costo de IA es **cero** y los datos financieros **no salen** a ningún proveedor externo. Un resumen redactado por IA (opcional) queda como fase 2, solo con consentimiento `ia_externa` (ya modelado), enviando agregados y no respuestas crudas, y pasando por el router y sus cuotas.
2. **Motor determinista** (`engine/calc.ts`): funciones puras, MXN neto, sin impuestos. Calcula los 18 puntos pedidos; si falta un dato devuelve `null` + lista de lo que falta (nunca inventa precisión). Evita doble conteo (fondo de emergencia vs. inversiones vs. inversiones que ya generan ingreso). La tasa de retiro se trata como **escenario ilustrativo**, no como rendimiento ni garantía.
3. **Privacidad por diseño**: datos por `(company_id, user_id)`; cifrado AES-256-GCM en la aplicación con clave derivada (HKDF) de `APP_SECRET` + oficina + usuario; sin clave nueva que administrar. Ni administradores, ni agencias, ni operadores pueden leerlos (solo miembros directos; una agencia que opera un cliente queda bloqueada). La bitácora guarda solo el tipo de evento. Exportar (HTML imprimible/JSON) y borrar (plan, versiones, seguimiento, objetivos compartidos y consentimientos) están implementados.
4. **Cerebro Empresarial sin duplicar**: el módulo es independiente. Al Cerebro solo llegan **objetivos operativos de ≤300 caracteres, sin cifras de dinero, que la persona autoriza uno por uno** (`libertad_shared_goals`, máx. 5). Cambio mínimo en `src/server/brain/index.ts` (+ pruebas de que no se filtra nada más y de que no hay inyección de etiquetas).
5. **«Convertir mi plan en tareas»** (`planToTasks`): relaciona las actividades que la persona quiere soltar con las **8 tareas guiadas que existen**; lo que no cubren se declara explícitamente. Nada se ejecuta solo y no se afirma ahorro hasta medirlo.

## Modelo de datos (`schema.sql`)
`libertad_plans` (1 por usuario y oficina, `data_enc`), `libertad_versions` (instantáneas con resultados, para comparar), `libertad_checkins` (seguimiento mensual), `libertad_consents` (`guardar`, `ia_externa`), `libertad_shared_goals` (texto autorizado para el Cerebro). Todo con `ON DELETE CASCADE`.

## Flujo de la persona
Consentimiento → diagnóstico corto (≈11 preguntas) o profundo (≈100) → Mapa de Libertad (métricas, fondo, dependencia del ingreso, escenarios, tiempo, riesgos, metas, plan 30/90/365, supuestos editables, confianza) → versiones y comparación → seguimiento mensual → tareas y objetivos compartidos → exportar/borrar. Cada cifra lleva etiqueta: dato aportado, cálculo, estimación, recomendación general o supuesto sin confirmar.

## Qué NO es
No es asesoría financiera, fiscal ni legal; no recomienda valores ni promete rendimientos; las cinco etapas son nuestra organización, **no una escala validada** (no se reproduce la escala del CFPB); no atribuye fórmulas propias a ninguna institución.

## Pendiente / no verificado
- **Investigación**: ninguna fuente primaria se pudo abrir (red). `INVESTIGACION_CIENTIFICA.md` es un borrador marcado como no verificado; la app **no cita estudios ni cifras externas** hasta contrastarlas. Dominios por habilitar en la red del entorno: `pubmed.ncbi.nlm.nih.gov`, `www.library.hbs.edu`, `news.harvard.edu`, `www.consumerfinance.gov`, `livingwage.mit.edu`, `www.morningstar.com`, `www.inegi.org.mx`, `www.condusef.gob.mx`, `www.dof.gob.mx`, `www.banxico.org.mx`, `www.gob.mx`, `www.consar.gob.mx`, `doi.org`.
- Supuestos por defecto (inflación 4 %, tasas 3–5 %, escenarios ±) son **ilustrativos y editables**; se ajustan cuando se verifiquen Banxico y Morningstar.
- Privacidad México: aviso de privacidad específico, consentimiento expreso para datos patrimoniales y plazos ARCO requieren revisión de un abogado antes de publicar.
- Si se cambia `APP_SECRET`, los planes guardados dejan de poder leerse: exportar antes.
- Fase 2: resumen con IA (consentimiento + cuotas), demo pública en la landing (rama aparte sobre el PR #4), PDF nativo (hoy: HTML imprimible).
