#!/usr/bin/env bash
# Pruebas del modo convivencia. NO cambian el sistema (el instalador corre en SIMULACRO). Uso:  bash pruebas/run_tests.sh
# Opcional: TEST_PG_ADMIN="psql -h 127.0.0.1 -p 5544 -U postgres" (con PGPASSWORD) para la prueba real de respaldo/restauración.
set -uo pipefail; D="$(cd "$(dirname "$0")/.." && pwd)"; cd "$D"; R=0; N=0
t() { N=$((N+1)); if "$@"; then echo "✓ $T"; else echo "✗ $T"; R=1; fi; }
T="sintaxis de todos los scripts"; s1() { for f in *.sh pruebas/*.sh; do bash -n "$f" || return 1; done; }; t s1
T="el instalador NO contiene órdenes peligrosas para OpenClaw"
s2() { local bad=0 pat
  for pat in 'ufw +(enable|reset|default|allow|deny|delete|disable)' '--force enable' '\b(reboot|shutdown|poweroff|halt)\b' 'apt(-get)? +(upgrade|dist-upgrade|full-upgrade)' 'npm +(i|install) +(-g|--global)' 'nodesource|setup_[0-9]+\.x' '\b(pkill|killall)\b' '\bkill +-' 'certbot +--nginx' 'sites-enabled/default' 'fail2ban|fallocate|mkswap|swapon'; do
    if grep -nE -- "$pat" instalar_convivencia.sh desinstalar_convivencia.sh respaldo.sh recuperar.sh tick.sh | grep -vE '^\S+:[0-9]+:\s*#|echo|warn|bad|die|NO se|no se|NO |No ' >/dev/null; then echo "   patrón peligroso: $pat"; grep -nE -- "$pat" *.sh | head -3; bad=1; fi; done
  # systemctl restart/stop/disable/kill/mask: solo sobre unidades propias o PostgreSQL (guardado por el chequeo de bases ajenas)
  while read -r l; do echo "$l" | grep -qE 'crea-|\$u"|\$UNIT|\$\{UNIT\}|postgresql' || { echo "   systemctl sobre unidad no propia: $l"; bad=1; }; done < <(grep -hE 'systemctl +(restart|stop|disable|kill|mask)' instalar_convivencia.sh desinstalar_convivencia.sh recuperar.sh | grep -vE '^\s*#')
  return $bad; }; t s2
T="todo 'rm' del instalador/desinstalador apunta solo a rutas propias"
s3() { local bad=0; while read -r l; do echo "$l" | grep -qE 'crea-oficina|crea_oficina|\$APP_DIR|\$NODE_DIR|\$HOME_DIR|\$valor|\$T"|/var/www/crea-acme|\$BASE' || { echo "   rm sospechoso: $l"; bad=1; }; done < <(grep -hE '\brm +(-[rf]+ +)?' instalar_convivencia.sh desinstalar_convivencia.sh | grep -vE '^\s*#|echo'); return $bad; }; t s3
T="el instalador no sobrescribe: se niega si ya existen usuario/carpetas/archivos"; s4() { grep -q 'ya existe: no se sobrescribe' instalar_convivencia.sh && grep -q 'El usuario $APP_USER ya existe' instalar_convivencia.sh; }; t s4
T="usa puerto 3100 solo local y Node privado verificado por huella"; s5() { grep -q 'PORT=3100' lib.sh && grep -q '127.0.0.1 -p \$PORT' instalar_convivencia.sh && grep -q 'sha256sum -c' instalar_convivencia.sh && ! grep -qE 'listen +\$PORT|0\.0\.0\.0' instalar_convivencia.sh; }; t s5
T="OpenClaw: sin cambios → INTACTO; tras reinicio → lo detecta"
s6() { local W=/var/tmp/cvtest; mkdir -p $W; (python3 -m http.server 18789 --bind 127.0.0.1 >/dev/null 2>&1 &); sleep 1
  bash openclaw_check.sh --guardar $W/a.txt >/dev/null || return 1; bash openclaw_check.sh --comparar $W/a.txt >/dev/null || { pkill -f "http.server 18789"; return 1; }
  pkill -f "http.server 18789"; sleep 1; (python3 -m http.server 18789 --bind 127.0.0.1 >/dev/null 2>&1 &); sleep 1
  if bash openclaw_check.sh --comparar $W/a.txt >/dev/null; then pkill -f "http.server 18789"; return 1; fi; pkill -f "http.server 18789"; return 0; }; t s6
T="simulacro del instalador: termina bien, no cambia nada del sistema"
s7() { local antes despues; antes="$(ls /opt /etc /var/lib | md5sum; getent passwd | md5sum)"
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
