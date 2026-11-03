# Visualiza tu Oficina 3D

Vista complementaria (no sustituye al panel): muestra la estructura **real** de la oficina — departamentos como módulos de color, un empleado = una estación con avatar, escritorio y monitor — con la marca de la agencia (nombre, color, logo) en la recepción.

## Dónde aparece
| Lugar | Ruta |
|---|---|
| Fin de la selección de empleados (paso 4 del asistente) y aviso en el paso 3 | `/construir?paso=4` |
| Oficina del cliente (pantalla completa) y tarjeta con miniatura en su panel | `/oficina-3d`, `/oficina` |
| Panel de agencia: tarjeta con miniatura + página con selector de cliente | `/agencia`, `/agencia/oficina-3d` |

En la escena de **agencia** cada módulo es un cliente propio con sus empleados; con `?cliente=<id>` se ve la oficina de ese cliente (pasa por `actAs`: un cliente de otra agencia cae a «no encontrada»).

## Cómo funciona
```
BD (empleados, departamentos, conexiones, servicios, automatizaciones)
  └─ server/office3d/index.ts   companyScene / agencyScene  → filtra por empresa/agencia del actor
       └─ layout.ts  buildScene(): FUNCIÓN PURA → OfficeScene (zonas, estaciones, estado, notas)
            ├─ components/office3d/iso.tsx       SVG isométrico (SSR, miniaturas y FALLBACK)
            └─ components/office3d/Scene3D.tsx   React Three Fiber (carga diferida, solo en páginas 3D)
OfficeViewer.tsx: estado de selección, panel de detalle, botones 2D/3D, detección WebGL, barrera de errores
```
- **Datos reales:** cada empleado produce exactamente una estación; nada se inventa. Sin departamentos → solo la recepción y un aviso útil con CTA; departamento sin empleados → módulo vacío. La zona «Automatizaciones / IA» aparece solo si existen automatizaciones y **no cuenta como empleados**.
- **Estado de zona:** *Listo*, *Requiere configuración* (empleados en pausa, conexiones requeridas sin conectar, aprobaciones/fallos en clientes) o *Sin empleados*, con los motivos en el panel.
- **Interacción:** rotar, zoom y mover (OrbitControls, mouse y táctil), «Restablecer cámara». Clic en **empleado** → nombre, función, departamento, skill y versión, estado y accesos *Abrir ficha / Ver skill / Editar*. Clic en **departamento** → empleados, servicios vinculados (de los servicios desplegados), estado de configuración. Todo también es accesible desde la lista lateral (teclado).
- **Ligero:** geometrías simples, `frameloop="demand"` (solo dibuja al interactuar), `dpr` ≤ 1.75, sin texturas, modelos ni fuentes externas (**sin servicios de terceros ni costo**). Three.js (~256 KB gzip) se descarga **solo** en las páginas 3D.
- **Fallback (nunca bloquea la app):** el servidor entrega la vista 2D isométrica (funciona sin JS); el 3D se activa por mejora progresiva si hay WebGL. Sin WebGL o si el 3D falla al crearse → vista 2D interactiva con aviso. La preferencia 2D/3D se recuerda.

## Preparado para la fase 2 (no implementado)
`OfficeScene` ya trae `theme` (registro en `themes.ts`: estilos por agencia/oficinas premium), `rooms` (salas adicionales) y `tour` (recorridos guiados); los renderizadores solo leen la escena, así que añadir estilos, salas, animaciones o recorridos no requiere cambiar datos ni paneles.

## Evidencia y pruebas
Capturas en [`docs/evidencia/office3d/`](evidencia/office3d/) generadas por `scripts/e2e/office3d.cjs` (datos de `seed_office3d.ts`). 14 pruebas unitarias en `tests/office3d.test.ts` (diseño sin solapamientos, conteos exactos, estados, determinismo, aislamiento) + E2E en navegador. Ver [REPORTE_DE_PRUEBAS.md](REPORTE_DE_PRUEBAS.md).

## Limitaciones conocidas
Probado solo en Chromium con WebGL **por software** (SwiftShader) y un perfil de móvil *emulado*; no se probó en GPU real, Safari, Firefox ni dispositivos de gama baja (el rendimiento real puede variar). Las etiquetas (HTML sobre el lienzo) pueden amontonarse en oficinas muy densas o pantallas pequeñas. Sin animaciones ni oclusión de etiquetas. Los avatares son genéricos (no la imagen de nadie).
