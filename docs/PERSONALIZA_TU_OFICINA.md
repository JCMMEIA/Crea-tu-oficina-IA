# Personaliza tu oficina — reporte de la función

Cada oficina (agencia) elige **estilo** (cómo se ve) y **espacio** (dónde está); se combinan libremente (7 × 6) y se refleja en la oficina 2D/3D real.

## Cómo funciona
- **Datos:** columna nueva `agencies.office_design jsonb DEFAULT '{}'` (`ADD COLUMN IF NOT EXISTS`, al final de `schema.sql`, que ya se aplica en cada arranque). El código anterior la ignora; `{}` = aspecto de siempre. La marca (`agencies.brand`: color, logo, tono moderno/cálido/fresco) **no se duplica ni se toca**: el tono sigue siendo la base y el estilo temático solo lo sustituye cuando se elige uno.
- **Modelo puro:** `src/server/office3d/design.ts` (estilos, espacios, interruptores, reglas del «Diseño personalizado», `resolveTheme`, `placeDecor`). `design_store.ts` lee/guarda; la agencia sale SIEMPRE de la sesión y exige el permiso `agency:brand`.
- **Escena:** `companyScene`/`agencyScene` añaden `theme.look`; el layout (posiciones de empleados/zonas) no cambia.
- **Render:** 2D (`iso.tsx`, `iso_look.tsx`) y 3D (`Scene3D.tsx`, `Look3D.tsx`) con los mismos temas, fondos, pisos y decoración. Sin 3D sigue habiendo 2D y lista.
- **Pantalla:** `PersonalizeOffice.tsx` — en `/empezar` (paso 4) y en `/agencia/personalizar` (menú, «Mi marca» y «Ver mi oficina»). Elegir solo cambia la vista previa; se guarda con el botón.
- **Diseño personalizado:** el texto se guarda y se traduce con reglas locales (palabras clave → estilo/espacio/color/ajustes). Sin IA, sin red, sin costo.
- **Movimiento:** «animaciones», «luces», «premium», «inmersivo» y «reducir movimiento» son independientes; además se respeta `prefers-reduced-motion`.
- Los nombres públicos son originales (sin marcas, personajes ni logotipos).

## Pruebas
`tests/personaliza.test.ts` (21): 42 combinaciones, independencia estilo/espacio, tono heredado, sanitización, reglas locales, migración idempotente, guardado + nuevo inicio de sesión + cambio posterior, `updateBrand` no borra el diseño, aislamiento entre agencias, miembros sin permiso, no regresión (empleados, departamentos, plan, presupuesto, posiciones idénticos).

## Limitaciones conocidas
- Es solo apariencia: «empresa grande» no añade empleados falsos.
- El diseño personalizado entiende palabras clave en español; si no reconoce nada lo dice.
- La decoración 3D usa formas simples (no modelos detallados).
- El diseño es por oficina (agencia); los clientes de esa agencia lo ven igual.

## Despliegue (lo hace el dueño)
Con `deploy/convivencia/instalar_personaliza.sh` desde la rama `claude/personaliza-sobre-router` (el instalador v2 del router rechazaría este PR porque nace de `main`). Procedimiento y reversión: `docs/personaliza/INSTALAR_Y_REVERTIR.md`. No usar `actualizar_convivencia.sh`. La migración se aplica sola al arrancar y es idempotente.

## Dependencia entre ramas (nada se fusiona sin autorización del dueño)
- `claude/personaliza-tu-oficina` (este PR #8, contra `main`): solo la función; se revisa y se fusiona **después** del PR #7.
- `claude/personaliza-sobre-router`: PR #7 (`8f84f20`, router apagado) + este PR #8. Es la rama que instala `instalar_personaliza.sh` en el VPS. Comparación con el router: solo cambian los archivos de Personaliza; en `schema.sql` conviven las tablas del router y la columna `office_design`.
- Orden recomendado para `main`: primero PR #7, luego PR #8.

## Reporte final de preparación para producción
**Veredicto: NO ESTÁ LISTO para desplegar todavía** (ver «Pendiente»). Nada se ha fusionado, desplegado ni tocado en el VPS.

### Auditoría de cambios
- 37 archivos frente a `main`: 22 de `src/` (pantalla, modelo, escena 2D/3D, esquema), 1 instalador, 2 de pruebas y 12 de documentos/capturas.
- `agencies.brand` no se modifica; el único cambio de datos es la columna aditiva `office_design` (`ADD COLUMN IF NOT EXISTS`).
- Búsqueda de secretos (claves `sk-`, `re_`, `BEGIN PRIVATE`) en `src`, `deploy` y `tests`: sin coincidencias.

### Pruebas (copia de verificación en D:, rama combinada PR #7 + PR #8)
- Pasan completos: agency, catalogo, channels, commerce, commercial, configurar_correo, configurar_openrouter, core, design, email, employees, ia_costos, ia_panel_modelos, ia_privacidad, instalar_doc, instalar_personaliza (6/6), instalar_router, instalar_router_recuperacion, leads, messaging (solo, por memoria), office3d, openrouter_contrato, personaliza (21/21), pilot, redesign, router, stripe.
- **Bloqueadas por el equipo local de Windows (no por el código):**
  - `prueba_humo.test.ts` (PR #7, local con clave falsa) se cuelga: lanza `spawn("npx", …)` sin shell, que en Windows no encuentra `npx` y la prueba espera para siempre. El script real (`scripts/ia/prueba_humo.ts`) sí corre bien en modo simulacro (sin clave, sin llamadas, salida 0). El PR #8 no toca ese código; debe ejecutarse en Linux o en CI.
  - `instalar_real_historia.test.ts` se omite sola porque exige ser root en Linux. Tampoco la cubre este equipo.
  - Impacto: ambas pertenecen al instalador/prueba del router (PR #7), no a la función Personaliza. El riesgo restante es que la simulación completa del instalador sobre la historia real no se ha visto pasar aquí.
- Hubo 3 fallos intermedios por finales de línea de Windows (CRLF) al extraer en el equipo del dueño; git guarda LF y el VPS los recibe bien. Las pruebas de `bash -n` necesitan Git Bash en el PATH (el `bash` de WSL no tiene distribución instalada).
- Hidratación de React: 0 errores en 21 cargas (7 diseños, desarrollo y producción, PC y celular).

### Rendimiento (servidor local de producción)
- JavaScript: `/agencia` 471 KB, `/agencia/identidad` 471 KB, `/agencia/personalizar` 505 KB, `/agencia/oficina-3d` ~1,4 MB (incluye el motor 3D, solo en esa página). Sin imágenes pesadas. DOMContentLoaded 100–200 ms en local.
- Animación 3D a ~25 cuadros/s, solo si hay movimiento y la pestaña está visible.

### Riesgos
1. La versión realmente instalada en Hostinger solo la confirma `--verificar` en el VPS (solo lectura).
2. `instalar_personaliza.sh` no se ha ejecutado en Linux: solo pruebas estáticas y derivación del v2.
3. Migración probada con PGlite, no con PostgreSQL real (sentencia estándar y aditiva).
4. El disco C del equipo del dueño está lleno.

### Pendiente antes de poder decir «LISTO»
Publicar las ramas en GitHub, ejecutar `--verificar` en el VPS y la autorización expresa del dueño.
