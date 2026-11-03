#!/usr/bin/env bash
# Actualizar a la última versión (como root): respalda, baja el código, compila, reinicia y revisa.
set -euo pipefail; APP=/opt/cto; /usr/local/bin/cto-respaldo
git -C "$APP" pull --ff-only; chown -R cto:cto "$APP"
sudo -u cto bash -c "cd $APP && set -a && . /etc/cto/env && set +a && npm ci --no-audit --no-fund && npm run build"
systemctl restart cto; sleep 4; curl -fsS "http://127.0.0.1:3000/api/health" && echo " ✅ actualizado"
