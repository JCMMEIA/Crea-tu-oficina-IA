#!/usr/bin/env python3
"""Convierte los retratos generados a WebP 512x512 optimizado y los deja en public/employees/<clave>.webp.
Uso: python3 scripts/employees/importar_fotos.py CARPETA_CON_IMAGENES   (archivos llamados <clave>.png|jpg|jpeg|webp)
     python3 scripts/employees/importar_fotos.py --estado               (qué empleados tienen retrato y cuáles faltan)
Sin retrato, la interfaz muestra un monograma: nunca una imagen rota."""
import re, sys, pathlib
from PIL import Image, ImageOps
ROOT = pathlib.Path(__file__).resolve().parents[2]; OUT = ROOT / "public" / "employees"
def claves():
    src = (ROOT / "src/features/employees/catalog.ts").read_text(encoding="utf-8")
    return re.findall(r'\{ key: "([a-z0-9-]+)", nombre:', src)
def estado():
    ks = claves(); ok = [k for k in ks if (OUT / f"{k}.webp").exists()]
    print(f"{len(ok)}/{len(ks)} retratos presentes"); [print("  falta:", k) for k in ks if k not in ok]
def importar(carpeta):
    OUT.mkdir(parents=True, exist_ok=True); ks = set(claves()); hechas = 0
    for f in sorted(pathlib.Path(carpeta).iterdir()):
        if f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp") or f.stem not in ks: print("omitido:", f.name); continue
        im = ImageOps.fit(ImageOps.exif_transpose(Image.open(f)).convert("RGB"), (512, 512), Image.LANCZOS, centering=(0.5, 0.35))
        dest = OUT / f"{f.stem}.webp"; im.save(dest, "WEBP", quality=82, method=6)
        print(f"ok {f.stem}: {dest.stat().st_size // 1024} KB"); hechas += 1
    print(f"{hechas} retratos importados. Reinicia el servidor de Next para que sirva los archivos nuevos de public/.")
if __name__ == "__main__":
    if len(sys.argv) != 2: sys.exit(__doc__)
    estado() if sys.argv[1] == "--estado" else importar(sys.argv[1])
