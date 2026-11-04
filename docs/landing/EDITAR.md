# Cómo editar la landing

Todo el contenido vive en `src/features/funnel/config/`:
| Qué | Archivo |
|---|---|
| Titulares, subtítulo, problemas, pasos, Cerebro, confianza, preguntas frecuentes, menú | `content.ts` |
| **Qué está disponible / en revisión / próximamente** (etiquetas en toda la página) | `disponibilidad.ts` |
| 8 tareas y sus ejemplos | `tareas.ts` |
| Diagramas de colaboración | `workflows.ts` |
| Comparación con un chat de IA | `comparacion.ts` |
| Los dos caminos, el servicio secundario y las páginas /afiliados y /servicio-gestionado | `caminos.ts` |
| Planes Starter/Pro/Business: precios, límites, filas | `planes.ts` (`PLANES_APROBADOS`) |
| Testimonios reales | `src/content/testimonials.ts` (vacío = no se muestra nada inventado) |
| Empleados (nombre, puesto, especialidad) | `src/features/employees/catalog.ts` |
| Retratos | `public/employees/<clave>.webp` (ver `docs/empleados/`) |
| Capturas | `public/landing/` (`scripts/landing/capturas.sh` regenera las del panel) |
| Estilos | `funnel.css` |

- **Publicar planes:** llena `precioMxn` y `valores`, pon `PLANES_APROBADOS = true`. Una prueba impide publicar números mientras no estén aprobados.
- **Cuando se fusione el PR #3:** cambia `cerebro`, `tareasGuiadas`, `resultados` y `consumo` a `"disponible"` en `disponibilidad.ts` (tras verificar con la IA real) y reemplaza las capturas si cambia la interfaz.
- **Videos:** hoy no hay; agrégalos como componente nuevo en `components/` con `<video controls preload="none" poster=…>` y súbelo a `public/`.
- **Eventos de medición:** `tracking/events.ts` (visita, `cta_click` con `plan-<nivel>`, `empleado-conocer`, `tarea-explorada`, `comprar-*`); la compra confirmada y la oficina activada salen del servidor (`/admin/conversion`).
- Después de editar: `npm run check` y `node scripts/e2e/landing_premium.cjs`.
