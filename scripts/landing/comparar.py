# Compone las imágenes comparativas: referencia (arriba) vs implementación (abajo), a la misma anchura.
from PIL import Image, ImageDraw, ImageFont
import os
D = "docs/diseno"; C = D + "/capturas"
ref = Image.open(D + "/referencia.webp").convert("RGB"); imp = Image.open(C + "/abierta-escritorio-arriba.png").convert("RGB")
try: f = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 26)
except Exception: f = ImageFont.load_default()
def etiqueta(im, t):
    im = im.copy(); d = ImageDraw.Draw(im); d.rectangle((0, 0, 560, 44), fill=(124, 77, 255)); d.text((14, 8), t, fill="white", font=f); return im
w = 1672; r = ref.resize((w, int(ref.height * w / ref.width))); i = imp.resize((w, int(imp.height * w / imp.width)))
sheet = Image.new("RGB", (w, r.height + i.height + 8), (255, 255, 255)); sheet.paste(etiqueta(r, "REFERENCIA"), (0, 0)); sheet.paste(etiqueta(i, "IMPLEMENTACIÓN (primera pantalla)"), (0, r.height + 8)); sheet.save(C + "/comparacion-escritorio.png")
# hero (laptop) lado a lado
rh = ref.crop((780, 50, 1500, 400)); ih = imp.crop((850, 150, 1572, 620)); ih = ih.resize((rh.width, int(ih.height * rh.width / ih.width)))
s2 = Image.new("RGB", (rh.width * 2 + 8, max(rh.height, ih.height)), (255, 255, 255)); s2.paste(etiqueta(rh, "REFERENCIA"), (0, 0)); s2.paste(etiqueta(ih, "IMPLEMENTACIÓN"), (rh.width + 8, 0)); s2.save(C + "/comparacion-laptop.png")
print("comparaciones:", [x for x in os.listdir(C) if x.startswith("comparacion")])
