#!/usr/bin/env bash
# Instalación PRIVADA de Crea tu Oficina IA en un servidor Ubuntu 24.04 limpio (VPS). Ejecutar como root:
#   bash instalar.sh
# Hace: instala Node 22, PostgreSQL, Nginx y certificado HTTPS; crea las claves; compila; arranca; programa tareas y respaldos.
# NO enciende cobros, NO pone la clave de Claude (la agregas tú después), NO publica anuncios. Se puede repetir sin romper nada.
# AVISO: este script NO se ha podido probar en un servidor real de Hostinger desde donde se escribió (solo revisión de sintaxis y partes sueltas).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecútalo como root (sudo -i)."; exit 1; }
. /etc/os-release; [ "${VERSION_ID:-}" = "24.04" ] || echo "⚠️  Pensado para Ubuntu 24.04; tú tienes ${PRETTY_NAME:-desconocido}."

REPO="${REPO_URL:-https://github.com/JCMMEIA/crea-tu-oficina-ia}"; APP=/opt/cto; ENVF=/etc/cto/env; PORT=3000
ask() { local v="$1" p="$2" d="${3:-}"; local cur; cur="$(grep -s "^$v=" "$ENVF" | cut -d= -f2- || true)"; if [ -n "$cur" ]; then eval "$v=\"\$cur\""; return; fi
  read -r -p "$p ${d:+[$d] }" a; eval "$v=\"\${a:-$d}\""; }

echo "== 1/8 Datos que necesito (se guardan solo en este servidor) =="
ask DOMINIO "Tu dominio (ej. app.tuempresa.com; ya debe apuntar a la IP de este servidor):"
ask CORREO_CERT "Tu correo (para avisos del certificado HTTPS):"
ask CORREO_ADMIN "Tu correo de OPERADOR (con él entrarás al panel /admin):"
ask CORREOS_PERMITIDOS "Correos que pueden crear cuenta, separados por coma:" "$CORREO_ADMIN"
ask CORREO_CONTACTO "Correo de contacto para la política de privacidad:" "$CORREO_ADMIN"
[[ "$DOMINIO" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo "Dominio inválido."; exit 1; }

echo "== 2/8 Programas =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y; apt-get install -y curl git ca-certificates gnupg ufw nginx certbot python3-certbot-nginx postgresql postgresql-contrib
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; apt-get install -y nodejs; fi

echo "== 3/8 Usuario y base de datos =="
id cto >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin cto
mkdir -p /etc/cto; touch "$ENVF"; chmod 600 "$ENVF"; chown root:cto "$ENVF"; chmod 640 "$ENVF"
sec() { local v="$1"; grep -q "^$v=" "$ENVF" || echo "$v=$2" >> "$ENVF"; }
sec DB_PASSWORD "$(openssl rand -hex 24)"; DBPW="$(grep '^DB_PASSWORD=' "$ENVF" | cut -d= -f2-)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='cto'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE cto LOGIN PASSWORD '$DBPW'"
sudo -u postgres psql -c "ALTER ROLE cto PASSWORD '$DBPW'" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='cto'" | grep -q 1 || sudo -u postgres createdb -O cto cto

echo "== 4/8 Claves y configuración (en $ENVF, solo legible por el servicio) =="
sec APP_SECRET "$(openssl rand -base64 32)"; sec CRON_SECRET "$(openssl rand -hex 24)"
for kv in "NODE_ENV=production" "DATABASE_URL=postgres://cto:$DBPW@127.0.0.1:5432/cto" "NEXT_PUBLIC_SITE_URL=https://$DOMINIO" "NEXT_PUBLIC_CONTACT_EMAIL=$CORREO_CONTACTO" \
  "PLATFORM_ADMIN_EMAILS=$CORREO_ADMIN" "SIGNUP_ALLOWED_EMAILS=$CORREOS_PERMITIDOS" "BILLING_ENABLED=false" "MODEL_ID=claude-sonnet-5-5" "PORT=$PORT" "HOSTNAME=127.0.0.1"; do
  k="${kv%%=*}"; grep -q "^$k=" "$ENVF" && sed -i "s|^$k=.*|$kv|" "$ENVF" || echo "$kv" >> "$ENVF"; done
grep -q '^ANTHROPIC_API_KEY=' "$ENVF" || echo "# ANTHROPIC_API_KEY=  (agrégala tú con: nano $ENVF — y las dos tarifas MODEL_*_USD_PER_MTOK)" >> "$ENVF"

echo "== 5/8 Código y compilación =="
[ -d "$APP/.git" ] && git -C "$APP" pull --ff-only || git clone "$REPO" "$APP"
chown -R cto:cto "$APP"
sudo -u cto bash -c "cd $APP && set -a && . $ENVF && set +a && npm ci --no-audit --no-fund && npm run build"

echo "== 6/8 Servicio, HTTPS y firewall =="
cat > /etc/systemd/system/cto.service <<UNIT
[Unit]
Description=Crea tu Oficina IA
After=network.target postgresql.service
[Service]
User=cto
WorkingDirectory=$APP
EnvironmentFile=$ENVF
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p $PORT
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload; systemctl enable --now cto
cat > /etc/nginx/sites-available/cto <<NGINX
server {
  listen 80; server_name $DOMINIO;
  client_max_body_size 1m;
  server_tokens off;
  location / { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto \$scheme; proxy_read_timeout 120s; }
}
NGINX
ln -sf /etc/nginx/sites-available/cto /etc/nginx/sites-enabled/cto; rm -f /etc/nginx/sites-enabled/default; nginx -t && systemctl reload nginx
certbot --nginx -d "$DOMINIO" -m "$CORREO_CERT" --agree-tos --no-eff-email --redirect -n
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo "== 7/8 Tareas programadas y respaldos =="
install -m 755 "$APP/deploy/tick.sh" /usr/local/bin/cto-tick; install -m 755 "$APP/deploy/respaldo.sh" /usr/local/bin/cto-respaldo
cat > /etc/cron.d/cto <<CRON
*/15 * * * * cto /usr/local/bin/cto-tick automatizaciones
* * * * * cto /usr/local/bin/cto-tick cola
17 3 * * * root /usr/local/bin/cto-respaldo
CRON
mkdir -p /var/backups/cto; chmod 700 /var/backups/cto

echo "== 8/8 Revisión final =="
sleep 4
sudo -u cto bash -c "cd $APP && set -a && . $ENVF && set +a && npx tsx scripts/preflight.ts" || true
curl -fsS "https://$DOMINIO/api/health" && echo && echo "✅ Listo: https://$DOMINIO  (registro cerrado, cobros apagados, sin clave de Claude todavía)"
