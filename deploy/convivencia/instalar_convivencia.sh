#!/usr/bin/env bash
# Instalador en MODO CONVIVENCIA de Crea tu Oficina IA para un VPS que YA ejecuta otra aplicación (OpenClaw).
#
#   Simulacro (NO cambia nada, es lo predeterminado):
#     sudo bash instalar_convivencia.sh --dominio app.ejemplo.com --correo-cert tu@correo --correo-admin tu@correo --permitidos a@x.com,b@x.com --contacto tu@correo
#   Aplicar de verdad (pide tu autorización «SI» en cada paso):
#     igual + --aplicar
#
# GARANTÍAS (verificadas por prueba automática sobre este mismo archivo):
#   · No reinicia el servidor ni ningún servicio ajeno; no usa «apt upgrade»; no cambia el Node global.
#   · No toca el firewall; no borra ni edita ninguna configuración de Nginx existente (solo AGREGA archivos «crea-oficina»).
#   · Usuario, carpeta, claves, base de datos, servicio y puerto (3100, solo 127.0.0.1) propios.
#   · Antes y después de cada paso compara OpenClaw; si algo cambia, SE DETIENE.
#   · Todo lo que crea queda anotado en /var/lib/crea-oficina/manifest.txt para revertirlo con desinstalar_convivencia.sh.
# AVISO: no se ha podido ejecutar en tu VPS desde donde se escribió. Las partes de apt, Let's Encrypt y Nginx NO están probadas en un servidor real.
set -euo pipefail; AQUI="$(cd "$(dirname "$0")" && pwd)"; . "$AQUI/lib.sh"; cd /   # directorio legible por otros usuarios (git/psql se ejecutan como ctoapp/postgres)
REPO="${REPO_URL:-https://github.com/JCMMEIA/crea-tu-oficina-ia}"; SOLO_UNIDADES=""
DOM=""; CORREO_CERT=""; CORREO_ADMIN=""; PERMITIDOS=""; CONTACTO=""
while [ $# -gt 0 ]; do case "$1" in
  --aplicar) DRY=0;; --sin-preguntas) SIN_PREGUNTAS=1;;
  --dominio) DOM="$2"; shift;; --correo-cert) CORREO_CERT="$2"; shift;; --correo-admin) CORREO_ADMIN="$2"; shift;; --permitidos) PERMITIDOS="$2"; shift;; --contacto) CONTACTO="$2"; shift;;
  --solo-unidades) SOLO_UNIDADES="$2"; shift;;   # solo para pruebas: escribe los archivos de systemd en una carpeta y sale
  *) die "Opción desconocida: $1";; esac; shift; done
PERMITIDOS="$(echo "$PERMITIDOS" | tr -d '[:space:]')"
for v in "$CORREO_CERT" "$CORREO_ADMIN" "$PERMITIDOS" "$CONTACTO"; do [[ "$v" =~ ^[A-Za-z0-9@._+,-]+$ ]] || die "Faltan o no son válidos los correos (solo letras, números y @ . _ + - ,)."; done
[[ "$DOM" =~ ^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$ ]] || die "Falta --dominio (un subdominio INDEPENDIENTE, p. ej. app.tudominio.com)."
[ "$DRY" = 1 ] && warn "MODO SIMULACRO: no se cambia nada. Añade --aplicar para ejecutar."

# ---------- archivos de systemd (se generan igual en simulacro y en pruebas) ----------
unidades() { # emite cada unidad: nombre\n contenido, vía put con la ruta base $1
  local d="$1"
  put "$d/crea-oficina.slice" 644 root:root <<U
[Unit]
Description=Crea tu Oficina IA: tope total de recursos (protege a OpenClaw)
[Slice]
MemoryHigh=1900M
MemoryMax=2300M
MemorySwapMax=0
CPUWeight=50
CPUQuota=150%
TasksMax=600
U
  put "$d/crea-oficina.service" 644 root:root <<U
[Unit]
Description=Crea tu Oficina IA (convivencia, puerto $PORT, solo local)
After=network.target postgresql.service
Wants=postgresql.service
[Service]
Slice=crea-oficina.slice
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=HOME=$HOME_DIR
Environment=NODE_OPTIONS=--max-old-space-size=1024
ExecStart=$NODE_DIR/bin/node $APP_DIR/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $PORT
Restart=on-failure
RestartSec=5
MemoryHigh=1G
MemoryMax=1536M
MemorySwapMax=0
OOMScoreAdjust=300
Nice=5
TasksMax=300
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR/.next $HOME_DIR
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
[Install]
WantedBy=multi-user.target
U
  put "$d/crea-tick-automatizaciones.service" 644 root:root <<U
[Unit]
Description=Crea tu Oficina IA: automatizaciones
After=crea-oficina.service
[Service]
Type=oneshot
Slice=crea-oficina.slice
User=$APP_USER
ExecStart=/usr/bin/bash $APP_DIR/deploy/convivencia/tick.sh automatizaciones
TimeoutStartSec=600
Nice=5
U
  put "$d/crea-tick-automatizaciones.timer" 644 root:root <<U
[Unit]
Description=Automatizaciones cada 15 minutos
[Timer]
OnCalendar=*:0/15
AccuracySec=30s
[Install]
WantedBy=timers.target
U
  put "$d/crea-tick-cola.service" 644 root:root <<U
[Unit]
Description=Crea tu Oficina IA: cola de avisos
After=crea-oficina.service
[Service]
Type=oneshot
Slice=crea-oficina.slice
User=$APP_USER
ExecStart=/usr/bin/bash $APP_DIR/deploy/convivencia/tick.sh cola
TimeoutStartSec=300
Nice=5
U
  put "$d/crea-tick-cola.timer" 644 root:root <<U
[Unit]
Description=Cola de avisos cada minuto
[Timer]
OnCalendar=minutely
AccuracySec=10s
[Install]
WantedBy=timers.target
U
  put "$d/crea-respaldo.service" 644 root:root <<U
[Unit]
Description=Crea tu Oficina IA: respaldo cifrado
[Service]
Type=oneshot
Slice=crea-oficina.slice
User=$APP_USER
ExecStart=/usr/bin/bash $APP_DIR/deploy/convivencia/respaldo.sh
Nice=10
IOSchedulingClass=idle
U
  put "$d/crea-respaldo.timer" 644 root:root <<U
[Unit]
Description=Respaldo diario
[Timer]
OnCalendar=*-*-* 03:17:00
RandomizedDelaySec=600
Persistent=true
[Install]
WantedBy=timers.target
U
  put "$d/postgresql@16-main.service.d/crea-oficina.conf" 644 root:root <<U
# Solo PostgreSQL de Crea tu Oficina IA (instalado por este modo). Limita su memoria y lo mete en el mismo tope.
[Service]
Slice=crea-oficina.slice
MemoryMax=768M
MemorySwapMax=0
OOMScoreAdjust=200
U
}
if [ -n "$SOLO_UNIDADES" ]; then DRY=0; unidades "$SOLO_UNIDADES"; echo "Unidades escritas en $SOLO_UNIDADES"; exit 0; fi

# ================= 0. REVISIÓN (solo lectura) =================
titulo "0. Revisión previa (solo lectura)"
[ "$(id -u)" = 0 ] || die "Ejecútalo como root (sudo)."
. /etc/os-release; [ "${VERSION_ID:-}" = "24.04" ] && ok "Ubuntu 24.04" || warn "Pensado para Ubuntu 24.04; este es ${PRETTY_NAME:-desconocido}."
[ -f /var/run/reboot-required ] && warn "El sistema pide reinicio. NO se reinicia. Hazlo tú más adelante, tras comprobar que OpenClaw arranca solo."
for p in 80 443 "$PORT"; do puerto_ocupado "$p" && die "El puerto $p ya está ocupado. Este instalador no compite por puertos; revisa con requisitos.sh."; done; ok "Puertos 80, 443 y $PORT libres"
puerto_ocupado "$OPENCLAW_PORT" && ok "OpenClaw escucha en $OPENCLAW_PORT" || warn "No veo nada en el puerto $OPENCLAW_PORT (OpenClaw). Revisa OPENCLAW_PORT antes de aplicar."
DISP=$(free -m | awk '/Mem:/{print $7}'); [ "$DISP" -ge 3500 ] && ok "Memoria disponible: ${DISP} MB (la compilación necesita ~2200 MB)" || die "Memoria disponible ${DISP} MB: insuficiente para compilar con seguridad."
LIBRE=$(df -BG --output=avail / | tail -1 | tr -dc 0-9); [ "$LIBRE" -ge 10 ] && ok "Disco libre: ${LIBRE} GB" || die "Poco disco libre."
for f in "$BASE" "$ETC" /etc/nginx/sites-available/crea-oficina /etc/systemd/system/$UNIT.service; do [ -e "$f" ] && die "$f ya existe: no se sobrescribe. Si es una instalación previa, usa desinstalar_convivencia.sh."; done
id "$APP_USER" >/dev/null 2>&1 && die "El usuario $APP_USER ya existe."
getent hosts "$DOM" >/dev/null && ok "El dominio $DOM resuelve a: $(getent hosts "$DOM" | awk '{print $1}' | head -1)" || { [ "$DRY" = 1 ] && warn "$DOM todavía no resuelve (en simulacro solo se avisa)." || die "$DOM no resuelve. Crea el registro A hacia la IP de este servidor y espera."; }
[ "$DRY" = 0 ] && "$AQUI/openclaw_check.sh" --guardar "$STATE/openclaw_antes.txt"
cmpoc() { [ "$DRY" = 1 ] && return 0; "$AQUI/openclaw_check.sh" --comparar "$STATE/openclaw_antes.txt" >/dev/null || die "OpenClaw cambió tras «$1». Detenido. No se continúa."; ok "OpenClaw intacto tras: $1"; }

# ================= 1. Paquetes (solo los que faltan) =================
FALTAN=(); for pk in "nginx:nginx" "postgresql:psql" "certbot:certbot" "git:git" "curl:curl" "xz-utils:xz" "ca-certificates:update-ca-certificates"; do command -v "${pk#*:}" >/dev/null 2>&1 || FALTAN+=("${pk%%:*}"); done
if [ ${#FALTAN[@]} -gt 0 ]; then
  paso "1. Instalar paquetes que faltan: ${FALTAN[*]}" "agrega esos paquetes con apt (sin upgrade). nginx y postgresql se inician solos; ambos escuchan sin chocar con OpenClaw (se revisó 80/443/5432)."
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1   # needrestart SOLO LISTA, nunca reinicia servicios de OpenClaw
  SIM="$(apt-get -s install --no-install-recommends "${FALTAN[@]}" 2>&1 || true)"
  echo "$SIM" | { grep -E "^(Inst|Remv)" || true; } | sed 's/^/   /' | head -40
  echo "$SIM" | grep -q "^Remv" && die "apt quitaría paquetes. Detenido."
  echo "$SIM" | grep -E "^Inst .*\[" | grep -q . && { [ "$DRY" = 1 ] && warn "apt ACTUALIZARÍA paquetes ya instalados (líneas Inst con [versión]); en modo aplicar se detiene." || die "apt actualizaría paquetes ya instalados (podría afectar a OpenClaw). Detenido: revisa la lista."; }
  [ "$DRY" = 0 ] && apt-get update -y -o DPkg::Lock::Timeout=180 >/dev/null
  run apt-get install -y --no-install-recommends -o DPkg::Lock::Timeout=180 "${FALTAN[@]}"; anotar paquetes "${FALTAN[*]}"; cmpoc "paquetes"
else ok "1. Todos los programas necesarios ya existen: no se instala nada."; fi

# ================= 2. Usuario y carpetas =================
paso "2. Usuario y carpetas propios" "crea el usuario de sistema '$APP_USER' (sin acceso por consola) y las carpetas $BASE, $ETC, $STATE, $BACKUPS."
run useradd --system --home-dir "$HOME_DIR" --shell /usr/sbin/nologin --user-group "$APP_USER"; anotar usuario "$APP_USER"
for d in "$BASE" "$HOME_DIR" "$STATE" "$BACKUPS" "$ETC"; do run install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$d"; anotar carpeta "$d"; done
run chown root:"$APP_USER" "$ETC"; run chmod 750 "$ETC"

# ================= 3. Node.js PRIVADO =================
paso "3. Node.js $NODE_VER privado" "descarga Node de nodejs.org, verifica su huella SHA-256 y lo desempaqueta en $NODE_DIR. El Node del sistema NO se toca."
if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] curl https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz → verificar sha256 = $NODE_SHA256 → tar en $NODE_DIR"
else
  T="$(mktemp -d)"; curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" -o "$T/n.tar.xz"
  echo "$NODE_SHA256  $T/n.tar.xz" | sha256sum -c - >/dev/null || die "La huella de Node NO coincide. Descarga rechazada."
  install -d -o "$APP_USER" -g "$APP_USER" "$NODE_DIR"; tar -xJf "$T/n.tar.xz" -C "$NODE_DIR" --strip-components=1; chown -R "$APP_USER:$APP_USER" "$NODE_DIR"; rm -rf "$T"
  "$NODE_DIR/bin/node" -v | grep -q "$NODE_VER" || die "Node privado no responde."; ok "Node privado $NODE_VER verificado"
fi; cmpoc "Node privado"

# ================= 4. PostgreSQL exclusivo =================
PSQL="runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qAt"
paso "4. Base de datos exclusiva" "crea el rol '$DB_ROLE' (sin superusuario) y la base '$DB_NAME' que SOLO ese rol puede abrir. No toca otras bases ni roles."
if [ "$DRY" = 0 ]; then
  for i in $(seq 1 60); do runuser -u postgres -- pg_isready -q && break; sleep 1; done; runuser -u postgres -- pg_isready -q || die "PostgreSQL no responde tras instalarse."
  OTRAS="$($PSQL -c "select count(*) from pg_database where datname not in ('postgres','template0','template1')")"; echo "   Bases ajenas ya existentes: $OTRAS"
  DBPW="$(openssl rand -hex 24)"
  echo "CREATE ROLE $DB_ROLE LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$DBPW'" | $PSQL
  $PSQL -c "CREATE DATABASE $DB_NAME OWNER $DB_ROLE"; $PSQL -c "REVOKE ALL ON DATABASE $DB_NAME FROM PUBLIC"; $PSQL -c "GRANT CONNECT ON DATABASE $DB_NAME TO $DB_ROLE"
  $PSQL -d "$DB_NAME" -c "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT ALL ON SCHEMA public TO $DB_ROLE"
  anotar rol_pg "$DB_ROLE"; anotar base_pg "$DB_NAME"
  [ "$OTRAS" = "0" ] && ok "No había bases ajenas: se puede limitar la memoria de PostgreSQL sin riesgo" || warn "Hay bases ajenas: NO se reinicia PostgreSQL ni se cambia su configuración."
else echo "   [SIMULACRO] CREATE ROLE $DB_ROLE …; CREATE DATABASE $DB_NAME OWNER $DB_ROLE; REVOKE ALL … FROM PUBLIC (contraseña aleatoria, solo en $ENV_FILE)"; DBPW="SIMULACRO"; OTRAS=0; fi
if [ "${OTRAS:-1}" = "0" ]; then
  put /etc/postgresql/16/main/conf.d/crea-oficina.conf 644 root:root <<U
# Solo Crea tu Oficina IA usa este PostgreSQL.
listen_addresses = 'localhost'
shared_buffers = 128MB
max_connections = 30
work_mem = 4MB
U
  anotar archivo /etc/postgresql/16/main/conf.d/crea-oficina.conf
fi
cmpoc "PostgreSQL"

# ================= 5. Configuración y claves =================
paso "5. Archivo de configuración y claves" "crea $ENV_FILE (solo root y $APP_USER) con claves aleatorias NUEVAS, y $ETC/backup.key para cifrar respaldos. Los cobros quedan APAGADOS."
[ "$DRY" = 1 ] && { APPSEC="SIMULACRO-SECRET"; CRON="SIMULACRO-SECRET"; } || { APPSEC="$(openssl rand -base64 32)"; CRON="$(openssl rand -hex 24)"; }
put "$ENV_FILE" 640 root:"$APP_USER" <<U
NODE_ENV=production
PORT=$PORT
HOSTNAME=127.0.0.1
DATABASE_URL=postgres://$DB_ROLE:$DBPW@127.0.0.1:5432/$DB_NAME
APP_SECRET=$APPSEC
CRON_SECRET=$CRON
NEXT_PUBLIC_SITE_URL=https://$DOM
NEXT_PUBLIC_CONTACT_EMAIL=$CONTACTO
PLATFORM_ADMIN_EMAILS=$CORREO_ADMIN
SIGNUP_ALLOWED_EMAILS=$PERMITIDOS
BILLING_ENABLED=false
MODEL_ID=claude-sonnet-5-5
U
anotar archivo "$ENV_FILE"
if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] openssl rand -base64 48 > $ETC/backup.key (modo 640 root:$APP_USER)"; else openssl rand -base64 48 > "$ETC/backup.key"; chmod 640 "$ETC/backup.key"; chown root:"$APP_USER" "$ETC/backup.key"; anotar archivo "$ETC/backup.key"; fi

# ================= 6. Código y compilación (con tope de memoria) =================
paso "6. Bajar el código y compilar con tope de memoria" "clona $REPO en $APP_DIR y compila dentro de un límite de 3 GB de RAM y sin memoria de intercambio: si se pasara, solo se detiene la compilación, nunca OpenClaw."
run runuser -u "$APP_USER" -- git clone --depth 1 "$REPO" "$APP_DIR"; anotar carpeta "$APP_DIR"
if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] systemd-run --wait --pipe --collect -p User=$APP_USER -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=100% -p CPUWeight=20 -p Nice=10 → npm ci --include=dev && npm run build (con el Node privado)"
else
  systemd-run --wait --pipe --collect -p User="$APP_USER" -p WorkingDirectory="$APP_DIR" -p EnvironmentFile="$ENV_FILE" -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=100% -p CPUWeight=20 -p Nice=10 \
    -E HOME="$HOME_DIR" -E PATH="$NODE_DIR/bin:/usr/bin:/bin" -E NODE_OPTIONS=--max-old-space-size=2048 /usr/bin/bash -c "npm ci --include=dev --no-audit --no-fund && npm run build" || die "La compilación falló (o se pasó del tope de memoria). OpenClaw no se afectó."
fi; cmpoc "compilación"

# ================= 7. Servicio, temporizadores y límites =================
paso "7. Servicio con límites de recursos" "crea la unidad crea-oficina.service (tope 1,5 GB de RAM, prioridad menor que OpenClaw, solo 127.0.0.1:$PORT), temporizadores de automatizaciones/cola/respaldo y limita PostgreSQL a 768 MB."
unidades /etc/systemd/system; for u in crea-oficina.slice crea-oficina.service crea-tick-automatizaciones.service crea-tick-automatizaciones.timer crea-tick-cola.service crea-tick-cola.timer crea-respaldo.service crea-respaldo.timer postgresql@16-main.service.d/crea-oficina.conf; do anotar unidad "/etc/systemd/system/$u"; done
run systemctl daemon-reload   # solo relee archivos; no reinicia nada
if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] preflight (npm run preflight) → systemctl enable --now crea-oficina.service crea-tick-*.timer crea-respaldo.timer"
else
  runuser -u "$APP_USER" -- env HOME="$HOME_DIR" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && PATH=$NODE_DIR/bin:\$PATH npx tsx scripts/preflight.ts" || warn "El preflight tiene pendientes (ver arriba)."
  [ "${OTRAS:-1}" = "0" ] && { systemctl restart postgresql; for i in $(seq 1 60); do runuser -u postgres -- pg_isready -q && break; sleep 1; done; }   # SOLO si no hay bases ajenas (lo comprobó el paso 4); ANTES de arrancar la app
  systemctl enable --now crea-oficina.service crea-tick-automatizaciones.timer crea-tick-cola.timer crea-respaldo.timer
  sleep 6; curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null && ok "La aplicación responde en 127.0.0.1:$PORT" || die "La aplicación no responde. Mira: journalctl -u crea-oficina -n 50"
fi; cmpoc "servicio"

# ================= 8. Nginx (solo AGREGA) y HTTPS =================
paso "8. Nginx y certificado HTTPS para $DOM" "AGREGA el sitio 'crea-oficina' (y un límite de peticiones propio). No borra ni edita ningún sitio existente (ni el 'default'). El certificado se pide por el método webhook: Certbot NO edita Nginx."
[ "$DRY" = 0 ] && { nginx -t 2>/dev/null || die "La configuración de Nginx YA estaba rota antes de nuestros cambios: no se toca nada."; }
put /etc/nginx/conf.d/crea-oficina-limites.conf 644 root:root <<'U'
limit_req_zone $binary_remote_addr zone=crea_ofi:10m rate=10r/s;
U
run install -d -m 755 /var/www/crea-acme
put /etc/nginx/sites-available/crea-oficina 644 root:root <<U
server {
  listen 80; listen [::]:80; server_name $DOM; server_tokens off;
  location ^~ /.well-known/acme-challenge/ { root /var/www/crea-acme; }
  location / { return 301 https://\$host\$request_uri; }
}
U
run ln -s /etc/nginx/sites-available/crea-oficina /etc/nginx/sites-enabled/crea-oficina; anotar archivo /etc/nginx/sites-available/crea-oficina; anotar archivo /etc/nginx/sites-enabled/crea-oficina; anotar archivo /etc/nginx/conf.d/crea-oficina-limites.conf
if [ "$DRY" = 0 ]; then nginx -t || { rm -f /etc/nginx/sites-enabled/crea-oficina; die "nginx -t falló con nuestro sitio; se retiró y no se recargó."; }; systemctl reload nginx; fi
run certbot certonly --webroot -w /var/www/crea-acme -d "$DOM" -m "$CORREO_CERT" --agree-tos --no-eff-email -n; anotar certificado "$DOM"
put /etc/nginx/sites-available/crea-oficina 644 root:root <<U
server {
  listen 80; listen [::]:80; server_name $DOM; server_tokens off;
  location ^~ /.well-known/acme-challenge/ { root /var/www/crea-acme; }
  location / { return 301 https://\$host\$request_uri; }
}
server {
  listen 443 ssl http2; listen [::]:443 ssl http2; server_name $DOM; server_tokens off;
  ssl_certificate /etc/letsencrypt/live/$DOM/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/$DOM/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3; ssl_session_cache shared:crea_ssl:5m; ssl_session_timeout 1d;
  client_max_body_size 1m;
  location / { limit_req zone=crea_ofi burst=60 nodelay; proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto \$scheme; proxy_read_timeout 120s; }
}
U
if [ "$DRY" = 0 ]; then nginx -t || die "nginx -t falló con el bloque HTTPS. El sitio HTTP sigue activo; revisa /etc/nginx/sites-available/crea-oficina."; systemctl reload nginx; fi; cmpoc "Nginx y HTTPS"

# ================= 9. Respaldos y verificación final =================
paso "9. Probar respaldo y restauración" "hace un respaldo cifrado real y lo restaura en una base TEMPORAL para comprobarlo (la base real no se toca)."
if [ "$DRY" = 1 ]; then echo "   [SIMULACRO] systemctl start crea-respaldo.service → recuperar.sh --probar <archivo>"
else systemctl start crea-respaldo.service; ULT="$(ls -1t "$BACKUPS"/crea-*.enc | sed -n 1p)"; "$AQUI/recuperar.sh" --probar "$ULT"; fi
titulo "10. Verificación final"
[ "$DRY" = 0 ] && { curl -fsS "https://$DOM/api/health" && echo && ok "HTTPS funciona en https://$DOM"; "$AQUI/openclaw_check.sh" --comparar "$STATE/openclaw_antes.txt"; } || echo "   [SIMULACRO] curl https://$DOM/api/health + openclaw_check.sh --comparar"
cat <<FIN

LISTO ($([ "$DRY" = 1 ] && echo SIMULACRO || echo APLICADO)). Pendiente de TI, no se hizo solo:
  · Firewall: bash $AQUI/firewall_proponer.sh  (solo propone; tú autorizas cada regla)
  · Copia EXTERNA de respaldos: ver docs/CONVIVENCIA_OPENCLAW.md (la clave $ETC/backup.key debe guardarse FUERA del servidor)
  · Crear tu cuenta en https://$DOM/registro con el correo de operador y abrir /admin
  · Reinicio del VPS: solo tú, después de comprobar que OpenClaw arranca solo al encender.
FIN
