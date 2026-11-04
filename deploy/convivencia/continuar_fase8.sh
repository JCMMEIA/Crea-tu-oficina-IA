#!/usr/bin/env bash
# CONTINUAR UNA INSTALACIÓN PARCIAL DESDE LA FASE 8 (HTTPS), sin reinstalar nada y SIN volver a pedir el certificado.
#   Simulacro (predeterminado, solo lee y muestra qué cambiaría):   sudo bash continuar_fase8.sh
#   Aplicar:                                                        sudo bash continuar_fase8.sh --aplicar
#   Revertir al sitio anterior si algo sale mal:                    sudo bash continuar_fase8.sh --revertir
# Opciones: --dominio app.mmeia.tech  --puerto-openclaw 18789  --probar-respaldo (hace y prueba un respaldo si no hay)  --probar-renovacion (simula la renovación con el servidor de PRUEBAS de Let's Encrypt)
# Qué hace al aplicar: valida el certificado existente → copia de seguridad del sitio de Nginx → escribe SOLO el sitio «crea-oficina» (80 con desafío+redirección, 443 con el certificado)
#   → nginx -t → recarga (grácil) → comprueba HTTPS, /api/health, redirección y desafío → compara OpenClaw → revisa respaldos y temporizadores.
#   Si nginx -t falla: restaura el archivo anterior y NO recarga. Si una comprobación posterior falla: restaura y recarga el sitio anterior.
# NUNCA: emite/renueva certificados, reinicia el VPS ni servicios, toca OpenClaw, el firewall, otros sitios de Nginx o el desinstalador.
set -uo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; cd /; . "$AQUI/lib.sh"
DOM="app.mmeia.tech"; REVERTIR=0; PROBAR_RESP=0; PROBAR_RENOV=0
NGINX_SITES="${CREA_NGINX_SITES:-/etc/nginx/sites-available}"; NGINX_ENABLED="${CREA_NGINX_ENABLED:-/etc/nginx/sites-enabled}"; NGINX_CONFD="${CREA_NGINX_CONFD:-/etc/nginx/conf.d}"
LE_DIR="${CREA_LE_DIR:-/etc/letsencrypt}"; ACME_ROOT="${CREA_ACME_ROOT:-/var/www/crea-acme}"; BACKUPS="${CREA_BACKUPS:-$BACKUPS}"; STATE="${CREA_STATE:-$STATE}"; MANIFEST="$STATE/manifest.txt"
while [ $# -gt 0 ]; do case "$1" in --aplicar) DRY=0;; --revertir) REVERTIR=1; DRY=0;; --dominio) DOM="$2"; shift;; --puerto-openclaw) OPENCLAW_PORT="$2"; shift;; --probar-respaldo) PROBAR_RESP=1;; --probar-renovacion) PROBAR_RENOV=1;; *) die "Opción desconocida: $1";; esac; shift; done
export OPENCLAW_PORT
SITE="$NGINX_SITES/crea-oficina"; LINK="$NGINX_ENABLED/crea-oficina"; LIMITES="$NGINX_CONFD/crea-oficina-limites.conf"
CERT="$LE_DIR/live/$DOM/fullchain.pem"; KEY="$LE_DIR/live/$DOM/privkey.pem"; TS="$(date +%Y%m%d-%H%M%S)"
[ "$(id -u)" = 0 ] || [ -n "${CREA_NGINX_SITES:-}" ] || die "Ejecútalo como root:  sudo bash $0"
BKEY="${CREA_BACKUP_KEY:-/etc/crea-oficina/backup.key}"
FALLOS=0; mal() { bad "$*"; FALLOS=1; }

recargar_si_valido() { nginx -t >/dev/null 2>&1 && systemctl reload nginx; }
restaurar_sitio() { # vuelve al archivo anterior (copia de seguridad $1); si no había archivo, quita el nuevo
  if [ -n "${1:-}" ] && [ -f "$1" ]; then install -m 644 "$1" "$SITE"; else rm -f "$SITE" "$LINK"; fi; }

# ============ --revertir ============
if [ "$REVERTIR" = 1 ]; then
  titulo "Revertir el sitio de Nginx al estado anterior"
  ULT="$(ls -1t "$BACKUPS"/nginx-crea-oficina.*.bak 2>/dev/null | sed -n 1p)"; [ -n "$ULT" ] || die "No hay copia de seguridad en $BACKUPS. Nada que revertir."
  echo "   Copia a restaurar: $ULT"; install -m 644 "$ULT" "$SITE"
  if nginx -t; then systemctl reload nginx && ok "Sitio anterior restaurado y Nginx recargado." || die "No pude recargar Nginx."; else die "nginx -t falla con la copia restaurada: revisa $SITE a mano. Nginx sigue con su configuración activa anterior."; fi
  exit 0
fi
[ "$DRY" = 1 ] && warn "MODO SIMULACRO: solo lectura. Añade --aplicar para ejecutar."

# ============ 0. Revisión (solo lectura) ============
titulo "0. Revisión previa (solo lectura)"
[ -r "$CERT" ] && [ -r "$KEY" ] || die "No encuentro el certificado ($CERT) o su clave. No se emite uno nuevo: revisa el dominio."
openssl x509 -in "$CERT" -noout -checkend 604800 >/dev/null 2>&1 && ok "El certificado vale al menos 7 días más" || die "El certificado está vencido o por vencer en menos de 7 días. (Este script no lo renueva; revisa certbot.)"
echo "   $(openssl x509 -in "$CERT" -noout -enddate)  ·  emisor: $(openssl x509 -in "$CERT" -noout -issuer | sed 's/^issuer= *//')"
openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null | grep -qE "DNS:$DOM(,|$| )" && ok "El certificado cubre $DOM" || die "El certificado NO cubre $DOM."
[ "$(openssl x509 -in "$CERT" -noout -pubkey | openssl sha256)" = "$(openssl pkey -in "$KEY" -pubout | openssl sha256)" ] && ok "La clave privada corresponde al certificado" || die "La clave privada NO corresponde al certificado."
curl -fsS -m 10 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && ok "La aplicación responde en 127.0.0.1:$PORT" || die "La aplicación no responde en 127.0.0.1:$PORT (systemctl status crea-oficina)."
command -v nginx >/dev/null || die "nginx no está instalado."
nginx -t >/dev/null 2>&1 && ok "La configuración actual de Nginx es válida (antes de tocar nada)" || die "Nginx YA tiene una configuración inválida antes de nuestros cambios: no se toca nada. Detalle: nginx -t"
OTRO="$(grep -RlE "server_name[^;]*[[:space:]]$DOM([[:space:]]|;)" "$NGINX_ENABLED" "$NGINX_CONFD" 2>/dev/null | grep -v -e "/crea-oficina$" || true)"
[ -z "$OTRO" ] && ok "Ningún otro sitio de Nginx usa $DOM" || die "Otro archivo de Nginx ya declara $DOM: $OTRO (no se sobrescribe nada ajeno)."
if puerto_ocupado 443; then P443="$(listeners | awk '$1==443{print $3}' | head -1)"; [ "$P443" = "nginx" ] && ok "El puerto 443 ya es de Nginx" || die "El puerto 443 está ocupado por '$P443', no por Nginx."; else ok "El puerto 443 está libre"; fi
if [ -f "$SITE" ]; then grep -q "server_name $DOM" "$SITE" && grep -q "crea-acme" "$SITE" && ok "El sitio existente es el nuestro ($SITE)" || die "$SITE existe pero no parece ser el sitio de Crea tu Oficina IA. No se sobrescribe."; else warn "No existe $SITE (la fase 8 quedó antes de escribirlo): se creará."; fi
# renovación: ¿se renovará solo y recargará Nginx?
RC="$LE_DIR/renewal/$DOM.conf"
if [ -r "$RC" ]; then AUTH="$(grep -m1 '^authenticator' "$RC" | cut -d= -f2- | xargs)"; WR="$(grep -m1 "^$DOM *=" "$RC" | cut -d= -f2- | xargs)"
  [ "$AUTH" = "webroot" ] && [ "$WR" = "$ACME_ROOT" ] && ok "Renovación automática configurada con el desafío HTTP en $ACME_ROOT (coincide con Nginx)" || warn "La renovación usa authenticator='$AUTH' webroot='$WR' (Nginx sirve el desafío desde $ACME_ROOT). Si no coincide, la renovación fallaría en ~60 días. NO se cambia aquí; avísame."
else warn "No veo $RC: la renovación automática no está configurada. No emito nada; avísame."; fi
systemctl is-active --quiet certbot.timer 2>/dev/null && ok "certbot.timer activo (renovación programada)" || warn "certbot.timer no está activo: la renovación automática no correrá."
[ "$DRY" = 0 ] && { for f in "$STATE/openclaw_antes.txt" /root/openclaw_antes.txt; do [ -r "$f" ] && { OCF="$f"; break; }; done; if [ -z "${OCF:-}" ]; then warn "No hay foto «antes» de OpenClaw: tomo una ahora (estado actual, con la instalación parcial)."; OCF="$STATE/openclaw_ahora.txt"; bash "$AQUI/openclaw_check.sh" --guardar "$OCF" >/dev/null || die "No pude fotografiar OpenClaw."; fi; ok "Foto de OpenClaw: $OCF"; }

# ============ 1. Nueva configuración ============
titulo "1. Sitio de Nginx con HTTPS (solo el sitio 'crea-oficina')"
NUEVO="$(mktemp)"; nginx_conf_completa "$DOM" "$PORT" > "$NUEVO"
if [ -f "$SITE" ] && cmp -s "$SITE" "$NUEVO"; then ok "El sitio ya tiene exactamente esta configuración: no hay nada que cambiar."; YA=1; else YA=0
  echo "   Cambios que se harían en $SITE:"; { [ -f "$SITE" ] && diff -u "$SITE" "$NUEVO" || diff -u /dev/null "$NUEVO"; } | sed 's/^/   | /' | head -40; fi
HOOK="$LE_DIR/renewal-hooks/deploy/crea-oficina-nginx-reload.sh"
[ -f "$HOOK" ] && ok "Gancho de renovación ya existe" || echo "   Se añadiría el gancho $HOOK (recarga Nginx tras cada renovación; solo si nginx -t pasa)."
[ -f "$LIMITES" ] && ok "Límite de peticiones ya existe" || echo "   Se crearía $LIMITES (zona crea_ofi)."
[ "$DRY" = 1 ] && { titulo "Fin del simulacro"; echo "   Nada se cambió. Para continuar:  sudo bash $0 --aplicar"; exit 0; }

# ============ 2. Aplicar (con copia, prueba y reversión) ============
titulo "2. Aplicar"
install -d -m 750 "$BACKUPS"; BAK=""
if [ -f "$SITE" ]; then BAK="$BACKUPS/nginx-crea-oficina.$TS.bak"; cp -p "$SITE" "$BAK" && ok "Copia de seguridad: $BAK" || die "No pude hacer la copia de seguridad."; fi
install -d -m 755 "$ACME_ROOT" "$(dirname "$HOOK")"
[ -f "$LIMITES" ] || { echo 'limit_req_zone $binary_remote_addr zone=crea_ofi:10m rate=10r/s;' > "$LIMITES"; chmod 644 "$LIMITES"; ok "Creado $LIMITES"; NUEVO_LIM=1; }
if [ "$YA" = 0 ]; then install -m 644 "$NUEVO" "$SITE.tmp" && mv -f "$SITE.tmp" "$SITE"; fi
[ -e "$LINK" ] || ln -s "$SITE" "$LINK"
if ! nginx -t; then
  bad "nginx -t FALLÓ con la nueva configuración. NO se recarga."; restaurar_sitio "$BAK"; [ "${NUEVO_LIM:-0}" = 1 ] && rm -f "$LIMITES"
  nginx -t >/dev/null 2>&1 && ok "Restaurado el sitio anterior; nginx -t vuelve a pasar. Nginx sigue funcionando como antes." || bad "OJO: nginx -t sigue fallando tras restaurar; revisa a mano. Nginx en ejecución NO se tocó (conserva su configuración activa)."
  exit 1
fi
ok "nginx -t correcto"
[ -f "$HOOK" ] || { printf '#!/bin/sh\n# Recarga Nginx tras renovar un certificado (solo si la configuración es válida).\nnginx -t && systemctl reload nginx\n' > "$HOOK"; chmod 755 "$HOOK"; ok "Creado el gancho de renovación"; anotar archivo "$HOOK"; }
anotar archivo "$SITE"; anotar archivo "$LIMITES"
systemctl reload nginx && ok "Nginx recargado (grácil: no corta conexiones)" || { bad "No pude recargar Nginx."; restaurar_sitio "$BAK"; recargar_si_valido; exit 1; }
sleep 2

# ============ 3. Comprobaciones (si fallan, se revierte) ============
titulo "3. Comprobaciones"
H="$(curl -sS -m 15 --resolve "$DOM:443:127.0.0.1" "https://$DOM/api/health" 2>&1)"
echo "$H" | grep -q '"ok":true' && ok "HTTPS local con el certificado válido: /api/health → $H" || mal "HTTPS local falló: $(echo "$H" | head -2)"
R="$(curl -sS -m 10 -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $DOM" http://127.0.0.1/ 2>&1)"
case "$R" in "301 https://$DOM/"*) ok "HTTP → HTTPS: $R";; *) mal "La redirección HTTP→HTTPS no es la esperada: $R";; esac
TOK="crea-prueba-$TS"; install -d -m 755 "$ACME_ROOT/.well-known/acme-challenge"; echo "$TOK" > "$ACME_ROOT/.well-known/acme-challenge/$TOK"
A="$(curl -sS -m 10 -H "Host: $DOM" "http://127.0.0.1/.well-known/acme-challenge/$TOK" 2>&1)"; rm -f "$ACME_ROOT/.well-known/acme-challenge/$TOK"
[ "$A" = "$TOK" ] && ok "El desafío HTTP de Let's Encrypt sigue sirviéndose por el puerto 80 (sin redirigir)" || mal "El desafío HTTP no se sirve bien (respuesta: $(echo "$A" | head -c 80))"
curl -sSI -m 10 --resolve "$DOM:443:127.0.0.1" "https://$DOM/" 2>/dev/null | grep -qi '^strict-transport-security' && ok "Cabecera HSTS presente" || warn "No veo la cabecera HSTS (la pone la aplicación)."
if [ "$FALLOS" = 1 ]; then
  titulo "REVERSIÓN AUTOMÁTICA"; restaurar_sitio "$BAK"; [ "${NUEVO_LIM:-0}" = 1 ] && rm -f "$LIMITES"
  if recargar_si_valido; then ok "Sitio anterior restaurado y Nginx recargado. Nada más se tocó."; else bad "No pude recargar tras restaurar: revisa a mano (nginx -t)."; fi
  echo "   Copia usada: ${BAK:-(no había sitio anterior; se quitó el nuevo)}"; echo "   Para reintentar tras corregir la causa: sudo bash $0 --aplicar"; exit 1
fi
EXT="$(curl -sS -m 15 "https://$DOM/api/health" 2>&1)"; echo "$EXT" | grep -q '"ok":true' && ok "Desde internet (DNS público): https://$DOM/api/health responde" || warn "Desde este servidor, https://$DOM por la red pública NO responde ($(echo "$EXT" | head -c 100)). Si lo local funciona, lo más probable es el firewall de Hostinger (hPanel) o el de ufw: el puerto 443 debe estar abierto. No lo cambio aquí: ejecuta  bash $AQUI/firewall_proponer.sh"

titulo "4. OpenClaw"
bash "$AQUI/openclaw_check.sh" --comparar "$OCF" || { mal "OpenClaw muestra cambios. Recargar Nginx no puede afectarlo; investiga qué más cambió (la instalación parcial previa, otro proceso)."; }

# ============ 5. Respaldos y temporizadores (solo lectura) ============
titulo "5. Respaldos y temporizadores"
for u in crea-oficina.service; do systemctl is-active --quiet $u && ok "$u activo ($(systemctl is-enabled $u 2>/dev/null))" || mal "$u NO está activo"; done
for t in crea-tick-automatizaciones crea-tick-cola crea-respaldo; do
  if systemctl is-active --quiet $t.timer; then ok "$t.timer activo · próxima ejecución: $(systemctl show -p NextElapseUSecRealtime --value $t.timer 2>/dev/null)"; else mal "$t.timer NO está activo"; fi
  r="$(systemctl show -p Result --value $t.service 2>/dev/null)"; [ -z "$r" ] || [ "$r" = "success" ] && echo "   último resultado de $t.service: ${r:-aún no ha corrido}" || mal "$t.service terminó con resultado «$r» (journalctl -u $t.service -n 20)"
done
NB="$(ls -1 "$BACKUPS"/crea-*.enc 2>/dev/null | wc -l)"
if [ "$NB" -gt 0 ]; then NEW="$(ls -1t "$BACKUPS"/crea-*.enc | sed -n 1p)"; ok "$NB respaldo(s) cifrado(s); el más reciente: $(basename "$NEW") (hace $(( ($(date +%s) - $(stat -c %Y "$NEW")) / 3600 )) h)"
else warn "Todavía no hay respaldos. Haz el primero con:  sudo bash $0 --aplicar --probar-respaldo"; fi
[ -r "$BKEY" ] && ok "Existe la clave de respaldos ($BKEY): guárdala FUERA del servidor" || mal "Falta $BKEY"
[ -f "$STATE/ultima_copia_externa" ] && ok "Hay copia externa registrada: $(cat "$STATE/ultima_copia_externa")" || warn "No hay copia EXTERNA de respaldos todavía (ver docs/CONVIVENCIA_OPENCLAW.md §5)."
if [ "$PROBAR_RESP" = 1 ]; then
  systemctl start crea-respaldo.service && ok "Respaldo ejecutado" || mal "El respaldo falló (journalctl -u crea-respaldo -n 30)"
  NEW="$(ls -1t "$BACKUPS"/crea-*.enc 2>/dev/null | sed -n 1p)"; [ -n "$NEW" ] && { bash "$AQUI/recuperar.sh" --probar "$NEW" || mal "La prueba de restauración falló"; }
fi
if [ "$PROBAR_RENOV" = 1 ]; then titulo "Simulación de renovación (servidor de PRUEBAS de Let's Encrypt; no emite ni cambia el certificado real)"; certbot renew --cert-name "$DOM" --dry-run || mal "La simulación de renovación falló (el desafío HTTP no llega o el firewall bloquea el puerto 80)"; fi

titulo "Resultado"
if [ "$FALLOS" = 0 ]; then ok "HTTPS FUNCIONANDO en https://$DOM · OpenClaw intacto."; echo "   Siguiente: crea tu cuenta en https://$DOM/registro con tu correo de operador y abre /admin."; exit 0
else bad "Hay comprobaciones fallidas (arriba). El sitio HTTPS quedó configurado, pero revisa las ❌. Para volver al sitio anterior:  sudo bash $0 --revertir"; exit 1; fi
