#!/usr/bin/env bash
# Pruebas del modo convivencia. NO cambian el sistema (el instalador corre en SIMULACRO). Uso:  bash pruebas/run_tests.sh
# Opcional: TEST_PG_ADMIN="psql -h 127.0.0.1 -p 5544 -U postgres" (con PGPASSWORD) para la prueba real de respaldo/restauración.
set -uo pipefail; D="$(cd "$(dirname "$0")/.." && pwd)"; cd "$D"; R=0; N=0
instalado() { [ -e /opt/crea-oficina ] || [ -e /etc/crea-oficina ] || id ctoapp >/dev/null 2>&1; }
t() { N=$((N+1)); if "$@"; then echo "✓ $T"; else echo "✗ $T"; R=1; fi; }
T="sintaxis de todos los scripts"; s1() { for f in *.sh pruebas/*.sh; do bash -n "$f" || return 1; done; }; t s1
T="el instalador NO contiene órdenes peligrosas para OpenClaw"
s2() { local bad=0 pat
  for pat in 'ufw +(enable|reset|default|allow|deny|delete|disable)' '--force enable' '\b(reboot|shutdown|poweroff|halt)\b' 'apt(-get)? +(upgrade|dist-upgrade|full-upgrade)' 'npm +(i|install) +(-g|--global)' 'nodesource|setup_[0-9]+\.x' '\b(pkill|killall)\b' '\bkill +-' 'certbot +--nginx' 'sites-enabled/default' 'fail2ban|fallocate|mkswap|swapon'; do
    if grep -nE -- "$pat" instalar_convivencia.sh desinstalar_convivencia.sh continuar_fase8.sh respaldo.sh recuperar.sh tick.sh | grep -vE '^\S+:[0-9]+:\s*#|echo|warn|bad|die|NO se|no se|NO |No ' >/dev/null; then echo "   patrón peligroso: $pat"; grep -nE -- "$pat" *.sh | head -3; bad=1; fi; done
  # systemctl restart/stop/disable/kill/mask: solo sobre unidades propias o PostgreSQL (guardado por el chequeo de bases ajenas)
  while read -r l; do echo "$l" | grep -qE 'crea-|\$u"|\$UNIT|\$\{UNIT\}|postgresql' || { echo "   systemctl sobre unidad no propia: $l"; bad=1; }; done < <(grep -hE 'systemctl +(restart|stop|disable|kill|mask)' instalar_convivencia.sh desinstalar_convivencia.sh continuar_fase8.sh recuperar.sh | grep -vE '^\s*#')
  return $bad; }; t s2
T="todo 'rm' del instalador/desinstalador apunta solo a rutas propias"
s3() { local bad=0; while read -r l; do echo "$l" | grep -qE 'crea-oficina|crea_oficina|\$APP_DIR|\$NODE_DIR|\$HOME_DIR|\$valor|\$T"|/var/www/crea-acme|\$BASE' || { echo "   rm sospechoso: $l"; bad=1; }; done < <(grep -hE '\brm +(-[rf]+ +)?' instalar_convivencia.sh desinstalar_convivencia.sh | grep -vE '^\s*#|echo'); return $bad; }; t s3
T="el instalador no sobrescribe: se niega si ya existen usuario/carpetas/archivos"; s4() { grep -q 'ya existe: no se sobrescribe' instalar_convivencia.sh && grep -q 'El usuario $APP_USER ya existe' instalar_convivencia.sh; }; t s4
T="usa puerto 3100 solo local y Node privado verificado por huella"; s5() { grep -q 'PORT=3100' lib.sh && grep -q '127.0.0.1 -p \$PORT' instalar_convivencia.sh && grep -q 'sha256sum -c' instalar_convivencia.sh && ! grep -qE 'listen +\$PORT|0\.0\.0\.0' instalar_convivencia.sh; }; t s5
T="OpenClaw: sin cambios → INTACTO; tras reinicio → lo detecta (con un servidor de prueba en un puerto LIBRE propio)"
# CAUSA DEL FALLO ANTERIOR: esta prueba usaba el puerto 18789, que en un VPS real es el de OpenClaw. El servidor de prueba no podía arrancar,
# se comparaba a OpenClaw consigo mismo y «el reinicio» nunca ocurría. Ahora usa un puerto libre al azar y SOLO mata el proceso que ella misma creó (por PID).
s6() { local P pid W=/var/tmp/cvtest; mkdir -p $W
  P="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')"; export OPENCLAW_PORT="$P"
  levantar() { python3 -m http.server "$P" --bind 127.0.0.1 >/dev/null 2>&1 & pid=$!; local i; for i in $(seq 1 50); do (exec 3<>/dev/tcp/127.0.0.1/$P) 2>/dev/null && return 0; sleep 0.1; done; return 1; }
  bajar() { kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; sleep 0.3; }
  levantar || return 1
  bash openclaw_check.sh --guardar $W/a.txt >/dev/null || { bajar; return 1; }
  bash openclaw_check.sh --comparar $W/a.txt >/dev/null || { bajar; return 1; }
  bajar; levantar || return 1
  if bash openclaw_check.sh --comparar $W/a.txt >/dev/null; then bajar; return 1; fi
  bajar; unset OPENCLAW_PORT; return 0; }; t s6
T="esta batería nunca usa el puerto real de OpenClaw ni mata procesos por nombre"
s6b() { ! sed -n '/^s6() {/,/t s6$/p' pruebas/run_tests.sh | grep -qE 'pkill|killall|18789'; }; t s6b
# ---------- apt: distinguir paquetes NUEVOS de ACTUALIZACIONES ----------
FX="$D/pruebas/fixtures"
T="apt: 24 paquetes nuevos (todos con [amd64]) se reconocen como NUEVOS, 0 actualizaciones (el falso positivo que bloqueó la instalación)"
a1() { local r; r="$(. ./lib.sh; apt_analizar < "$FX/solo_nuevos.txt")"; echo "$r" | grep -qx "nuevos=24 actualizados=0 quitados=0" && ! echo "$r" | grep -q ACTUALIZA; }; t a1
T="apt: la expresión ANTIGUA sí daba falso positivo con esos mismos datos (regresión documentada)"; a1b() { [ "$(grep -cE '^Inst .*\[' "$FX/solo_nuevos.txt")" -gt 0 ]; }; t a1b
T="apt: una actualización real (versión instalada entre corchetes tras el nombre) se detecta y se nombra"
a2() { local r; r="$(. ./lib.sh; apt_analizar < "$FX/con_actualizacion.txt")"; echo "$r" | grep -q "actualizados=1" && echo "$r" | grep -qx "ACTUALIZA: libssl3t64"; }; t a2
T="apt: remover paquetes se detecta"; a3() { local r; r="$(. ./lib.sh; apt_analizar < "$FX/con_remocion.txt")"; echo "$r" | grep -q "quitados=1" && echo "$r" | grep -qx "QUITA: libfoo1"; }; t a3
# apt falso en PATH: responde con un archivo de datos al simular y REGISTRA cualquier otra llamada (para comprobar qué se instalaría de verdad)
FAKEBIN="$(mktemp -d)"; cat > "$FAKEBIN/apt-get" <<'FAKE'
#!/usr/bin/env bash
echo "apt-get $*" >> "${FAKE_APT_LOG:?}"
case " $* " in *" -s "*) cat "${FAKE_APT_FIXTURE:?}"; grep -q "^E:" "$FAKE_APT_FIXTURE" && exit 100; exit 0;; esac
exit 0
FAKE
chmod +x "$FAKEBIN/apt-get"
harness() { # fixture modo(DRY 0/1) → ejecuta paquetes_seguros con apt falso; imprime la salida; el código de salida es el del proceso
  FAKE_APT_LOG="$FAKEBIN/log" FAKE_APT_FIXTURE="$FX/$1.txt" PATH="$FAKEBIN:$PATH" bash -c ". ./lib.sh; DRY=$2; paquetes_seguros nginx postgresql certbot"; }
T="APLICAR + solo paquetes nuevos: el flujo CONTINÚA (apt-get install se ejecuta con --no-install-recommends)"
f1() { : > "$FAKEBIN/log"; harness solo_nuevos 0 >/dev/null 2>&1 || return 1; grep -q "^apt-get install -y --no-install-recommends .* nginx postgresql certbot" "$FAKEBIN/log" && grep -q "^apt-get update" "$FAKEBIN/log"; }; t f1
T="APLICAR + actualización de un paquete existente: se DETIENE y NO instala nada"
f2() { : > "$FAKEBIN/log"; if harness con_actualizacion 0 >"$FAKEBIN/out" 2>&1; then return 1; fi; ! grep -q "^apt-get install" "$FAKEBIN/log" && grep -q "ACTUALIZA: libssl3t64" "$FAKEBIN/out"; }; t f2
T="APLICAR + remoción de paquetes: se DETIENE y NO instala nada"; f3() { : > "$FAKEBIN/log"; if harness con_remocion 0 >/dev/null 2>&1; then return 1; fi; ! grep -q "^apt-get install" "$FAKEBIN/log"; }; t f3
T="APLICAR + apt no puede simular: se DETIENE (no instala a ciegas)"; f4() { : > "$FAKEBIN/log"; if harness apt_falla 0 >/dev/null 2>&1; then return 1; fi; ! grep -q "^apt-get install" "$FAKEBIN/log"; }; t f4
T="SIMULACRO: nunca ejecuta apt-get install ni apt-get update (solo simula), ni con actualizaciones"
f5() { : > "$FAKEBIN/log"; harness solo_nuevos 1 >/dev/null 2>&1 && harness con_actualizacion 1 >"$FAKEBIN/out" 2>&1 || return 1; ! grep -qE "^apt-get (install -y|update)" "$FAKEBIN/log" && grep -q "ACTUALIZARÍA" "$FAKEBIN/out"; }; t f5
T="instalador completo en simulacro: con paquetes nuevos no avisa de actualizaciones; con actualización avisa y nombra el paquete"
f6() { instalado && { echo "   (omitida: ya hay una instalación)"; return 0; }; command -v nginx >/dev/null && { echo "   (omitida: nginx ya está instalado aquí, no habría paquetes por instalar)"; return 0; }
  local ARGS="--dominio app.ejemplo.com --correo-cert a@ejemplo.com --correo-admin a@ejemplo.com --permitidos a@ejemplo.com --contacto a@ejemplo.com" o1 o2
  o1="$(FAKE_APT_LOG=$FAKEBIN/log FAKE_APT_FIXTURE=$FX/solo_nuevos.txt PATH="$FAKEBIN:$PATH" bash instalar_convivencia.sh $ARGS 2>&1)" || return 1
  o2="$(FAKE_APT_LOG=$FAKEBIN/log FAKE_APT_FIXTURE=$FX/con_actualizacion.txt PATH="$FAKEBIN:$PATH" bash instalar_convivencia.sh $ARGS 2>&1)" || return 1
  echo "$o1" | grep -q "solo instalaría paquetes NUEVOS" && ! echo "$o1" | grep -q "ACTUALIZARÍA" && echo "$o2" | grep -q "ACTUALIZARÍA" && echo "$o2" | grep -q "ACTUALIZA: libssl3t64"; }; t f6
# ---------- continuar_fase8.sh (HTTPS sobre un certificado ya emitido) con Nginx, systemctl, curl y certbot FALSOS ----------
F8=$(mktemp -d); mkdir -p $F8/bin
cat > $F8/bin/nginx <<'FAKE'
#!/usr/bin/env bash
echo "nginx $*" >> "$F8/log"
if [ "${1:-}" = "-t" ]; then [ -f "$F8/ngx_fail_with_443" ] && grep -q "listen 443" "$CREA_NGINX_SITES/crea-oficina" 2>/dev/null && { echo "nginx: configuration file test failed" >&2; exit 1; }; echo "nginx: configuration file test is successful" >&2; exit 0; fi
FAKE
cat > $F8/bin/systemctl <<'FAKE'
#!/usr/bin/env bash
echo "systemctl $*" >> "$F8/log"
case "$1" in is-active) for n in $FAKE_INACTIVE; do [ "$n" = "${@: -1}" ] && exit 3; done; exit 0;; is-enabled) echo enabled;; show) echo success;; reload|start) exit 0;; esac; exit 0
FAKE
cat > $F8/bin/certbot <<'FAKE'
#!/usr/bin/env bash
echo "certbot $*" >> "$F8/certbot_llamado"; exit 0
FAKE
cat > $F8/bin/curl <<'FAKE'
#!/usr/bin/env bash
url=""; for a in "$@"; do case "$a" in http*) url="$a";; esac; done; res=0; for a in "$@"; do [ "$a" = "--resolve" ] && res=1; done
case "$url" in
  http://127.0.0.1:${OPENCLAW_PORT:-0}/*) exec /usr/bin/curl "$@";;   # la sonda de openclaw_check va al curl REAL
  http://127.0.0.1:3100/api/health) echo '{"ok":true}';;
  https://*/api/health) if [ "$res" = 1 ]; then [ -f "$F8/https_falla" ] && { echo "curl: (35) error de TLS simulado" >&2; exit 35; }; else [ -f "$F8/ext_falla" ] && { echo "curl: (28) timeout" >&2; exit 28; }; fi; echo '{"ok":true}';;
  https://*/) echo "HTTP/2 200"; echo "strict-transport-security: max-age=63072000";;
  http://127.0.0.1/.well-known/acme-challenge/*) f="$CREA_ACME_ROOT/.well-known/acme-challenge/${url##*/}"; [ -f "$f" ] && cat "$f" || echo "404";;
  http://127.0.0.1/) echo -n "301 https://app.ejemplo.com/";;
  *) echo "curl falso: URL no prevista $url" >&2; exit 7;;
esac
FAKE
chmod +x $F8/bin/*
f8setup() { # crea un árbol limpio con un sitio HTTP (estado de la fase 8 interrumpida) y un certificado de prueba válido
  rm -rf $F8/t; mkdir -p $F8/t/{sites,enabled,confd,le/live/app.ejemplo.com,le/renewal,acme,bk,st}; : > $F8/log; rm -f $F8/certbot_llamado $F8/ngx_fail_with_443 $F8/https_falla $F8/ext_falla
  openssl req -x509 -newkey rsa:2048 -nodes -keyout $F8/t/le/live/app.ejemplo.com/privkey.pem -out $F8/t/le/live/app.ejemplo.com/fullchain.pem -days ${1:-60} -subj "/CN=app.ejemplo.com" -addext "subjectAltName=DNS:app.ejemplo.com" >/dev/null 2>&1
  printf 'authenticator = webroot\n[[webroot_map]]\napp.ejemplo.com = %s\n' "$F8/t/acme" > $F8/t/le/renewal/app.ejemplo.com.conf
  printf 'server {\n  listen 80; server_name app.ejemplo.com;\n  location ^~ /.well-known/acme-challenge/ { root /var/www/crea-acme; }\n  location / { return 301 https://$host$request_uri; }\n}\n' > $F8/t/sites/crea-oficina; ln -s $F8/t/sites/crea-oficina $F8/t/enabled/crea-oficina
  echo "clave" > $F8/t/bk/backup.key; touch $F8/t/bk/crea-20260101.sql.gz.enc
  bash openclaw_check.sh --guardar $F8/t/st/openclaw_antes.txt >/dev/null; cp $F8/t/sites/crea-oficina $F8/original; }
f8run() { F8=$F8 CREA_NGINX_SITES=$F8/t/sites CREA_NGINX_ENABLED=$F8/t/enabled CREA_NGINX_CONFD=$F8/t/confd CREA_LE_DIR=$F8/t/le CREA_ACME_ROOT=$F8/t/acme CREA_BACKUPS=$F8/t/bk CREA_STATE=$F8/t/st CREA_BACKUP_KEY=$F8/t/bk/backup.key FAKE_INACTIVE="${FAKE_INACTIVE:-}" PATH="$F8/bin:$PATH" bash continuar_fase8.sh --dominio app.ejemplo.com "$@" 2>&1; }
# «OpenClaw» de prueba en un puerto libre propio
P8="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')"; export OPENCLAW_PORT="$P8"
oc_up() { python3 -m http.server "$P8" --bind 127.0.0.1 >/dev/null 2>&1 & OCPID=$!; local i; for i in $(seq 1 50); do (exec 3<>/dev/tcp/127.0.0.1/$P8) 2>/dev/null && return 0; sleep 0.1; done; return 1; }
oc_down() { kill "$OCPID" 2>/dev/null; wait "$OCPID" 2>/dev/null; sleep 0.3; }
oc_up
T="fase 8, SIMULACRO: no cambia nada (ni archivos ni recarga) y muestra el cambio"
g1() { f8setup; local o; o="$(f8run)" || return 1; cmp -s $F8/t/sites/crea-oficina $F8/original && ! grep -q "reload" $F8/log && echo "$o" | grep -q "listen 443" && [ ! -e $F8/certbot_llamado ] && [ ! -e $F8/t/confd/crea-oficina-limites.conf ]; }; t g1
T="fase 8, APLICAR: HTTPS con el certificado existente, copia previa, nginx -t ANTES de recargar, desafío+redirección, OpenClaw intacto, sin tocar certbot"
g2() { f8setup; local o; o="$(f8run --aplicar)" || { echo "$o" | tail -12; return 1; }
  grep -q "listen 443 ssl" $F8/t/sites/crea-oficina && grep -q "ssl_certificate /etc/letsencrypt/live/app.ejemplo.com/fullchain.pem" $F8/t/sites/crea-oficina && grep -q "acme-challenge" $F8/t/sites/crea-oficina && grep -q "return 301" $F8/t/sites/crea-oficina || return 1
  ls $F8/t/bk/nginx-crea-oficina.*.bak >/dev/null 2>&1 && [ -f $F8/t/confd/crea-oficina-limites.conf ] && [ -f $F8/t/le/renewal-hooks/deploy/crea-oficina-nginx-reload.sh ] || return 1
  [ "$(grep -n '^nginx -t' $F8/log | head -1 | cut -d: -f1)" -lt "$(grep -n 'systemctl reload nginx' $F8/log | head -1 | cut -d: -f1)" ] || return 1
  [ ! -e $F8/certbot_llamado ] && echo "$o" | grep -q "OPENCLAW INTACTO" && echo "$o" | grep -q "HTTPS FUNCIONANDO" && ! grep -qE "systemctl (restart|stop)" $F8/log; }; t g2
T="fase 8, APLICAR dos veces: la segunda no cambia el sitio (idempotente)"
g3() { f8setup; f8run --aplicar >/dev/null || return 1; cp $F8/t/sites/crea-oficina $F8/primera; local o; o="$(f8run --aplicar)" || return 1; cmp -s $F8/t/sites/crea-oficina $F8/primera && echo "$o" | grep -q "nada que cambiar"; }; t g3
T="fase 8: si nginx -t FALLA con la nueva configuración → restaura el archivo anterior byte a byte y NO recarga"
g4() { f8setup; touch $F8/ngx_fail_with_443; if f8run --aplicar >$F8/out; then return 1; fi; cmp -s $F8/t/sites/crea-oficina $F8/original && ! grep -q "systemctl reload" $F8/log && grep -q "NO se recarga" $F8/out; }; t g4
T="fase 8: si HTTPS falla DESPUÉS de recargar → reversión automática (restaura y recarga el sitio anterior)"
g5() { f8setup; touch $F8/https_falla; if f8run --aplicar >$F8/out; then return 1; fi; cmp -s $F8/t/sites/crea-oficina $F8/original && [ "$(grep -c 'systemctl reload nginx' $F8/log)" -ge 2 ] && grep -q "REVERSIÓN AUTOMÁTICA" $F8/out; }; t g5
T="fase 8: certificado por vencer / dominio ajeno / otro sitio con el mismo nombre → se niega SIN cambiar nada"
g6() { f8setup 1; if f8run --aplicar >$F8/o1; then return 1; fi; cmp -s $F8/t/sites/crea-oficina $F8/original && ! grep -q "reload" $F8/log && grep -q "vencido o por vencer" $F8/o1 || return 1
  f8setup; printf 'server { listen 80; server_name app.ejemplo.com; }\n' > $F8/t/enabled/otro.conf; if f8run --aplicar >$F8/o2; then return 1; fi; cmp -s $F8/t/sites/crea-oficina $F8/original && grep -q "Otro archivo de Nginx" $F8/o2; }; t g6
T="fase 8: un sitio ajeno habilitado por enlace simbólico (como en Nginx real) que usa el mismo dominio → se niega"
g6c() { f8setup; mkdir -p $F8/t/otros; printf 'server { listen 80; server_name www.x.com app.ejemplo.com; }\n' > $F8/t/otros/ajeno; ln -s $F8/t/otros/ajeno $F8/t/enabled/ajeno; local o; if o="$(f8run --aplicar)"; then return 1; fi; echo "$o" | grep -q "Otro archivo de Nginx" && cmp -s $F8/t/sites/crea-oficina $F8/original && ! grep -q reload $F8/log; }; t g6c
T="fase 8: el 443 ocupado por otro programa (no Nginx) → se niega sin cambiar nada"
g6b() { f8setup; (exec 3<>/dev/tcp/127.0.0.1/443) 2>/dev/null && { echo "   (omitida: el puerto 443 ya está en uso en este servidor)"; return 0; }; python3 -m http.server 443 --bind 127.0.0.1 >/dev/null 2>&1 & local pid=$! i; for i in $(seq 1 50); do (exec 3<>/dev/tcp/127.0.0.1/443) 2>/dev/null && break; sleep 0.1; done
  local o rc; o="$(f8run --aplicar)"; rc=$?; kill $pid 2>/dev/null; wait $pid 2>/dev/null; [ $rc -ne 0 ] && echo "$o" | grep -q "ocupado por 'python3'" && cmp -s $F8/t/sites/crea-oficina $F8/original && ! grep -q reload $F8/log; }; t g6b
T="fase 8 --revertir: restaura la última copia y recarga"
g7() { f8setup; f8run --aplicar >/dev/null || return 1; local o; o="$(f8run --revertir)" || return 1; cmp -s $F8/t/sites/crea-oficina $F8/original && echo "$o" | grep -q "restaurado"; }; t g7
T="fase 8: si OpenClaw cambia (reinicio) se informa y sale con error, sin tocar OpenClaw"
g8() { f8setup; oc_down; oc_up; local o; o="$(f8run --aplicar)"; local rc=$?; [ $rc -ne 0 ] && echo "$o" | grep -q "OpenClaw muestra cambios"; }; t g8
T="fase 8: temporizador inactivo se reporta como fallo"; g9() { f8setup; bash openclaw_check.sh --guardar $F8/t/st/openclaw_antes.txt >/dev/null; local o; o="$(FAKE_INACTIVE=crea-respaldo.timer f8run --aplicar)"; local rc=$?; [ $rc -ne 0 ] && echo "$o" | grep -q "crea-respaldo.timer NO está activo"; }; t g9
T="continuar_fase8.sh: no emite/renueva certificados (solo 'renew --dry-run' con bandera), no reinicia, no toca firewall/OpenClaw/desinstalador"
g10() { local f=continuar_fase8.sh; ! grep -nE 'certbot +(certonly|--nginx|delete|renew +--force)|certbot +(run|revoke)|--force-renewal' $f | grep -v '^\s*[0-9]*:\s*#' >/dev/null && grep -qE 'certbot renew --cert-name "\$DOM" --dry-run' $f && ! grep -nE '\b(reboot|shutdown)\b|ufw|iptables|desinstalar_convivencia\.sh' $f | grep -vE '^[0-9]+:\s*#|NUNCA|ufw' >/dev/null && ! grep -qE 'systemctl +(restart|stop|disable|kill|mask)' $f; }; t g10
oc_down; rm -rf "$F8"; unset OPENCLAW_PORT
T="simulacro del instalador: termina bien, no cambia nada del sistema"
s7() { instalado && { echo "   (omitida: ya hay una instalación en este servidor; el instalador se niega a sobrescribir, como debe)"; OUT="DATOS DE SIMULACRO DATABASE_URL=postgres://crea_oficina_app:<oculto>@ APP_SECRET=<oculto>"; return 0; };  local antes despues; antes="$(ls /opt /etc /var/lib | md5sum; getent passwd | md5sum)"
  OUT="$(bash instalar_convivencia.sh --dominio app.ejemplo.com --correo-cert a@ejemplo.com --correo-admin a@ejemplo.com --permitidos a@ejemplo.com,b@ejemplo.com --contacto a@ejemplo.com 2>&1)" || { echo "$OUT" | tail -15; return 1; }
  despues="$(ls /opt /etc /var/lib | md5sum; getent passwd | md5sum)"; [ "$antes" = "$despues" ] || return 1
  echo "$OUT" | grep -q 'SIMULACRO' && ! echo "$OUT" | grep -q 'oculto>.*[A-Za-z0-9+/]\{20,\}' && ! [ -e /opt/crea-oficina ] && ! id ctoapp >/dev/null 2>&1; }; t s7
T="simulacro: el archivo de claves se muestra con secretos ocultos"; s8() { echo "$OUT" | grep -q 'DATABASE_URL=postgres://crea_oficina_app:<oculto>@' && echo "$OUT" | grep -q 'APP_SECRET=<oculto>'; }; t s8
T="simulacro: rechaza sin dominio y con correos inválidos"; s9() { ! bash instalar_convivencia.sh --correo-cert a@x.com --correo-admin a@x.com --permitidos a@x.com --contacto a@x.com >/dev/null 2>&1 && ! bash instalar_convivencia.sh --dominio app.x.com --correo-cert 'a b' --correo-admin a@x.com --permitidos a@x.com --contacto a@x.com >/dev/null 2>&1; }; t s9
T="desinstalador sin manifiesto se niega a borrar"; s10() { ! bash desinstalar_convivencia.sh >/dev/null 2>&1; }; t s10
T="unidades de systemd generadas son válidas (límites de memoria incluidos)"
s11() { local U=/var/tmp/cvunits; rm -rf $U; bash instalar_convivencia.sh --dominio app.ejemplo.com --correo-cert a@ejemplo.com --correo-admin a@ejemplo.com --permitidos a@ejemplo.com --contacto a@ejemplo.com --solo-unidades $U >/dev/null || return 1
  grep -q 'MemoryMax=1536M' $U/crea-oficina.service && grep -q 'OOMScoreAdjust=300' $U/crea-oficina.service && grep -q 'MemoryMax=2300M' $U/crea-oficina.slice || return 1
  out="$(systemd-analyze verify $U/*.service $U/*.timer $U/*.slice 2>&1 | grep -vE 'is not executable|No such file|Failed to (load|create)|Unit .* not found|cannot be loaded|Slice=|crea-oficina\.slice' || true)"; [ -z "$out" ] || { echo "$out"; return 1; }; }; t s11
if [ -n "${TEST_PG_ADMIN:-}" ]; then
T="respaldo cifrado → restauración de prueba con PostgreSQL real; clave equivocada falla"
s12() { local W=/var/tmp/cvbk; rm -rf $W; mkdir -p $W; local A="$TEST_PG_ADMIN"; $A -qAt -c "drop database if exists crea_oficina_t" postgres; $A -qAt -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='crea_oficina_app') then create role crea_oficina_app login password 'x'; end if; end \$\$" postgres
  $A -qAt -c "create database crea_oficina_t owner crea_oficina_app" postgres; local URL="${TEST_PG_URL:?}"; psql "$URL" -qAt -f ../../src/server/db/schema.sql >/dev/null 2>&1   # como en producción: las tablas las crea el propio rol de la aplicación
  psql "$URL" -qAt -c "insert into leads(id,email,consent) values('l1','prueba@x.com',true)"
  printf 'DATABASE_URL=%s\nPORT=3100\n' "$URL" > $W/env; openssl rand -base64 48 > $W/key
  CREA_ENV_FILE=$W/env CREA_BACKUP_KEY=$W/key CREA_BACKUP_DIR=$W/b CREA_STATE_DIR=$W/s bash respaldo.sh >/dev/null || return 1
  F="$(ls $W/b/*.enc | head -1)"; file "$F" | grep -qi "gzip" && return 1   # no debe ser legible
  local O; O="$(CREA_ENV_FILE=$W/env CREA_BACKUP_KEY=$W/key CREA_PSQL_ADMIN="$A -v ON_ERROR_STOP=1 -qAt" bash recuperar.sh --probar "$F")" || return 1; echo "$O" | grep -q 'prospectos|1' || return 1
  openssl rand -base64 48 > $W/malakey; if CREA_ENV_FILE=$W/env CREA_BACKUP_KEY=$W/malakey CREA_PSQL_ADMIN="$A -v ON_ERROR_STOP=1 -qAt" bash recuperar.sh --probar "$F" >/dev/null 2>&1; then return 1; fi
  $A -qAt -c "drop database crea_oficina_t" postgres; return 0; }; t s12
fi
echo; [ $R = 0 ] && echo "TODAS LAS PRUEBAS PASARON ($N)" || echo "HAY FALLAS"; exit $R
