#!/usr/bin/env bash
# SOLO LEE. Dice qué hace falta de verdad, qué ya existe y qué chocaría. No instala ni cambia nada.
set -uo pipefail; . "$(dirname "$0")/lib.sh"
titulo "Sistema"; . /etc/os-release; echo "$PRETTY_NAME · $(nproc) vCPU · RAM libre $(free -m | awk '/Mem:/{print $7}') MB de $(free -m | awk '/Mem:/{print $2}') MB · disco libre $(df -BG --output=avail / | tail -1 | tr -d ' ')"
[ -f /var/run/reboot-required ] && warn "El sistema pide reinicio (/var/run/reboot-required). Este modo NO reinicia. Reinicia tú, en una ventana de mantenimiento, DESPUÉS de comprobar que OpenClaw arranca solo al encender."
titulo "Qué necesita Crea tu Oficina IA y qué hay"
need() { # nombre comando motivo
  if command -v "$2" >/dev/null 2>&1; then ok "$1: ya instalado ($(command -v "$2")) → se reutiliza"; else warn "$1: FALTA → $3"; fi; }
need "PostgreSQL" psql "NECESARIO (la aplicación guarda todo ahí). Se instalaría 'postgresql'."
systemctl is-active --quiet postgresql 2>/dev/null && ok "PostgreSQL ya está activo: se agregaría una base y un usuario NUEVOS, sin tocar los existentes" || echo "   (PostgreSQL no está activo)"
need "Nginx" nginx "NECESARIO para HTTPS con un subdominio propio. Se instalaría 'nginx' y se AGREGARÍA un sitio nuevo; no se borra ninguno."
need "Certbot (certificado HTTPS)" certbot "NECESARIO para HTTPS. Se instalaría 'certbot' (sin plugins que editen Nginx)."
need "git" git "NECESARIO para bajar el código."
need "curl" curl "NECESARIO."
need "xz" xz "NECESARIO para descomprimir Node (se instalaría 'xz-utils')."
command -v openssl >/dev/null && ok "openssl (cifrado de respaldos): ya instalado"
echo "   Node.js del sistema: $(node -v 2>/dev/null || echo ninguno) → NO se usa ni se modifica. La aplicación usa su propio Node $NODE_VER (el probado) en $NODE_DIR."
echo "   Docker: $(command -v docker >/dev/null && echo instalado || echo 'no instalado') → no hace falta."
echo "   NO se instalan: fail2ban, ufw, swap, cambios de Node global (opcionales; cada uno requiere tu autorización aparte)."
titulo "Puertos"
for p in 80 443 5432 "$PORT" "$OPENCLAW_PORT"; do
  r="$(listeners | awk -v p="$p" '$1==p{print $3" (pid "$2")"}' | head -1)"; [ -n "$r" ] && echo "   puerto $p: OCUPADO por $r" || echo "   puerto $p: libre"
done
for p in 80 443 "$PORT"; do puerto_ocupado "$p" && warn "El puerto $p ya está ocupado: el instalador se detendrá (no compite por puertos)."; done
titulo "Nombres que el instalador va a usar (si ya existen, se detiene)"
id "$APP_USER" >/dev/null 2>&1 && bad "usuario $APP_USER YA existe" || ok "usuario $APP_USER libre"
for f in "$BASE" "$ETC" /etc/nginx/sites-available/crea-oficina /etc/systemd/system/$UNIT.service; do [ -e "$f" ] && bad "$f YA existe" || ok "$f libre"; done
titulo "Firewall (solo lectura)"; command -v ufw >/dev/null && ufw status 2>/dev/null | head -8 || echo "   ufw no instalado"
echo "   Recuerda: Hostinger tiene además un firewall EXTERNO en hPanel; ahí 80 y 443 deben estar permitidos."
