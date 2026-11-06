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
Con el instalador v2 `deploy/convivencia/instalar_router.sh`. No usar `actualizar_convivencia.sh`. La migración se aplica sola al arrancar y es idempotente.
