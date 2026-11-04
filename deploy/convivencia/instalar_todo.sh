#!/usr/bin/env bash
# INSTALACIÓN GUIADA EN UN SOLO COMANDO (modo convivencia con OpenClaw).
#   sudo bash instalar_todo.sh                      # pregunta tu correo, prueba todo, simula, y al final te pide UNA autorización
#   sudo bash instalar_todo.sh --solo-simulacro     # hace todo menos aplicar (no cambia nada)
# Opciones: --dominio app.mmeia.tech  --correo tu@correo  --permitidos a@x.com,b@x.com  --puerto-openclaw 18789
# Hace, en orden: revisión de requisitos → pruebas → foto de OpenClaw → simulacro → TU autorización (una sola) → instalación → comparación final de OpenClaw.
# Si cualquier comprobación de OpenClaw falla, SE DETIENE. No reinicia el servidor. No toca el firewall. Todo queda en un registro en /root.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"
DOM="app.mmeia.tech"; CORREO=""; PERMITIDOS=""; SOLO_SIM=0
while [ $# -gt 0 ]; do case "$1" in --dominio) DOM="$2"; shift;; --correo) CORREO="$2"; shift;; --permitidos) PERMITIDOS="$2"; shift;; --puerto-openclaw) OPENCLAW_PORT="$2"; shift;; --solo-simulacro) SOLO_SIM=1;; *) die "Opción desconocida: $1";; esac; shift; done
export OPENCLAW_PORT
[ "$(id -u)" = 0 ] || die "Ejecútalo como root:  sudo bash $0"
LOG="/root/crea-instalacion-$(date +%Y%m%d-%H%M%S).log"; exec > >(tee -a "$LOG") 2>&1
echo "Registro completo: $LOG (no contiene claves: el instalador las oculta)"
if [ -z "$CORREO" ]; then read -r -p "Tu correo (para el certificado HTTPS, el panel de operador y la política de privacidad): " CORREO; fi
CORREO="$(echo "$CORREO" | tr -d '[:space:]')"; [[ "$CORREO" =~ ^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+$ ]] || die "Correo no válido."
PERMITIDOS="${PERMITIDOS:-$CORREO}"
ARGS=(--dominio "$DOM" --correo-cert "$CORREO" --correo-admin "$CORREO" --permitidos "$PERMITIDOS" --contacto "$CORREO")

titulo "A. Buscar OpenClaw"
if ! puerto_ocupado "$OPENCLAW_PORT"; then
  C="$(listeners | awk 'tolower($3) ~ /claw/ {print $1; exit}')"
  if [ -n "$C" ]; then OPENCLAW_PORT="$C"; export OPENCLAW_PORT; ok "OpenClaw encontrado por su nombre en el puerto $C"
  else bad "No encuentro OpenClaw en el puerto $OPENCLAW_PORT. Puertos en uso:"; listeners | sed 's/^/   /'; die "Vuelve a ejecutar con  --puerto-openclaw N  (el puerto de OpenClaw)."; fi
else ok "OpenClaw (o algo) escucha en el puerto $OPENCLAW_PORT"; fi
IPS="$(hostname -I 2>/dev/null)"; R="$(getent hosts "$DOM" | awk '{print $1}' | head -1)"
[ -n "$R" ] && { echo "$IPS" | grep -qw "$R" && ok "$DOM apunta a este servidor ($R)" || warn "$DOM apunta a $R, que no coincide con las IP del servidor ($IPS). Si es normal (red intermedia), ignora; si no, el certificado fallará."; } || warn "$DOM no resuelve todavía."

titulo "B. Requisitos (solo lectura)"; bash "$AQUI/requisitos.sh" || true
titulo "C. Pruebas del instalador (no cambian nada)"; bash "$AQUI/pruebas/run_tests.sh" || die "Las pruebas fallaron. No se continúa. Mándame el resultado."
titulo "D. Foto de OpenClaw (solo lectura)"; bash "$AQUI/openclaw_check.sh" --guardar /root/openclaw_antes.txt || die "No pude tomar la foto de OpenClaw."
titulo "E. SIMULACRO de la instalación (no cambia nada)"
SIM="$(bash "$AQUI/instalar_convivencia.sh" "${ARGS[@]}" 2>&1)" || { echo "$SIM" | tail -25; die "El simulacro falló."; }
echo "$SIM" | grep -E "════|✅|⚠️|❌" | sed 's/^/   /'
[ "$SOLO_SIM" = 1 ] && { ok "Simulacro terminado. Nada se cambió. Detalle completo en $LOG"; exit 0; }

titulo "F. AUTORIZACIÓN ÚNICA"
cat <<EOT
Si escribes AUTORIZO se hará, en este servidor, TODO lo siguiente (y nada más):
  1. Instalar los paquetes que falten (solo agregar; se detiene si apt quisiera actualizar o quitar algo existente).
  2. Crear el usuario 'ctoapp' y las carpetas /opt/crea-oficina, /etc/crea-oficina, /var/backups/crea-oficina.
  3. Descargar Node v22.23.4 privado (verificado por huella SHA-256).
  4. Crear la base PostgreSQL y el rol exclusivos (y reiniciar PostgreSQL solo si no hay bases ajenas).
  5. Crear claves nuevas y aleatorias (cobros APAGADOS; sin clave de Claude todavía).
  6. Compilar con tope de 3 GB de RAM y 1 núcleo.
  7. Crear y arrancar el servicio crea-oficina en 127.0.0.1:3100 y 3 temporizadores (automatizaciones, cola, respaldo).
  8. Agregar el sitio de Nginx para $DOM, pedir el certificado HTTPS (Let's Encrypt, con tu correo $CORREO) y recargar Nginx.
  9. Hacer un respaldo cifrado y probarlo restaurando en una base temporal.
  Después de CADA paso se comprueba que OpenClaw sigue igual; si cambia, se detiene.
NO se hará: reiniciar el servidor, tocar OpenClaw, cambiar el firewall, cambiar el Node del sistema, activar cobros, gastar dinero.
EOT
read -r -p "Escribe AUTORIZO para empezar (cualquier otra cosa cancela): " A; [ "$A" = "AUTORIZO" ] || { echo "Cancelado. No se cambió nada."; exit 0; }

titulo "G. INSTALANDO"
bash "$AQUI/instalar_convivencia.sh" --aplicar --sin-preguntas "${ARGS[@]}" || { bad "La instalación se detuvo. Lo creado hasta aquí está en /var/lib/crea-oficina/manifest.txt. Para deshacerlo: bash $AQUI/desinstalar_convivencia.sh --aplicar"; exit 1; }
titulo "H. Comprobación final de OpenClaw"; bash "$AQUI/openclaw_check.sh" --comparar /root/openclaw_antes.txt || exit 1
titulo "LISTO"
cat <<EOT
✅ https://$DOM está en línea (registro cerrado a: $PERMITIDOS).
Lo que sigue (tuyo, nada se hace solo):
  1. Abre https://$DOM/registro y crea tu cuenta con $CORREO; luego entra a https://$DOM/admin.
  2. GUARDA la clave de respaldos FUERA del servidor. Desde tu computadora:  scp root@IP-DEL-VPS:/etc/crea-oficina/backup.key .
     (sin ella los respaldos cifrados no se pueden abrir)
  3. Firewall: bash $AQUI/firewall_proponer.sh  (solo propone; confirma también que 80 y 443 estén abiertos en hPanel).
  4. Claude real: cuando tengas la clave de Anthropic, avísame y te doy los 3 pasos.
  Registro de esta instalación: $LOG
EOT
