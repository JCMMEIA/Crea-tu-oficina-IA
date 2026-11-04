#!/usr/bin/env bash
# Comprueba que OpenClaw sigue vivo y SIN REINICIAR. Solo LEE: /proc, systemctl is-active/show y un GET que solo guarda el código de respuesta.
# No lee variables de entorno, argumentos de procesos, ni archivos de OpenClaw (podrían contener claves).
#   openclaw_check.sh --guardar [archivo]     foto «antes»
#   openclaw_check.sh --comparar [archivo]    compara «después» con la foto; sale con error 1 si algo cambió
set -uo pipefail; . "$(dirname "$0")/lib.sh"
MODO="${1:-}"; FOTO="${2:-${STATE}/openclaw_antes.txt}"
foto() {
  local pid comm
  read -r _ pid comm < <(listeners | awk -v p="$OPENCLAW_PORT" '$1==p{print; exit}') || true
  echo "puerto=$OPENCLAW_PORT"; echo "escuchando=$([ -n "${pid:-}" ] && echo si || echo no)"
  [ -n "${pid:-}" ] || return 0
  echo "pid=$pid"; echo "comando=$comm"
  echo "inicio=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs)"
  echo "unidad=$(ps -o unit= -p "$pid" 2>/dev/null | xargs)"
  local u; u="$(ps -o unit= -p "$pid" 2>/dev/null | xargs)"
  case "$u" in *.service) echo "activa=$(systemctl is-active "$u" 2>/dev/null)"; echo "arranca_al_encender=$(systemctl is-enabled "$u" 2>/dev/null)"; echo "reinicios=$(systemctl show -p NRestarts --value "$u" 2>/dev/null)";; esac
  echo "http=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$OPENCLAW_PORT/" 2>/dev/null)"
  echo "memoria_mb=$(( $(awk '/VmRSS/{print $2}' /proc/$pid/status 2>/dev/null || echo 0) / 1024 ))"
}
case "$MODO" in
  --guardar) install -d -m 755 "$(dirname "$FOTO")" 2>/dev/null; foto > "$FOTO"; echo "Foto «antes» de OpenClaw guardada en $FOTO:"; sed 's/^/   /' "$FOTO"
    grep -q "escuchando=no" "$FOTO" && warn "No veo nada escuchando en el puerto $OPENCLAW_PORT. Verifica el puerto de OpenClaw antes de continuar." || ok "OpenClaw detectado en el puerto $OPENCLAW_PORT";;
  --comparar) [ -r "$FOTO" ] || die "No existe la foto «antes» ($FOTO). Primero: $0 --guardar"
    AHORA="$(mktemp)"; foto > "$AHORA"; fallo=0
    val() { grep -m1 "^$2=" "$1" | cut -d= -f2-; }
    [ "$(val "$FOTO" escuchando)" = "no" ] && { warn "OpenClaw no estaba escuchando ni «antes»: no hay nada que comparar."; rm -f "$AHORA"; exit 2; }
    for k in escuchando pid inicio unidad http; do
      a="$(val "$FOTO" $k)"; d="$(val "$AHORA" $k)"
      if [ "$a" = "$d" ]; then ok "$k sin cambios ($a)"; else bad "$k CAMBIÓ: antes «$a» → ahora «$d»"; fallo=1; fi
    done
    u="$(val "$AHORA" unidad)"; case "$u" in *.service) [ "$(val "$AHORA" activa)" = "active" ] && ok "servicio $u activo" || { bad "servicio $u NO está activo"; fallo=1; }
      [ "$(val "$FOTO" reinicios)" = "$(val "$AHORA" reinicios)" ] && ok "sin reinicios automáticos nuevos" || { bad "el servicio se reinició"; fallo=1; };; esac
    ma="$(val "$FOTO" memoria_mb)"; md="$(val "$AHORA" memoria_mb)"; lim=$(( ma * 3 / 2 + 200 ))
    [ "${md:-0}" -le "$lim" ] && ok "memoria de OpenClaw: antes ${ma} MB, ahora ${md} MB" || { warn "memoria de OpenClaw subió: ${ma} → ${md} MB (límite de aviso ${lim})"; fallo=1; }
    rm -f "$AHORA"
    if [ $fallo = 0 ]; then ok "OPENCLAW INTACTO"; else bad "OPENCLAW MUESTRA CAMBIOS: detente y revisa antes de seguir."; exit 1; fi;;
  *) echo "uso: $0 --guardar|--comparar [archivo]"; exit 64;;
esac
