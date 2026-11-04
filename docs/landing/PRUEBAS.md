# Pruebas y evidencia

## Ejecutadas en esta rama
| Prueba | Resultado |
|---|---|
| `npm run check` (tsc, todas las pruebas, secretos) | 263 pruebas pasan; sin patrones de secretos |
| `tests/landing.test.ts` (7) + `tests/design.test.ts` | contenido honesto: 8 tareas con empleados reales, 41 empleados, funciones no construidas sin estado «disponible», sin cifras/testimonios inventados, planes sin precios mientras no estén aprobados, anclas del menú y orden de secciones, título y botones pedidos, sin emojis |
| `scripts/e2e/landing_premium.cjs` (navegador real) | **92/92**: título y subtítulo exactos, botones, 6 anclas, orden de las 15 secciones, directorio (12 → 41, filtros por departamento, «Conocer empleado» abre la ficha), Cerebro con capturas cargadas, 8 tareas y demostración rotulada, diagramas interactivos, resultados rotulados, 7 pasos, comparación, planes sin precios, evento de selección de plan, lista de espera, 9 preguntas, enlaces del footer, sin emojis ni promesas, **login** (enlace por correo), favicon, rendimiento (LCP/CLS), demo del panel, móvil (menú, botones táctiles, sin scroll horizontal), rutas protegidas, 0 errores de consola |
| Accesibilidad (axe-core, WCAG 2.1 AA) | 0 hallazgos graves o críticos en landing escritorio, landing móvil, login y demo |
| `scripts/e2e/compra_directa.sh` (PostgreSQL real, Stripe/Resend/IA **simulados**) | **64/64**: la compra, la oficina automática, el acceso por correo y el aislamiento siguen funcionando con la landing nueva (con la tienda abierta, los botones «Crear mi oficina IA» llevan al pago) |
| Capturas | `capturas/`: 16 secciones × escritorio y celular; `evidencia/capturas/`: menú móvil y login |

## Lo que NO se verificó
- **Pagos reales:** ninguno; Stripe se probó solo con el servidor simulado. No se activó ningún cobro.
- **Correo real y IA real:** no se tocaron ni se probaron aquí (ver PR #2 y PR #3).
- **Retratos:** no existen todavía (monogramas).
- **Vilma.AI:** no se pudo abrir; no hay comparación visual directa (ver INVESTIGACION.md).
- **Planes comprables:** Starter/Pro/Business no están conectados al cobro (ver AUDITORIA_SUSCRIPCION.md).
- **Medición real en Meta:** la medición interna funciona; píxel y API de Conversiones siguen sin probarse contra Meta.

## Cómo repetirlo
```
npm run build && PORT=3115 npx next start -p 3115 &
AXE=/ruta/axe.min.js NODE_PATH=$(npm root -g) node scripts/e2e/landing_premium.cjs http://127.0.0.1:3115 docs/landing/evidencia
NODE_PATH=$(npm root -g) node scripts/e2e/landing_capturas.cjs http://127.0.0.1:3115 docs/landing/capturas
E2E_PGURL=postgres://usuario:clave@127.0.0.1:5544 bash scripts/e2e/compra_directa.sh /tmp/compra
```
