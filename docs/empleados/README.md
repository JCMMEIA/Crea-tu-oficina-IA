# Identidad de los empleados IA

**Una sola fuente:** `src/features/employees/catalog.ts` (nombre propio, puesto, especialidad, línea descriptiva, rasgos del retrato). Misión, responsabilidades, herramientas y entregables se **leen** de la plantilla real (`src/server/catalog/data.ts`); nada se duplica. La lógica de ejecución de la IA no se tocó.

- Tarjeta del directorio: `components/EmployeeCard.tsx` → ficha: `components/EmployeeProfile.tsx` (`/agregar-empleado/[clave]`, `/agencia/contratar/[clave]`, demo en `/panel-demo/empleados/[clave]`).
- Empleado contratado: `/empleados/[id]` muestra foto, nombre, puesto, estado y el formulario «Personalizar nombre y foto» (cada cliente cambia el suyo; aislado por oficina; PNG/JPG/WebP ≤150 KB, verificado por firma de archivo).
- **Tres estados distintos** (`readiness.ts`): *Configurado* (activo) → *Conectado* (apps obligatorias realmente conectadas) → *Operativo* (los dos anteriores **y** la IA del servidor verificada). Nunca se muestra «operativo» sin evidencia.
- Cada imagen se rotula «Empleado IA · imagen ilustrativa». No se usan fotos de personas reales.

## Retratos
Estado: **sin retratos generados todavía** (0/41): se muestra un monograma. Generarlos consume créditos de un servicio de imágenes y requiere autorización de José. Proceso: `PROMPTS.md` → generar → `python3 scripts/employees/importar_fotos.py CARPETA` (WebP 512×512) → `--estado` para ver faltantes. Lista completa: `CATALOGO.md`.
