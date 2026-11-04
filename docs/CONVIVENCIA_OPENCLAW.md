# Instalar Crea tu Oficina IA en el mismo VPS que OpenClaw (modo convivencia)

Estado: **preparado y probado en un entorno de pruebas; NO ejecutado en tu VPS.** No se cambió nada en el servidor. Datos de partida (los que me diste): KVM 2 · Ubuntu 24.04.5 · 2 vCPU · 7,8 GB (6,8 disponibles) · 93 GB libres · Node v24.22.1 · sin Docker · OpenClaw *probablemente* en el puerto 18789 · Monarx en 65529 · 3100 libre · Nginx/PostgreSQL inactivos · pide reinicio.

## 1. Auditoría del instalador actual (`deploy/instalar.sh`): NO usar aquí
| Qué hace | Riesgo para OpenClaw |
|---|---|
| `rm sites-enabled/default` de Nginx | puede dejar sin sitio a lo que ya use Nginx |
| `ufw --force enable` (solo SSH/80/443) | puede cortar el acceso a cualquier puerto de OpenClaw expuesto, y ya no dejaría ver qué regla tenía |
| Instala Node 22 global si el del sistema es menor | **no se activaría** (tienes v24), pero la aplicación solo se probó en Node 22: con v24 sería un riesgo sin probar |
| Puerto 3000 | puede chocar |
| `apt install` + `fail2ban` + swap | cambia el sistema; `needrestart` podría reiniciar servicios |
| `certbot --nginx` | edita configuración de Nginx |
Ya lleva un aviso en la cabecera para que nadie lo use en este VPS.

## 2. Qué es el modo convivencia (`deploy/convivencia/`)
| Pedido | Cómo se cumple |
|---|---|
| Puerto 3100 | solo `127.0.0.1:3100`; el instalador se niega si 80, 443 o 3100 están ocupados |
| No tocar Node global | Node **v22.23.4 privado** (el probado) en `/opt/crea-oficina/node`, verificado por huella SHA-256 |
| No borrar Nginx | solo AGREGA `sites-available/crea-oficina` + un archivo de límites; comprueba `nginx -t` antes y después; el certificado se pide por *webroot* (Certbot no edita Nginx) |
| Firewall | **no lo toca**; `firewall_proponer.sh` solo muestra qué reglas faltan para que las autorices una por una |
| No reiniciar el VPS | no hay `reboot`; `needrestart` en modo «solo listar» |
| No tocar OpenClaw | nada de `stop/restart` fuera de unidades `crea-*`; `apt` simulado primero: se detiene si actualizaría o quitaría paquetes existentes |
| Usuario y carpeta propios | usuario `ctoapp` (sin consola), `/opt/crea-oficina`, `/etc/crea-oficina` |
| PostgreSQL exclusivo | rol `crea_oficina_app` sin privilegios especiales + base `crea_oficina` cerrada al resto (`REVOKE … FROM PUBLIC`); contraseña aleatoria solo en el archivo de configuración |
| HTTPS en subdominio | `--dominio app.tudominio.com` |
| Límites de memoria | ver §4 |
| Respaldos | cifrados AES-256 + verificación inmediata + 14 locales + copia externa (§5) |
| Pruebas de OpenClaw | `openclaw_check.sh` guarda una «foto» antes y compara después de **cada paso**; si algo cambia, el instalador se detiene |
| Reversión | `desinstalar_convivencia.sh` (§6) |

## 3. Servicios: ¿qué hace falta de verdad? (`requisitos.sh`, solo lectura)
**Necesarios:** PostgreSQL, Nginx, Certbot, git, curl, xz-utils (solo se instalan los que falten). **No necesarios:** Docker, Node global, fail2ban, ufw, swap. Si 80/443 ya los usa otro servidor web, se detiene y hay que integrar con ese en vez de instalar Nginx.

## 4. Recursos (no ejecutado en tu VPS; cifras medidas en pruebas: app 330 MB, PostgreSQL 100 MB, compilación 2,2 GB de pico)
| Pieza | Tope |
|---|---|
| Aplicación | `MemoryHigh 1 GB`, `MemoryMax 1,5 GB`, sin swap, prioridad menor (`Nice 5`, `OOMScoreAdjust 300`: si falta memoria el sistema sacrifica a **esta** y no a OpenClaw) |
| PostgreSQL | 768 MB |
| Todo lo de Crea tu Oficina IA junto (carpeta `crea-oficina.slice`) | **2,3 GB** de RAM y 1,5 núcleos |
| Compilación (transitoria, ~1 min) | 3 GB, 1 núcleo, prioridad baja; si se pasa muere **solo la compilación** |
Peor caso simultáneo: ~1 GB (sistema+OpenClaw, según tus datos) + 2,3 + 3 ≈ 6,3 GB de 7,8 GB. **Falta saber cuánto CPU/RAM usa OpenClaw en realidad**: el instalador lo registra al inicio.

## 5. Respaldos
- Diario 03:17: `pg_dump` → gzip → **cifrado** → `/var/backups/crea-oficina` (14 copias) → prueba de descifrado inmediata.
- **Clave** `/etc/crea-oficina/backup.key`: sin ella los respaldos no se abren. **Guárdala fuera del servidor** (gestor de contraseñas). El desinstalador NO la borra.
- **Copia externa (requiere tu decisión):** (a) `rclone` a un almacenamiento tuyo (Google Drive, B2, S3…) con `BACKUP_RCLONE_REMOTE=nombre:carpeta` en el archivo de configuración; o (b) desde **tu computadora**, una vez por semana: `scp usuario@IP:/var/backups/crea-oficina/crea-*.enc .` ; y activa las copias semanales del VPS en hPanel. Hoy, sin una de ellas, **no hay copia fuera del servidor** (el script lo avisa).
- **Recuperar:** `recuperar.sh --probar ARCHIVO` (restaura en base temporal y cuenta filas; probado con PostgreSQL real, y con clave equivocada falla) o `--restaurar ARCHIVO` (hace respaldo de seguridad, detiene solo `crea-oficina`, reemplaza la base y comprueba el estado). `--restaurar` **no está probado de punta a punta** (depende de systemd real).

## 6. Plan de reversión
`sudo bash desinstalar_convivencia.sh` (simulacro) → `… --aplicar [--borrar-base] [--quitar-paquetes] [--quitar-certificado]`. Solo borra lo del **manifiesto** (`/var/lib/crea-oficina/manifest.txt`): servicio, temporizadores, sitio de Nginx, usuario, carpetas, y opcionalmente base, certificado y los paquetes que instaló este modo. Antes hace un respaldo final y al terminar compara OpenClaw. Conserva respaldos y clave. Si algo sale mal a mitad del instalador: se detiene solo y lo creado hasta ahí está en el manifiesto.

## 7. Riesgos
1. **Sin ejecutar en un servidor real:** `apt`, Let's Encrypt, Nginx y systemd pueden pedir ajustes. Probado aquí: sintaxis, simulacro completo sin cambios en el sistema, validez de las unidades systemd, detección de reinicio de OpenClaw, respaldo/restauración real con PostgreSQL, y una revisión automática que prohíbe órdenes peligrosas (`ufw`, `reboot`, `kill`, `apt upgrade`, `systemctl` sobre unidades ajenas…) y comprueba que cada `rm` apunta a rutas propias.
2. **Puerto de OpenClaw:** «probablemente 18789»: la foto «antes» lo confirmará; si no escucha ahí, el instalador avisa y no puede vigilarlo.
3. **Monarx** (antimalware de Hostinger) podría marcar procesos nuevos; no lo he podido probar.
4. **Reinicio pendiente:** no lo hago. Antes de reiniciar comprueba que OpenClaw arranca solo (`systemctl is-enabled`), porque al reiniciar nuestros servicios sí arrancan solos.
5. **Un solo servidor:** si cae, caen ambas aplicaciones; la memoria compartida se protege con topes, no con aislamiento total (no hay Docker/VM).
6. **Aislamiento entre apps:** usuarios, carpetas y claves separados; la base solo abre al rol propio; pero ambas corren como procesos del mismo sistema (root puede ver todo).
7. **La compilación usa 1 de 2 núcleos** (~1–2 min): OpenClaw puede notarlo un momento.
8. **Node 24 del sistema no se usa** (la aplicación solo se probó con 22).
9. Pendientes de siempre: Claude real, Stripe real, Telegram real, política de privacidad revisada.

## 7b. Procedimiento recomendado: UN comando (`instalar_todo.sh`)
```bash
cd /root/crea-instalador && git pull && cd deploy/convivencia
sudo bash instalar_todo.sh --solo-simulacro      # 1.ª vez: hace todo MENOS aplicar (no cambia nada)
sudo bash instalar_todo.sh                       # cuando estés conforme: te pide tu correo y UNA autorización («AUTORIZO»)
```
Hace: busca OpenClaw → requisitos → pruebas (si fallan, para) → foto de OpenClaw → simulacro → **una sola autorización** con la lista completa → instalación → comparación final de OpenClaw. Dominio por defecto `app.mmeia.tech`. Todo queda en `/root/crea-instalacion-*.log` (sin claves).

### Causa del fallo `RESULTADO_FINAL=1` (corregido)
La prueba «OpenClaw: sin cambios → INTACTO; tras reinicio → lo detecta» levantaba un servidor falso **en el puerto 18789, que en tu VPS es el de OpenClaw real**. El servidor falso no podía arrancar (puerto ocupado), así que la prueba comparaba a OpenClaw consigo mismo y su «reinicio simulado» nunca ocurría: no detectó el cambio y falló. **OpenClaw no sufrió nada** (reproducido: el proceso simulado conservó su PID). Era un defecto de la prueba, no del instalador. Ahora usa un puerto libre al azar y solo termina el proceso que ella misma creó (por PID); hay otra prueba que prohíbe `pkill`/`killall` y el puerto real en esa parte. Verificado: pasa 13/13 con y sin algo escuchando en 18789, y el proceso simulado de OpenClaw conserva su PID.

### Falso positivo de `apt` («ACTUALIZARÍA paquetes ya instalados»), corregido
**Causa:** la comprobación buscaba cualquier `[` en las líneas `Inst …`. Pero **todas** las líneas de apt (nuevas o no) terminan en `[amd64]`: `Inst nginx (1.24… Ubuntu:24.04/noble-updates [amd64])`. Una actualización real se distingue porque la versión ya instalada va **pegada al nombre**: `Inst libssl3t64 [3.0.13-0ubuntu3.5] (3.0.13-0ubuntu3.6 … [amd64])`. Ahora se decide por el **tercer campo** (`[` = actualización). Además, si apt **no puede simular** (antes se ignoraba en silencio) el instalador ahora se detiene al aplicar. La protección se mantiene: al aplicar, cualquier actualización o remoción de paquetes existentes detiene la instalación y nombra el paquete.
Pruebas (22 en total): 24 paquetes nuevos → nuevos; actualización real → detectada y nombrada; remoción → detectada; la expresión antigua sí fallaba con esos datos; flujo al aplicar **continúa** con paquetes nuevos y **se detiene sin instalar nada** ante actualización, remoción o fallo de apt; el simulacro nunca ejecuta `apt-get install/update`. Además se comprobó por mutación (volviendo a la lógica antigua) que 3 de esas pruebas fallan.

## 7c. Otros defectos corregidos al revisar el modo «aplicar»
`cd /` antes de git/psql (ejecutan como otros usuarios y no pueden leer `/root`); esperar a que PostgreSQL esté listo tras instalarlo; reiniciar PostgreSQL **antes** de arrancar la aplicación; `npm ci --include=dev` (con `NODE_ENV=production` npm omite `tsx`, que usa el preflight; verificado: `npm config get omit` devuelve `dev`); y la aplicación ya no cae si PostgreSQL pierde una conexión inactiva.

## 8. Comandos manuales paso a paso (alternativa a `instalar_todo.sh`)
```bash
# 0) Descargar solo el instalador de convivencia (no instala nada)
git clone --depth 1 https://github.com/JCMMEIA/crea-tu-oficina-ia /root/crea-instalador && cd /root/crea-instalador/deploy/convivencia
# 1) Solo lectura: qué hay y qué haría falta
sudo bash requisitos.sh
# 2) Foto «antes» de OpenClaw (solo lectura)
sudo bash openclaw_check.sh --guardar /root/openclaw_antes.txt
# 3) Pruebas del instalador (no cambian nada)
sudo bash pruebas/run_tests.sh
# 4) SIMULACRO completo (no cambia nada; revisa lo que imprime)
sudo bash instalar_convivencia.sh --dominio app.TUDOMINIO.com --correo-cert TU@CORREO --correo-admin TU@CORREO --permitidos TU@CORREO --contacto TU@CORREO
# 5) SOLO con tu autorización: aplicar (pide escribir SI en cada paso)
sudo bash instalar_convivencia.sh --aplicar --dominio app.TUDOMINIO.com --correo-cert TU@CORREO --correo-admin TU@CORREO --permitidos TU@CORREO --contacto TU@CORREO
# 6) Firewall: solo propuesta
sudo bash firewall_proponer.sh
# 7) Después: comparar OpenClaw
sudo bash openclaw_check.sh --comparar /root/openclaw_antes.txt
```
(Si el repositorio ya no es público, clónalo con tu acceso. Correos sin espacios. Antes del paso 5, el DNS de `app.TUDOMINIO.com` debe apuntar a la IP del VPS.)

## 9. Acciones que requieren TU autorización (cada una por separado)
1. Ejecutar cualquier cosa en el VPS (paso 0 en adelante). 2. Instalar `nginx`, `postgresql`, `certbot`, `git`, `curl`, `xz-utils` (se te muestra la lista exacta antes). 3. Crear el usuario `ctoapp` y las carpetas. 4. Descargar Node 22 privado. 5. Crear la base y el rol, y **reiniciar PostgreSQL** (solo si no hay bases ajenas). 6. Crear el archivo de claves. 7. Compilar (consume 1 núcleo ~2 min). 8. Activar servicio y temporizadores. 9. Agregar el sitio de Nginx y pedir el certificado. 10. Cada regla de firewall (la propone `firewall_proponer.sh`; no la aplica). 11. Instalar `rclone` o elegir el destino de copias externas. 12. Reiniciar el VPS (solo tú, más adelante). 13. Desinstalar.
No se gasta dinero: todo el software es gratuito; el dominio/subdominio y el almacenamiento externo, si eliges uno de pago, son decisiones tuyas.
