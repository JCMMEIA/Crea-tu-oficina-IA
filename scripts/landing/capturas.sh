#!/usr/bin/env bash
# Regenera las imágenes de la landing (public/landing/*.webp) desde el panel en modo demostración. Requiere el servidor en PORT=3115 (npm run build && npx next start -p 3115).
set -euo pipefail; cd "$(dirname "$0")/../.."; PNG=/var/tmp/landing_png; rm -rf "$PNG"
NODE_PATH="$(npm root -g)" node scripts/landing/capturas.cjs "${1:-http://127.0.0.1:3115}" "$PNG"
python3 - <<PY
from PIL import Image; import os
src="$PNG"
for f in sorted(os.listdir(src)):
    n=f[:-4]; im=Image.open(f"{src}/{f}").convert("RGB")
    if n=="inicio": im.save("public/landing/panel.webp","WEBP",quality=82,method=6)            # hero (1120x700)
    t=im.resize((800,500),Image.LANCZOS); t.save(f"public/landing/vista-{n}.webp","WEBP",quality=78,method=6)
print("webp listos:", sorted(os.listdir("public/landing")))
PY
