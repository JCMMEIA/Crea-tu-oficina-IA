#!/usr/bin/env bash
# Funciones comunes del modo convivencia. Se carga con:  . "$(dirname "$0")/lib.sh"
# Regla de oro: este modo SOLO AGREGA cosas con nombre propio («crea-oficina», «ctoapp»). Nunca borra, detiene ni reinicia nada que no sea suyo.

APP_USER=ctoapp; UNIT=crea-oficina
BASE=/opt/crea-oficina; APP_DIR=$BASE/app; NODE_DIR=$BASE/node; HOME_DIR=$BASE/home
ETC=/etc/crea-oficina; ENV_FILE=$ETC/env; STATE=/var/lib/crea-oficina; BACKUPS=/var/backups/crea-oficina; MANIFEST=$STATE/manifest.txt
PORT=3100; DB_NAME=crea_oficina; DB_ROLE=crea_oficina_app
NODE_VER=v22.23.4   # la versión con la que se hicieron TODAS las pruebas (no se usa el Node del sistema, que es v24 y no está probado)
NODE_SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce  # node-v22.23.4-linux-x64.tar.xz, de https://nodejs.org/dist/v22.23.4/SHASUMS256.txt
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
DRY=1   # por defecto SIMULACRO: no cambia nada. Solo --aplicar cambia el servidor.

c_ok=$'\e[32m'; c_bad=$'\e[31m'; c_warn=$'\e[33m'; c_off=$'\e[0m'
ok()   { echo "${c_ok}✅${c_off} $*"; }
warn() { echo "${c_warn}⚠️ ${c_off} $*"; }
bad()  { echo "${c_bad}❌${c_off} $*"; }
die()  { bad "$*"; exit 1; }
titulo() { echo; echo "════ $* ════"; }

# Ejecuta un comando. En simulacro solo lo muestra.
run() { if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] $*"; else "$@"; fi; }
# Escribe un archivo desde stdin: put RUTA MODO DUEÑO:GRUPO
put() {
  local f="$1" mode="$2" own="$3" body; body="$(cat)"
  if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] escribiría $f (modo $mode, $own):"; echo "$body" | sed -E 's/((SECRET|PASSWORD|KEY|TOKEN)[A-Z_]*=).*/\1<oculto>/; s#(postgres://[^:]+:)[^@]+@#\1<oculto>@#' | sed 's/^/        | /' | head -40; return 0; fi
  install -d -m 755 "$(dirname "$f")"; printf '%s\n' "$body" > "$f"; chmod "$mode" "$f"; chown "$own" "$f"
}
# Pide permiso expreso para un paso que CAMBIA el servidor. En simulacro no pregunta.
paso() {
  titulo "$1"; echo "   Qué cambia: $2"
  [ "$DRY" = 1 ] && return 0
  [ "${SIN_PREGUNTAS:-0}" = 1 ] && return 0
  read -r -p "   ¿Autorizas este paso? escribe SI para continuar: " a; [ "$a" = "SI" ] || die "Paso no autorizado. Nada más se ha cambiado."
}
# Registro de lo creado (para poder revertir exactamente eso y nada más).
anotar() { [ "$DRY" = 1 ] && return 0; install -d -m 755 "$STATE"; echo "$1|$2" >> "$MANIFEST"; }

# ---- Lectura de puertos SIN depender de «ss»: /proc/net/tcp (solo lectura) ----
# listeners → líneas "puerto pid comando" de todo lo que escucha en TCP.
listeners() {
  local f line st local inode port pid comm
  for f in /proc/net/tcp /proc/net/tcp6; do
    [ -r "$f" ] || continue
    while read -r _ local _ st _ _ _ _ _ inode _; do
      [ "$st" = "0A" ] || continue; port=$((16#${local##*:})); pid=""; comm="?"
      for fd in /proc/[0-9]*/fd/*; do
        [ "$(readlink "$fd" 2>/dev/null)" = "socket:[$inode]" ] && { pid="${fd#/proc/}"; pid="${pid%%/*}"; comm="$(cat /proc/$pid/comm 2>/dev/null || echo '?')"; break; }
      done
      echo "$port ${pid:-?} $comm"
    done < <(tail -n +2 "$f")
  done | sort -n -u
}
puerto_ocupado() { listeners | awk -v p="$1" '$1==p{f=1} END{exit !f}'; }

# ---- Análisis de «apt-get -s install» (qué paquetes serían NUEVOS, cuáles se ACTUALIZARÍAN y cuáles se QUITARÍAN) ----
# Formato real de apt:  nuevo        →  Inst nombre (versión origen [amd64])
#                       actualiza    →  Inst nombre [versión-instalada] (versión-nueva origen [amd64])
# La señal de actualización es que el TERCER campo empiece con «[» (la versión vieja pegada al nombre). El «[amd64]» del final aparece en TODAS las líneas
# y NO significa actualización (esa confusión causó un falso positivo).
apt_analizar() {  # stdin: salida de apt-get -s. stdout: «nuevos=N actualizados=N quitados=N» y una línea ACTUALIZA:/QUITA: por paquete
  awk '/^Inst /{ if ($3 ~ /^\[/) { u++; ul[u]=$2 } else n++ } /^Remv /{ r++; rl[r]=$2 }
       END{ printf "nuevos=%d actualizados=%d quitados=%d\n", n, u, r; for(i=1;i<=u;i++) print "ACTUALIZA: " ul[i]; for(i=1;i<=r;i++) print "QUITA: " rl[i] }'
}
# apt_verificar paquetes…  → código: 0 solo instalaciones nuevas · 3 actualizaría paquetes existentes · 4 quitaría paquetes · 5 apt no pudo simular
apt_verificar() {
  local sim res
  sim="$(LC_ALL=C apt-get -s install --no-install-recommends "$@" 2>&1)" || { echo "$sim" | tail -5 | sed 's/^/   /'; return 5; }
  res="$(echo "$sim" | apt_analizar)"; echo "   apt simulado → $(echo "$res" | head -1)"
  echo "$res" | grep -E '^(ACTUALIZA|QUITA):' | sed 's/^/   /' || true
  case "$res" in *"quitados=0"*) :;; *) return 4;; esac
  case "$res" in *"actualizados=0 "*) return 0;; *) return 3;; esac
}
# Qué hacer con el código de apt_verificar: en simulacro solo avisa; al aplicar, DETIENE ante actualizaciones, remociones o fallo de apt.
apt_decidir() {
  case "$1" in
    0) ok "apt solo instalaría paquetes NUEVOS (no toca ninguno existente)";;
    3) [ "$DRY" = 1 ] && warn "apt ACTUALIZARÍA paquetes ya instalados (lista arriba); al aplicar se detendría." || die "apt actualizaría paquetes ya instalados (podría afectar a OpenClaw). Detenido: revisa la lista.";;
    4) [ "$DRY" = 1 ] && warn "apt QUITARÍA paquetes (lista arriba); al aplicar se detendría." || die "apt quitaría paquetes. Detenido.";;
    *) [ "$DRY" = 1 ] && warn "apt no pudo simular la instalación (¿falta 'apt-get update'?); al aplicar se detendría." || die "apt no pudo simular la instalación. Detenido (no se instala a ciegas).";;
  esac
}
# Instala SOLO si apt confirma que todo son paquetes nuevos. Se detiene (al aplicar) ante actualizaciones, remociones o si apt no puede simular.
paquetes_seguros() {
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1   # needrestart SOLO LISTA, nunca reinicia servicios (OpenClaw incluido)
  [ "$DRY" = 0 ] && apt-get update -y -o DPkg::Lock::Timeout=180 >/dev/null   # actualiza solo el ÍNDICE de paquetes
  local rc=0; apt_verificar "$@" || rc=$?; apt_decidir "$rc"
  run apt-get install -y --no-install-recommends -o DPkg::Lock::Timeout=180 "$@"
}

# ---- Configuración de Nginx del sitio (HTTP: desafío de Let's Encrypt + redirección; HTTPS: proxy a la aplicación) ----
# Una sola definición, usada por el instalador y por continuar_fase8.sh (así no se desvían).
nginx_conf_completa() {  # DOMINIO [PUERTO]
  local dom="$1" port="${2:-$PORT}"
  cat <<NG
server {
  listen 80; listen [::]:80; server_name $dom; server_tokens off;
  location ^~ /.well-known/acme-challenge/ { root /var/www/crea-acme; }
  location / { return 301 https://\$host\$request_uri; }
}
server {
  listen 443 ssl http2; listen [::]:443 ssl http2; server_name $dom; server_tokens off;
  ssl_certificate /etc/letsencrypt/live/$dom/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/$dom/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3; ssl_session_cache shared:crea_ssl:5m; ssl_session_timeout 1d;
  client_max_body_size 1m;
  location / { limit_req zone=crea_ofi burst=60 nodelay; proxy_pass http://127.0.0.1:$port; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto \$scheme; proxy_read_timeout 120s; }
}
NG
}

# Cambia (o agrega) una clave KEY=valor en un archivo de configuración SIN mostrar el valor ni pasarlo por argumentos de proceso.
env_set() {  # archivo clave valor
  local f="$1" k="$2" tmp; tmp="$(mktemp)"
  K="$k" V="$3" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; done=0} index($0, k"=")==1 {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' "$f" > "$tmp"
  cat "$tmp" > "$f"; rm -f "$tmp"   # conserva dueño y permisos del archivo original
}
