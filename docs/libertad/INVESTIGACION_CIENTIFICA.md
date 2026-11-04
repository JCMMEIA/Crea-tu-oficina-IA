# Mi Plan de Libertad: base científica y metodológica (borrador)

> **ESTADO: BORRADOR NO VERIFICADO (2026-11-04).** Las fuentes primarias no se pudieron abrir desde el entorno de desarrollo (dominios no permitidos por la red). Nada de este documento debe citarse en la app o en material comercial hasta contrastarlo con la fuente primaria. Ver la lista de dominios por habilitar en `docs/libertad/ARQUITECTURA.md`.

Fecha de consulta: 2026-11-04. Redactado para uso interno. No es asesoría financiera, fiscal ni legal.

## 1. Resumen y advertencias

**Advertencia principal sobre verificación.** En esta sesión el acceso a la red estuvo restringido. Las 8 llamadas a WebFetch fallaron con `ENOTFOUND` (pubmed.ncbi.nlm.nih.gov, www.library.hbs.edu, news.harvard.edu, www.consumerfinance.gov, livingwage.mit.edu, www.morningstar.com). `curl` con el proxy devolvió `CONNECT tunnel failed, response 403` (probado con PubMed e inegi.org.mx). No desactivé TLS ni evadí el proxy.

Por lo tanto, **ninguna de las fuentes obligatorias se abrió directamente.** Lo que sigue proviene de **resúmenes devueltos por la herramienta de búsqueda web** (WebSearch), que citan medios, repositorios y despachos. Esos resúmenes son secundarios y pueden contener errores. Cada dato lleva su etiqueta:

- **[BÚSQUEDA]**: apareció en un resumen de búsqueda; la fuente primaria NO se abrió. Hay que contrastar antes de citar públicamente.
- **[NO VERIFICADA]**: no se pudo confirmar en absoluto.

Cualquier cifra de este documento marcada [BÚSQUEDA] debe revisarse contra la fuente primaria (DOI, DOF, INEGI) antes de aparecer en la app o en material comercial. Nada se cita de memoria como verificado.

**Otras advertencias de diseño:**
- La app trabaja con cantidades NETAS que aporta el usuario; no calcula ISR ni da consejo fiscal.
- Las tasas de retiro son estimaciones para EE. UU., no garantías, y no son rendimiento de inversión.
- La escala de bienestar financiero del CFPB tiene condiciones de uso propias: no se reproduce ni se presenta como escala validada.
- Los hallazgos académicos son poblacionales; no predicen el caso individual.

## 2. Niveles de evidencia

| Nivel | Qué es | Ejemplos aquí | Cómo lo presenta la app |
|---|---|---|---|
| (a) Académica | Estudio revisado por pares, con método y limitaciones | Whillans et al. 2017; Killingsworth et al. 2023; Gollwitzer y Sheeran 2006; Lusardi y Mitchell 2014 | "Un estudio encontró…"; nunca "está demostrado para ti" |
| (b) Regla financiera orientativa | Heurística o estimación de la industria, con supuestos | Tasa de retiro de Morningstar; Bengen/Trinity; meta de inflación | Escenarios ilustrativos con supuestos visibles |
| (c) Recomendación práctica | Guía de educación financiera de una autoridad | CONDUSEF (fondo de emergencia, presupuesto); CONSAR (ahorro voluntario) | "Autoridades recomiendan…", con enlace |
| (d) Metodología propia | Fórmulas que definimos nosotros | Sección 5 | "Cálculo de Mi Plan de Libertad"; no se atribuye a nadie |

## 3. Fichas por fuente

Formato: autor/institución · fecha · metodología · hallazgo · limitaciones · preguntas que justifica · función en la app · estado.

### A1. Whillans, Dunn, Smeets, Bekkers y Norton, «Buying time promotes happiness», PNAS 114(32):8523-8527 (2017)
- **Estado:** NO abierta (PubMed y HBS fallaron por red). Solo resumen de búsqueda [BÚSQUEDA]. URL: https://pubmed.ncbi.nlm.nih.gov/28739889/ ; DOI 10.1073/pnas.1706541114. Fecha de consulta 2026-11-04.
- **Metodología [BÚSQUEDA]:** encuesta en varios países (EE. UU., Dinamarca, Canadá, Países Bajos) y un experimento de campo en el que se daban 40 dólares para gastar en tiempo o en bienes. Los resúmenes discrepan sobre el tamaño de muestra (más de 6,000; 6,271; casi 4,500). **No citar tamaños de muestra hasta abrir el artículo.**
- **Hallazgo [BÚSQUEDA]:** adultos que trabajan reportan más felicidad tras una compra que ahorra tiempo que tras una compra material; el efecto se mantiene al controlar por ingreso.
- **Limitaciones:** la encuesta es correlacional; el experimento de campo parece pequeño (un resumen menciona 60 canadienses; [BÚSQUEDA], no confirmado); muestras de países ricos, no de México; el gasto en tiempo se mide con la experiencia reportada, no con horas liberadas medidas.
- **Preguntas que justifica:** cuántas horas por semana dedica a tareas que podría delegar; cuánto pagaría por recuperarlas; qué haría con ese tiempo.
- **Función:** «Costo de recuperar tiempo» (sección 5.6) y priorizar qué delegar. Redacción prudente: "la investigación sugiere que gastar en ahorrar tiempo se asocia con más bienestar", no "te hará feliz".
- **Pendiente:** el artículo de HBS Working Knowledge no se abrió; no se sabe su fecha ni su resumen.

### A2. Whillans, Weidman y Dunn, «Valuing time over money is associated with greater happiness», Social Psychological and Personality Science 7:213-222 (2016)
- **Estado:** NO abierta. Solo resumen de búsqueda [BÚSQUEDA]. DOI 10.1177/1948550615623842 (según el resumen). Consulta 2026-11-04.
- **Metodología [BÚSQUEDA]:** seis estudios (N total 4,690); se creó una medida de preferencia tiempo vs. dinero (ROM).
- **Hallazgo [BÚSQUEDA]:** priorizar tiempo sobre dinero se asocia con mayor bienestar subjetivo, efecto "pequeño pero robusto"; se mantiene al controlar materialismo.
- **Limitaciones [BÚSQUEDA]:** correlacional, sin causalidad; no incluyó personas en pobreza. Existe seguimiento longitudinal preregistrado con estudiantes (~1,000), según el resumen; no verificado.
- **Justifica:** pregunta de valores "¿prefieres más tiempo o más ingreso?". **Función:** perfil de preferencia que ajusta el tono del plan (no que cambie los números).
- Nota: la búsqueda sobre "time poverty" específicamente no se hizo en profundidad. Pendiente.

### B. Harvard Study of Adult Development (Waldinger y Schulz; Harvard Gazette, 2023)
- **Estado:** la nota de la Gazette NO se abrió ni apareció en la búsqueda. URL pedida: https://news.harvard.edu/gazette/story/2023/02/work-out-daily-ok-but-how-socially-fit-are-you/. Solo medios secundarios [BÚSQUEDA].
- **Metodología [BÚSQUEDA]:** estudio observacional longitudinal iniciado en 1938; cohortes originales de 268 egresados de Harvard y 456 hombres de barrios de Boston (cifras según un resumen; el tamaño total actual varía entre fuentes, ~2,000 a ~2,500).
- **Hallazgo [BÚSQUEDA]:** la satisfacción en las relaciones a mediana edad fue el mejor predictor de salud y felicidad a los 80 (según una entrevista citada de forma secundaria).
- **Limitaciones [BÚSQUEDA]:** cohortes originales solo hombres, sin personas de color (palabras de Waldinger citadas por un medio); observacional, asociación y no causalidad; contexto EE. UU. del siglo XX.
- **Justifica:** preguntas sobre con quién quiere pasar el tiempo recuperado y qué relaciones quiere cuidar. **Función:** el plan incluye "uso del tiempo liberado" con peso a relaciones; se declara como motivación, no como cálculo.

### C. CFPB, bienestar financiero (Consumer Financial Protection Bureau)
- **Estado:** las dos URLs NO se abrieron. Solo un blog del CFPB (enero de 2015) y copias secundarias aparecieron en búsqueda [BÚSQUEDA]. URLs pedidas: https://www.consumerfinance.gov/consumer-tools/financial-well-being/about/ y https://www.consumerfinance.gov/data-research/research-reports/financial-well-being-scale/.
- **Metodología [BÚSQUEDA]:** el CFPB dice haber llegado a los elementos conversando con consumidores (fase cualitativa); el informe posterior de la escala no se abrió, por lo que no se documenta su muestra ni su validación.
- **Cuatro elementos (parafraseados) [BÚSQUEDA]:** (1) control sobre las finanzas del día a día; (2) capacidad de absorber un imprevisto; (3) avanzar hacia metas financieras; (4) libertad de elegir para disfrutar la vida. Dos son del presente y dos del futuro.
- **Limitaciones:** contexto EE. UU.; definición conceptual.
- **Uso restringido:** la escala tiene términos de uso propios. **No se reproduce ni se copian sus ítems, y no se afirma que nuestro cuestionario esté validado.** Podemos decir que nuestras cuatro áreas están "inspiradas en el marco conceptual de cuatro elementos" y que las preguntas son propias, no validadas psicométricamente. Antes de nombrar al CFPB en la interfaz, leer sus condiciones de uso.
- **Justifica:** estructura del diagnóstico (control, colchón, metas, libertad). **Función:** cuatro indicadores del tablero, calculados con nuestras fórmulas (sección 5).

### D. MIT Living Wage Calculator (A. Glasmeier)
- **Estado:** página de metodología NO abierta (https://livingwage.mit.edu/pages/methodology). Solo resúmenes de prensa/MIT News [BÚSQUEDA].
- **Metodología [BÚSQUEDA]:** salario antes de impuestos necesario para cubrir necesidades básicas del hogar (alimentación, salud, vivienda, transporte, cuidado infantil, otros), con base de trabajo de tiempo completo (2,080 horas al año), por condado en EE. UU.
- **Limitaciones [BÚSQUEDA]:** la propia autora lo describe como piso mínimo, no estándar de clase media, y posible subestimación en zonas caras. Es de EE. UU.; **no se traslada a México.**
- **Función:** solo como analogía conceptual: "necesidades básicas" como categoría separada de "estilo de vida". Los montos los capta el usuario o se contrastan con ENIGH.

### E. Morningstar, tasa de retiro segura 2026 (+ Bengen, Trinity)
- **Estado:** la página de Morningstar NO se abrió (error de red, no muro). Resúmenes secundarios [BÚSQUEDA]: MoneyWeek, ThinkAdvisor, Nasdaq, Kiplinger. URL: https://www.morningstar.com/retirement/whats-safe-retirement-withdrawal-rate-2026.
- **Hallazgo [BÚSQUEDA]:** tasa inicial base de 3.9% para un horizonte de 30 años con 90% de probabilidad de que el dinero dure, frente a 3.7% para 2025 y 3.3% en 2021; los métodos flexibles permitirían iniciar más alto (cifras de ~5.7% a casi 6%, discrepantes entre resúmenes). Autores 2026 según ThinkAdvisor: Arnott, Benz, Kephart (un resumen lo atribuye de otra forma; **no atribuir autores en la app**).
- **Bengen (1994, Journal of Financial Planning) y Trinity (Cooley, Hubbard, Walz, 1998) [BÚSQUEDA]:** Bengen usó períodos históricos de 30 años de EE. UU. y encontró que ~4% inicial ajustado por inflación sostuvo una cartera 50/50; Trinity reportó tasas de éxito por portafolio y plazo (el "95% a 4%" es histórico). Los papers primarios no se abrieron.
- **Aclaraciones obligatorias:** (1) la tasa de retiro NO es rendimiento de inversión; es el % del patrimonio que se gasta en el primer año, bajo supuestos de portafolio, plazo e inflación; (2) son estimaciones basadas en datos y simulaciones de EE. UU. y en dólares, no garantías; (3) no están calibradas para México, MXN, ni para el horizonte, impuestos y tasas locales; (4) dependen del plazo (30 años), no de "libertad para siempre".
- **Función:** meta patrimonial ilustrativa por escenarios (5.5), con tasas de 3%, 3.5%, 4% y 5%, **elegidas por nosotros como rango ilustrativo**, no como recomendación de Morningstar.

### F. Killingsworth, Kahneman y Mellers (2023), «Income and emotional well-being: A conflict resolved», PNAS 120(10):e2208661120
- **Estado:** NO abierta (PubMed falló). Resumen [BÚSQUEDA]. DOI 10.1073/pnas.2208661120. Consulta 2026-11-04.
- **Metodología [BÚSQUEDA]:** colaboración adversarial con Mellers como facilitadora; se reanalizaron datos de muestreo de experiencia (Killingsworth, 2021).
- **Hallazgo [BÚSQUEDA]:** para la mayoría, el bienestar sube con el logaritmo del ingreso sin meseta; solo en el grupo menos feliz hay aplanamiento (~100,000 USD, que los autores asocian al umbral de 75,000 USD de 2010 ajustado por inflación). Contraste con Kahneman y Deaton (2010): meseta en ~75,000 USD, con preguntas dicotómicas.
- **Limitaciones:** datos de adultos en EE. UU., ingreso declarado, bienestar emocional (no satisfacción con la vida); el dinero es un determinante entre muchos; efecto en MXN no extrapolable.
- **Justifica:** pregunta "¿cuánto ingreso es suficiente para ti?" como valor del usuario, sin un número mágico. **Función:** la app NO usa "umbrales de felicidad"; el objetivo es definido por el usuario.

### G. México

**G1. INEGI, ENIGH.** URL https://www.inegi.org.mx/programas/enigh/ NO abierta. Resumen de búsqueda de la ENIGH 2024 [BÚSQUEDA] (comunicado INEGI 112/25, no abierto): gasto corriente monetario promedio de ~15,891 pesos mensuales por hogar; alimentos, bebidas y tabaco ~37.7%; transporte y comunicaciones ~19.5%; educación y esparcimiento ~1,531 pesos. Las cifras varían por redondeo y por tipo de gasto (monetario vs. no monetario). Fecha de publicación **no verificada**. Función: sugerir rubros del presupuesto y marco de comparación, **nunca** como "lo normal para ti". Las medias de hogar no representan a empresarios.

**G2. CONDUSEF.** https://www.condusef.gob.mx/ NO abierta; no se hizo búsqueda específica. Guías de presupuesto, fondo de emergencia y retiro: **NO VERIFICADAS**. No citar sus recomendaciones (p. ej. "3 a 6 meses") hasta abrir el documento exacto.

**G3. Banxico / INEGI, inflación.** [BÚSQUEDA] Meta de 3% con intervalo de ±1 punto (confirmado por Monex y otro medio; fuente primaria Banxico no abierta). Dato reportado: inflación anual de 3.62% en la primera quincena de octubre de 2026 según Zeta Tijuana (otro medio dio 3.63% y otra subyacente distinta); **cifra no confiable, usar solo como dato "a verificar".** La app debe dejar la inflación como parámetro configurable (supuesto), no como dato fijo.

**G4. CONSAR.** [BÚSQUEDA] gob.mx/consar define el ahorro voluntario como aportación adicional a la cuenta Afore; canales y montos mínimos/máximos y deducibilidad **NO verificados** (página oficial no abierta). La app puede mencionar "ahorro voluntario en Afore" como opción a consultar, sin tratamiento fiscal.

**G5. Profeco y SAT.** No investigados. **NO VERIFICADOS.** El SAT solo se menciona como: ISR sobre retiros, rentas y dividendos varía; la app trabaja con montos netos que captura el usuario.

### H. Privacidad en México
- **Estado:** no se abrió el DOF ni gob.mx. Hallazgos por búsqueda [BÚSQUEDA] con fuentes secundarias (EY, KPMG, Garrigues, Littler, Basham, Legiscope) y un resultado que apunta a la versión de Diputados (https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), **no abierta**.
- **Ley vigente [BÚSQUEDA]:** nueva Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicada en el DOF el 20 de marzo de 2025, en vigor al día siguiente (21 de marzo de 2025); abroga la de 5 de julio de 2010. Una versión mostraba "última reforma 14-11-2025" (verificar).
- **Autoridad [BÚSQUEDA]:** las funciones del INAI para particulares se entienden transferidas a la Secretaría Anticorrupción y Buen Gobierno (confirmado por varios despachos, incluido Garrigues).
- **Obligaciones principales [BÚSQUEDA]:** aviso de privacidad con finalidades diferenciadas; consentimiento tácito por regla general, **expreso para datos financieros o patrimoniales**, y expreso y por escrito (firma o mecanismo de autenticación) para datos sensibles (art. 8, según un resumen); derechos ARCO gratuitos (un blog cita 20 días hábiles de respuesta y 15 para ejecutar, ampliables; **un solo blog, no confiable**); medidas de seguridad.
- **No verificado:** reglas exactas sobre transferencias y encargados (tratamiento por un proveedor de IA), transferencias internacionales, plazos, el reglamento (un resumen dice que el Ejecutivo tenía 90 días para adecuaciones; su estado se desconoce), y si "estilo de vida" cae en datos sensibles.
- **Implicaciones prácticas para la app (no son asesoría legal):**
  1. Mostrar un aviso de privacidad claro antes de capturar datos, con finalidades separadas (plan, mejora del producto, marketing).
  2. Pedir consentimiento expreso (casilla no premarcada, con registro de fecha) para datos financieros; tratar los datos de salud, familia o estilo de vida con cautela como posibles sensibles.
  3. Declarar que los datos se envían a un proveedor de IA externo (encargado o tercero), dónde se procesa y si se retiene o se usa para entrenar; **esto requiere revisión de un abogado**.
  4. Minimizar: no pedir CURP, RFC, cuentas, saldos exactos ni identificadores; aceptar rangos y cantidades aproximadas; no enviar al proveedor de IA nombre ni datos de contacto.
  5. Canal ARCO funcional (correo y proceso interno), borrado de datos a petición, y medidas de seguridad documentadas.
  6. **Requiere revisión de un abogado:** el texto del aviso, la base de consentimiento, el contrato con el proveedor de IA y la transferencia internacional.

### I. Fuentes adicionales (solo lo visto en búsqueda)

**I1. Gollwitzer y Sheeran (2006)**, «Implementation intentions and goal achievement: A meta-analysis of effects and processes», Advances in Experimental Social Psychology 38:69-119. DOI 10.1016/S0065-2601(06)38002-1. NO abierta. [BÚSQUEDA] 94 pruebas independientes, efecto medio-grande (d = 0,65) en el logro de metas; mecanismo: planes "si X, entonces Y". Limitación: mayoría de estudios de laboratorio y conductas de salud; efectos específicos por dominio varían y no se verificaron. **Función:** cada meta termina en un paso con cuándo y dónde ("si es lunes a las 9, entonces…").

**I2. Lusardi y Mitchell (2014)**, «The Economic Importance of Financial Literacy: Theory and Evidence», Journal of Economic Literature 52(1):5-44. DOI 10.1257/jel.52.1.5 (también NBER WP 18952). NO abierta (texto restringido). [BÚSQUEDA] Revisión de la literatura sobre la relación entre alfabetización financiera y decisiones económicas. Los hallazgos concretos no se verificaron. **Función:** justifica incluir explicaciones simples en la app; no justifica un puntaje de "alfabetización".

**I3.** No se encontraron ni abrieron fuentes serias sobre fondo de emergencia/shocks ni sobre delegación del tiempo del dueño de pequeñas empresas. **Queda pendiente.** No afirmar nada sobre ello.

## 4. Pregunta del cuestionario, fuente y función

| Pregunta (borrador) | Fuente (estado) | Función de la app |
|---|---|---|
| Horas semanales que dedica a tareas delegables | Whillans 2017 [BÚSQUEDA] | Costo de recuperar tiempo (5.6); lista de tareas a delegar |
| ¿Prefiere más tiempo o más ingreso? | Whillans 2016 [BÚSQUEDA] | Tono y prioridades del plan |
| Con quién quiere usar el tiempo liberado | Harvard [BÚSQUEDA] | Sección motivacional del plan |
| Ingresos mensuales netos, fijos y variables | Propia | Brecha de ingresos (5.2); ingresos sostenibles (5.5) |
| Gastos, incluidos anuales/bimestrales | Propia; ENIGH solo como referencia de rubros [BÚSQUEDA] | Prorrateo (5.1) |
| Ahorro líquido disponible | CFPB elemento "absorber un shock" [BÚSQUEDA]; CONDUSEF sin verificar | Cobertura en meses (5.3) |
| ¿Qué ingreso mensual lo haría sentirse libre? | Killingsworth 2023 [BÚSQUEDA]; propia | Meta definida por el usuario, sin umbral universal |
| Metas y plazos | CFPB "avanzar hacia metas" [BÚSQUEDA]; Gollwitzer 2006 [BÚSQUEDA] | Metas con paso concreto "si-entonces" |
| ¿Cuánto control siente sobre sus finanzas diarias? | CFPB (concepto) [BÚSQUEDA] | Indicador cualitativo propio, sin escala validada |
| Supuestos de inflación y rendimiento | Banxico meta 3% [BÚSQUEDA]; Morningstar [BÚSQUEDA] | Parámetros configurables en escenarios |
| Consentimiento y aviso | LFPDPPP 2025 [BÚSQUEDA] | Pantalla de consentimiento (revisar con abogado) |

## 5. Metodología propia (definida por nosotros; no se atribuye a ninguna institución)

Todas las cantidades son NETAS (después de impuestos), capturadas por el usuario. La app no calcula ISR. Estos son modelos simples y orientativos, no predicciones.

**5.1 Prorrateo de gastos no mensuales.** Gasto mensual equivalente = (monto anual + suma de pagos bimestrales y trimestrales anualizados) / 12. Ejemplo: seguro de 12,000 MXN al año equivale a 1,000 MXN/mes. Así el presupuesto no se subestima por gastos que llegan de golpe.

**5.2 Brecha de ingresos.** Brecha = gasto mensual objetivo (en el estilo de vida deseado) − ingreso mensual neto sostenible (5.5). Positiva = falta ingreso; negativa = holgura. Opcional: expresar en múltiplos de la brecha actual.

**5.3 Cobertura del fondo de emergencia en meses.** Meses = ahorro líquido disponible / gasto mensual esencial (con prorrateo). La app muestra el número y una escala de colores configurable; **no afirma** que "3 a 6 meses" sea la recomendación de ninguna institución hasta verificar CONDUSEF.

**5.4 Gasto anual neto y meta patrimonial ilustrativa.** Gasto anual neto = (gasto mensual deseado × 12) − ingreso pasivo neto ya existente × 12. Meta = gasto anual neto / tasa del escenario. Escenarios ilustrativos que elegimos: 3%, 3.5%, 4%, 5%. Ejemplo (solo ilustración): gasto anual neto de 600,000 MXN con tasa 4% da una meta de 15,000,000 MXN; con 3%, 20,000,000 MXN. Aclarar: la tasa es de retiro, no de rendimiento; supone un horizonte y un portafolio que no evaluamos; es ilustrativa. Los valores se expresan en pesos de hoy y deben ajustarse con la inflación.

**5.5 Ingreso que depende de horas vs. sostenible.** Sostenible = ingreso neto que continúa si el dueño deja de trabajar 90 días (rentas, dividendos, contratos recurrentes, equipo operando sin él). Dependiente de horas = el resto. Proporción sostenible = sostenible / ingreso total. Es una autoevaluación del usuario; la clasificación de cada fuente de ingreso la decide él.

**5.6 Costo de recuperar tiempo.** Costo por hora recuperada = costo mensual de delegar o automatizar una tarea / horas mensuales liberadas. Se compara con el valor que el usuario asigna a su hora (campo propio, no una norma). Mostrar siempre la incertidumbre y no sugerir que cualquier delegación vale la pena.

## 6. Cosas que NO debemos afirmar

- Que "el dinero compra felicidad" o que "comprar tiempo te hará feliz": los estudios son de poblaciones y de otros países.
- Que existe un ingreso "suficiente" universal (el umbral de 75,000 USD fue matizado en 2023).
- Que la regla del 4% (o 3.9%) es segura, garantizada o aplicable a México; que la tasa de retiro es un rendimiento.
- Que Morningstar, Bengen, Trinity, el CFPB, el MIT o cualquier institución avalan nuestras fórmulas o nuestro cuestionario.
- Que nuestro cuestionario es una escala validada o equivale a la escala del CFPB.
- Que 3 a 6 meses de fondo de emergencia es recomendación oficial (sin verificar).
- Que los datos del Harvard Study aplican a mujeres, personas de color o mexicanos de forma directa.
- Cifras fiscales o de Afore (deducibilidad, montos) sin consultar la fuente oficial.
- Que cumplimos con la LFPDPPP; eso requiere revisión de un abogado.
- Cualquier dato de la sección 3 marcado [BÚSQUEDA] como "verificado".

## 7. Fuentes que no pude verificar (lista completa)

Ninguna de las siguientes se abrió directamente (error de red en la sesión, no atribuible a su contenido):
1. https://pubmed.ncbi.nlm.nih.gov/28739889/
2. https://www.library.hbs.edu/working-knowledge/want-to-be-happier-make-more-free-time
3. https://news.harvard.edu/gazette/story/2023/02/work-out-daily-ok-but-how-socially-fit-are-you/
4. https://www.consumerfinance.gov/consumer-tools/financial-well-being/about/
5. https://www.consumerfinance.gov/data-research/research-reports/financial-well-being-scale/
6. https://livingwage.mit.edu/pages/methodology
7. https://www.morningstar.com/retirement/whats-safe-retirement-withdrawal-rate-2026
8. https://pubmed.ncbi.nlm.nih.gov/36857342/
9. https://www.inegi.org.mx/programas/enigh/ (curl: 403 del proxy)
10. https://www.condusef.gob.mx/ (sin abrir ni buscar)
11. Banxico, INEGI INPC, CONSAR (gob.mx/consar), Profeco, SAT: sin abrir
12. DOF / Diputados (LFPDPPP 2025): sin abrir
13. Gollwitzer y Sheeran 2006; Lusardi y Mitchell 2014; Whillans, Weidman y Dunn 2016; Bengen 1994; Cooley, Hubbard y Walz 1998: sin abrir

**Siguiente paso recomendado:** pedir a José que permita en la configuración de red de la sesión los dominios pubmed.ncbi.nlm.nih.gov, library.hbs.edu, news.harvard.edu, consumerfinance.gov, livingwage.mit.edu, morningstar.com, inegi.org.mx, condusef.gob.mx, gob.mx, dof.gob.mx, diputados.gob.mx, doi.org, y repetir la investigación para convertir las etiquetas [BÚSQUEDA] en verificación directa.
