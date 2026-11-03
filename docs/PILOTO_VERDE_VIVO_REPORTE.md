# Piloto — Nova AI Solutions → Verde Vivo → «Control inteligente de inventario»
Reporte de aceptación · base: commit `830bacd` conservado. Datos **100 % ficticios**. Sin cuentas empresariales reales, sin compras, sin gasto.

## Veredicto
| Criterio | Resultado |
|---|---|
| El sistema detecta **3 productos bajo el mínimo** y prepara un **borrador de 66 unidades** | ✅ **Real** (cálculo del sistema, comprobado con una consulta SQL independiente). Ver «Origen de los datos» |
| Flujo completo: agencia → cliente → 3 empleados → oficina 3D → inventario → automatización → delegación → aprobación | ✅ Ejecutado de verdad, **con el modelo de IA simulado** (guion; no es Claude) |
| Aprobación sin ejecutar compras | ✅ Aprobar solo marca el borrador «aprobado, **sin enviar**»; no existe integración de compras |
| Aprobación por Telegram | ✅ con servidor de Telegram **simulado** · ❌ **Telegram real: no verificado** (sin token) |
| **Claude real** | ❌ **No verificado** (sin `ANTHROPIC_API_KEY`). El verificador `npm run pilot:claude` está listo |
**Conclusión honesta:** la *plataforma* cumple el flujo del piloto. Lo que **no** se ha demostrado es que Claude real (a) elija bien las herramientas y (b) delegue como el guion; eso es lo primero que hay que verificar con una clave.

## 1. Qué existía antes (auditoría) y qué faltaba
**Existía:** motor de tareas con delegación y aprobaciones, programador de automatizaciones, oficina 3D, Telegram/WhatsApp (adaptadores sin verificar), empleados «Controlador de inventario», «Analista de proveedores» y «Supervisor general».
**No existía:** inventario, regla «bajo el mínimo», borrador de resurtido, herramientas de inventario para los empleados, nada llamado Nova AI Solutions / Verde Vivo, ni ese «inventario ficticio definido anteriormente» (no está en ningún repositorio ni conversación).
**Hallazgos de la auditoría, todos corregidos:**
1. 🐞 Las automatizaciones ejecutaban **solo la tarea inicial**: una cadena de delegación disparada por el programador se quedaba a medias. Ahora ejecuta toda la cadena.
2. 🐞 Una automatización de una empresa creada por una agencia **fallaba** (buscaba un «propietario de la empresa» que no existe cuando la opera la agencia). Ahora usa al dueño de la agencia.
3. 🐞 El motor ofrecía `delegate_task` pero **nunca le decía al modelo quiénes eran sus compañeros ni sus identificadores**: con Claude real la delegación no habría funcionado. Ahora el prompt lista a los compañeros activos (con id).
4. La solicitud de aprobación decía solo «inventario.solicitar_resurtido»; ahora dice «resurtir 3 productos (66 unidades) — no se envía ninguna compra».
5. 🔒 El **registro estaba abierto** a cualquiera con la URL (y cada cuenta puede gastar IA). Nuevo `SIGNUP_ALLOWED_EMAILS` para cerrarlo en el piloto.
**Agregado (solo lo necesario):** tablas `inventory_items` y `restock_drafts`; carga por CSV con validación; 4 herramientas internas (`leer_inventario`, `calcular_resurtido`, `guardar_borrador_resurtido`, `solicitar_resurtido`); página `/inventario`; módulo `src/server/pilot`.

## 2. Pasos ejecutados
Fuente: `docs/pilot/evidencia/fase_a.json`, `fase_telegram.json`, `ui.json` y capturas. Reproducir: ver §6.
| # | Paso | Tipo | Resultado y evidencia |
|---|---|---|---|
| 1 | Crear agencia y empresa | **Real** | «Nova AI Solutions» y «Verde Vivo» creadas en la base |
| 2 | Contratar los tres empleados | **Real** | Controlador de inventario y Analista de proveedores (Operaciones) · Supervisor general de agentes (Dirección) |
| 3 | Oficina 3D | **Real** (escena + navegador) | 3 empleados en 2 áreas + la zona «Tareas automáticas»; clic en un empleado abre sus acciones. `capturas/02-oficina-3d.png` |
| 4 | Cargar inventario ficticio | **Real** | 10 productos; **3 bajo el mínimo** (Fertilizante 3/6 → +22 · Maceta 4/10 → +26 · Sustrato 2/8 → +18) = **66**; la grava (6/6, justo en el mínimo) NO se marca. Verificación SQL independiente: 3 y 66 |
| 5 | Ejecutar la automatización | **Mixto** | Real: programador, motor, herramientas, base de datos. **Simulado: las decisiones del modelo** (guion `PilotSimProvider`) |
| 6 | Delegación y resultados | **Mixto** | 3 tareas, 3 niveles: Controlador → Analista → Supervisor. Cada traspaso lleva los datos reales (p. ej. «Maceta de barro 20 cm (4/10)», «66 unidades»). Llamadas: leer → calcular → delegar → calcular → guardar borrador → delegar → solicitar |
| 7 | Solicitud de aprobación | **Real** | 1 aprobación pendiente: «resurtir 3 productos (66 unidades) — no se envía ninguna compra»; borrador en estado `borrador`; **0 acciones externas** |
| 7b | Aprobar / rechazar | **Real** | Aprobar → `aprobado_sin_enviar` con evidencia «NO se envió ninguna compra»; rechazar → `rechazado`; caducada o sin permiso → no se ejecuta |
| 8 | Telegram | **Simulado** | Adaptador real hablando con un servidor Telegram local: webhook con secreto incorrecto → 401; vinculación; aviso de aprobación con el resumen correcto; «sí/ok» no aprueban; `APROBAR` pide confirmación; `CONFIRMAR` ejecuta |
| 8-real | Telegram real | **No verificado** | Sin token. `npm run pilot:telegram` verifica el bot **sin enviar mensajes** |
| 9 | Claude real | **No verificado** | Sin API key. `npm run pilot:claude` corre el mismo piloto con Claude (base en memoria, tope de 1 US$) |
**Navegador (`ui.json`, 20 pruebas ✓):** inventario con 3 filas marcadas y «66 unidades»; historial con los 3 empleados; seguimiento de la delegación paso a paso; aprobación pendiente (escritorio y móvil sin desplazamiento horizontal); aprobar desde la interfaz; el borrador queda «Aprobado — NO se envió ninguna compra»; «Revisar inventario ahora» no duplica una revisión reciente; 0 errores de JavaScript.

## 3. Real vs simulado (matriz)
| Componente | Estado |
|---|---|
| Cálculo de bajo mínimo / unidades / borrador | **Real** (código determinista; el modelo **no** decide cantidades: el servidor recalcula aunque el modelo mande otras cifras — probado) |
| Programador, motor de tareas, delegación, aprobaciones, base de datos, 3D, interfaz | **Real** |
| Decisiones del modelo (qué herramienta llamar, a quién delegar) | **Simulado** (guion; los datos que usa salen de los resultados reales de las herramientas) |
| Telegram | **Simulado** (adaptador real, servidor falso) |
| Claude / API de Anthropic | **No ejecutado** |
| Compras / proveedores | **No existen** (por diseño) |

## 4. Origen de los datos (importante)
El «inventario ficticio definido anteriormente» **no se encontró**. Este conjunto lo definió el equipo técnico y está **calibrado para dar 3 productos y 66 unidades**. Por eso el «66» demuestra que el sistema **calcula correctamente** sobre estos datos, no que descubra un dato externo. Si tienen el inventario original, se carga en `/inventario` (CSV) y el resultado se vuelve a comprobar.

## 5. Límites conocidos
- La regla de resurtido (reponer hasta el máximo) es la definida aquí; confirmar que coincide con la de Verde Vivo.
- La automatización se programa «cada N minutos» desde su creación (mínimo 15), **no «cada día a las 8:00»**.
- La oficina 3D con una sola fila ancha puede recortar la etiqueta del último módulo (cosmético; no se tocó por la instrucción de no hacer mejoras estéticas).
- Con Claude real el borrador solo se crea si el modelo llama a las herramientas correctas; si no, queda «sin borrador» y se ve en el historial (no se inventa).
- Las pruebas de aceptación usaron PGlite; **PostgreSQL por red no se ha probado** (ver lista de Hostinger).

## 6. Cómo repetirlo
```bash
npm run check                                         # 173 pruebas, tipos y secretos
npx tsx scripts/pilot/acceptance.ts a docs/pilot/evidencia/fase_a.json          # pasos 1-7 (base .data vacía)
npx tsx scripts/pilot/acceptance.ts telegram docs/pilot/evidencia/fase_telegram.json
npm run build && npx next start -p 3111 &  &&  node scripts/pilot/pilot_ui.cjs docs/pilot/evidencia/capturas docs/pilot/evidencia/ui.json
ANTHROPIC_API_KEY=… MODEL_INPUT_USD_PER_MTOK=… MODEL_OUTPUT_USD_PER_MTOK=… npm run pilot:claude   # cuando haya clave
TELEGRAM_BOT_TOKEN=… npm run pilot:telegram                                                          # cuando haya bot
```
Despliegue: [PILOTO_HOSTINGER.md](PILOTO_HOSTINGER.md).
