# ¿Cabe Crea tu Oficina IA en un VPS KVM 2 (2 vCPU, 8 GB, Ubuntu 24.04)? — verificación

Fecha: 2026-11-03. **No se contrató ni desplegó nada.** Medido en un entorno de pruebas de **4 núcleos y 16 GB** (no en Hostinger), con PostgreSQL 16 real y la aplicación compilada en producción. Las especificaciones de KVM 2 salen de fuentes de terceros (2 vCPU, 8 GB, 100 GB): **confírmalas al comprar**.

## Mediciones
| Qué | Resultado |
|---|---|
| Compilar (`npm run build`) | pico **2,2 GB** de RAM, 23 s (en 2 vCPU esperar ~1 minuto) |
| Aplicación en reposo | **207 MB** |
| Tras recorrido completo en navegador (landing, demo, registro, panel, asistente…) | 262 MB |
| Tras 600 peticiones con 30 simultáneas | **322 MB**; 0 errores; mediana 163 ms, p95 216 ms |
| PostgreSQL (7 procesos) | ~100 MB |
| Base de datos tras el recorrido | pocos MB |
| Total en uso con carga | **menos de 1 GB de 8 GB** |

Cola de trabajos: reclama con bloqueo seguro (`SKIP LOCKED`) y recupera trabajos trabados a los 5 min; las automatizaciones adelantan su próxima hora antes de ejecutar (un cron solapado no duplica). Los avisos de Telegram son esperas de red, casi sin memoria. Tareas con IA: pasan su tiempo esperando a Anthropic, no usando CPU.

## Veredicto
**Sí, KVM 2 sobra para el piloto privado** (decenas de usuarios, pocos clientes, tareas ocasionales). El cuello de botella será el costo y la latencia de la IA, no el servidor. Si algún día hay cientos de usuarios simultáneos habrá que separar la base de datos o subir de plan, pero eso está lejos.

## Instalador (`deploy/instalar.sh`): ¿preparado?
**Sí para ese entorno, con correcciones que acabo de hacer** (encontradas al revisarlo y probar sus piezas):
1. **Error real:** una lista de correos con espacios (`a@x.com, b@x.com`) rompía los respaldos, las tareas programadas y la compilación. Ahora el instalador la limpia y valida, y `tick.sh`/`respaldo.sh` ya no ejecutan el archivo de claves.
2. **Error probable:** el servicio arrancaba con `npx`, que necesita escribir en una carpeta que la protección del servicio oculta. Ahora arranca con `node` directo y límite de memoria.
3. **Añadido:** 2 GB de memoria de respaldo (swap), `fail2ban` contra intentos de entrar por SSH y límite de peticiones por IP en Nginx.
4. **Probado aquí:** sintaxis de los 4 scripts, tareas programadas contra la aplicación real (con y sin clave), respaldo e integridad del archivo, estructura de la unidad de servicio (`systemd-analyze`).
**NO probado:** ejecución completa en Ubuntu 24.04 real (instalación de paquetes, Let's Encrypt, Nginx — no pude instalar Nginx aquí), ni arranque tras reiniciar el servidor. **El primer despliegue sigue siendo la prueba real.**
