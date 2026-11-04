# Rediseño premium de Crea tu Oficina IA — reporte

Fecha: 2026-11-04. Referencia visual: `docs/diseno/referencia.webp`. Comparativas: `docs/diseno/capturas/comparacion-escritorio.png` y `comparacion-laptop.png`. **Nada se publicó ni se desplegó; cobros reales y registro público siguen apagados.**

## Qué se hizo
| Entregable | Estado |
|---|---|
| Landing con scroll (9 secciones en el orden pedido) | Hecha: header fijo → hero con laptop → beneficios → cómo funciona → vista del producto → testimonios → oficinas del cliente → oferta + FAQ → cierre → footer |
| Fidelidad a la referencia | Mismo fondo azul noche con degradados morados, tipografía Inter (autoalojada), botones morados con degradado, tarjetas oscuras con borde sutil, laptop con el panel, iconografía SVG consistente, banda final con ondas luminosas |
| Dashboard rediseñado | Mismo sistema visual en TODO el panel de agencia: barra lateral con iconos, botones destacados «Nueva oficina IA» y «Mis oficinas», indicadores reales, «Mis oficinas» con estados, empleados por departamento, acciones rápidas |
| Demostración interactiva | `/panel-demo/*` (8 vistas: inicio, nueva oficina, mis oficinas, empleados, departamentos, automatizaciones, configuración, facturación). Sin registro ni pago, datos de ejemplo rotulados; **no toca la base de datos** (prueba automática), sin peticiones de escritura (probado en navegador) |
| Iniciar sesión | Botón en el header → `/recuperar` (ahora «Iniciar sesión»): enlace de un solo uso por correo. Sin contraseñas nuevas. Los correos de `PLATFORM_ADMIN_EMAILS` pueden entrar por enlace aunque aún no tengan cuenta (el enlace solo llega a ese buzón) → así entras como administrador sin puertas traseras ni registro abierto |
| Favicon | Edificio/oficina blanco sobre cuadro morado: `icon.svg`, `favicon.ico` (16/32/48), `apple-icon.png` (180), iconos 192/512 y *maskable*, `manifest.webmanifest`, `theme-color` |
| Responsive | Una columna en celular, menú móvil funcional (botón 44×44), botones de ancho completo, sin desplazamiento horizontal en 9 pantallas |
| Rendimiento / SEO / a11y | LCP 624 ms (escritorio) y 508 ms (móvil), CLS 0.000, 134–205 KB en la primera carga; imágenes WebP con `loading=lazy` salvo la del hero; fuente precargada; un `h1`, `lang=es`, descripción, `robots.txt`/`sitemap`; **axe-core (WCAG 2.1 AA): 0 problemas graves o críticos** en landing, demo, inicio de sesión y móvil |

## Decisiones de honestidad (diferencias deliberadas con la referencia)
- **Testimonios**: la referencia muestra personas con foto y 5 estrellas. **No se inventó nada**: la sección está oculta mientras `src/content/testimonials.ts` esté vacío; el diseño de las tarjetas existe y se puede ver con `/?demo=testimonios`, rotulado «Diseño de demostración · no son testimonios reales», sin fotos, nombres ni estrellas.
- **Cifras del dashboard** (430 tareas, +68 % de eficiencia): no existen. La demo muestra solo conteos de sus propios datos de ejemplo, marcados «Ejemplo»; ningún indicador de rendimiento.
- **Textos del hero**: «lista para configurar en minutos» en vez de «listo en minutos»; «Activación automática» en vez de «Activa en minutos»; «Sin permanencia» en vez de «Cancela cuando quieras» (la cancelación es al final del periodo). El texto de cómo funciona aclara que los empleados trabajan cuando se conectan la IA y las aplicaciones.
- **Nombre «Juliana»** y «Marketing IA / Ventas IA» de la referencia: no se usan; la demo usa nombres rotulados «(ejemplo)».
- **Precio inicial y mensualidad**: el modelo vigente es una sola suscripción; la oferta lo dice («primer pago y mensualidad»). Se configura con `PLAN_PRICE_MXN_*`. Un cobro de alta distinto no está soportado (no se construyó).
- La laptop del hero es una captura **real** del panel en modo demostración (se regenera con `scripts/landing/capturas.sh`), con leyenda.

## Cómo se comprobó
- `npm run check`: **232/232** pruebas (también contra PostgreSQL real), sin secretos. Nuevas (`tests/design.test.ts`): sin emojis en landing/panel/demo, la demo no toca BD ni sesiones, testimonios solo reales, tokens del sistema, favicon, peso de imágenes.
- **E2E de la landing: 65/65** (`scripts/e2e/landing_premium.cjs`): título y descripción exactos, orden de secciones, scroll largo, header fijo, botón «Ver panel por dentro», inicio de sesión (sin campo de contraseña), 6 recursos de favicon + manifest, demo interactiva sin escrituras, menús móviles (landing y panel), rutas protegidas redirigen a iniciar sesión, `/comprar` cerrado no abre pagos, axe, rendimiento, **0 errores de consola**.
- **E2E de compra y acceso: 63/63** (`scripts/e2e/compra_directa.sh`) con el rediseño: pago, webhook, oficina automática, enlace, configuración, primera tarea, segunda oficina, aislamiento, pausa/cancelación, dashboard de conversión. **Las funciones existentes no se rompieron.**
- Instalador de convivencia: sus pruebas siguen pasando.

## Límites (honestidad)
- El **resto de páginas internas** (clientes, empleados, tareas, 3D, asistente, ayuda…) heredan los colores y componentes nuevos, pero **todavía contienen emojis y textos antiguos** dentro de su contenido. El rediseño completo de esas pantallas es la siguiente fase.
- Con la tienda cerrada, el botón principal dice «Avísame cuando abran» (lista de espera). El botón «Crear mi oficina IA» exacto de la referencia aparece cuando la tienda abre (cobros + precio + correo + IA verificada).
- La demo no puede mostrar tareas reales ni resultados (aún no hay Claude real verificado).
- Términos y condiciones no existen: el pie lo dice «(próximamente)».
- Contraste/lectores de pantalla: verificado con axe (automático); falta una revisión manual con lector de pantalla.

## Cómo publicar (con respaldo y reversión) — requiere tu autorización
1. En tu VPS: `cd /root/crea-instalador && git pull && cd deploy/convivencia && sudo bash actualizar_convivencia.sh` (simulacro: muestra qué cambia).
2. `sudo bash actualizar_convivencia.sh --aplicar`: respaldo cifrado → baja el código → compila con tope de memoria → reinicia **solo** `crea-oficina` → comprueba `/api/health` → compara OpenClaw. **Si no responde, vuelve solo a la versión anterior.** (No hay migraciones de base de datos en este cambio.)
3. Comprueba en el navegador: `https://app.mmeia.tech/` (landing), `/panel-demo/inicio`, ícono de la pestaña, `Iniciar sesión`.
4. Reversión manual en cualquier momento: `cd /opt/crea-oficina/app && sudo -u ctoapp git reset --hard <commit-anterior>` y repetir el paso 2 (o restaurar con `recuperar.sh`; los datos no cambian).
5. Entrar como administrador: «Iniciar sesión» → tu correo (debe estar en `PLATFORM_ADMIN_EMAILS` y el correo transaccional configurado) → enlace → `/admin/conversion`.
