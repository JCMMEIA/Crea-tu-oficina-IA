#!/usr/bin/env bash
# NO APLICA NADA. Solo muestra qué reglas harían falta para HTTPS y por qué, para que las revises y las autorices una por una.
set -uo pipefail; . "$(dirname "$0")/lib.sh"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "ufw está ACTIVO. Reglas actuales:"; ufw status numbered | sed 's/^/   /'
  for p in 80 443; do ufw status | grep -qE "^$p(/tcp)?\s+ALLOW" || echo "   Falta permitir el puerto $p →  sudo ufw allow $p/tcp   (permite visitas web; no cambia ninguna regla existente)"; done
  echo "NO ejecutes 'ufw enable', 'ufw reset' ni 'ufw default deny' sin revisar OpenClaw: podrían cortar su acceso."
else
  echo "ufw está inactivo o no instalado: el servidor no filtra con ufw. NO lo activamos (podría cortar OpenClaw o tu acceso SSH)."
  echo "Revisa en hPanel (Hostinger → VPS → Seguridad → Firewall) que 80 y 443 estén permitidos para el mundo."
fi
echo "Los puertos 3100 (aplicación) y 5432 (PostgreSQL) escuchan SOLO en 127.0.0.1: no se abren al exterior."
