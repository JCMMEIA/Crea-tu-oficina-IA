# Sistema visual

- **Tokens** (`src/app/premium.css`): azul noche `--bg #060616`, panel `#0d0c26`, morado `--brand #7c4dff` / `--brand-3 #8b5cf6`, texto `#f5f4ff`, tenue `#a9a7c6`. Tipografía Inter local. Radios 10/14/20 px.
- **Capa de la landing** (`src/features/funnel/funnel.css`, prefijo `fx-`): se carga solo en la landing. Secciones alternadas con un degradado muy sutil; tarjetas con borde y fondo translúcido; botones y pestañas en píldora; documentos de ejemplo en «hoja clara» para distinguir lo que sería un entregable del resto de la interfaz.
- **Retratos:** aún no existen (los generaría un servicio de imágenes con autorización de gasto). Mientras tanto, **monograma** con color por departamento; si se agrega `public/employees/<clave>.webp`, la landing lo muestra sola. Los retratos se rotulan siempre como ilustraciones de personas ficticias.
- **Capturas reales:** `public/landing/*.webp` (panel de demostración, datos de ejemplo) y cuatro del módulo del PR #3 (`cerebro-negocio`, `cerebro-marca`, `tarea-formulario`, `consumo`).
- **Movimiento:** entrada suave al hacer scroll (`Reveal`) y flotado lento de dos etiquetas del hero; todo se desactiva con «reducir movimiento» y el contenido es visible sin JavaScript.
- **Accesibilidad:** contraste AA (axe sin hallazgos graves), pestañas con `aria-selected/aria-pressed`, tablas con `caption`, enlaces con foco visible, botones táctiles ≥ 44 px, sin emojis como iconos.
- **Móvil:** una columna; en el directorio se muestran 6 empleados antes de «Ver más»; tablas con scroll horizontal interno; sin scroll horizontal de página.
