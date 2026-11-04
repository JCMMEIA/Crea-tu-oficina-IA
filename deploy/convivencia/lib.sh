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
