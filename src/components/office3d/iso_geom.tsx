import React from "react";
/** Geometría isométrica compartida por la vista 2D y su decoración. Sin hooks: sirve en el servidor. */
export const S = 34;
export const proj = (x: number, z: number, y = 0) => ({ px: (x - z) * S * 0.866, py: (x + z) * S * 0.5 - y * S });
export const P = (pts: { px: number; py: number }[]) => pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
export const shade = (hex: string, f: number) => { const n = parseInt(hex.slice(1), 16); const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`; };
export function Box({ x, z, w, d, h, y0 = 0, color }: { x: number; z: number; w: number; d: number; h: number; y0?: number; color: string }) {
  const [x1, x2, z1, z2] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2], y1 = y0 + h;
  return (<g>
    <polygon points={P([proj(x1, z2, y0), proj(x2, z2, y0), proj(x2, z2, y1), proj(x1, z2, y1)])} fill={shade(color, 0.82)} />
    <polygon points={P([proj(x2, z1, y0), proj(x2, z2, y0), proj(x2, z2, y1), proj(x2, z1, y1)])} fill={shade(color, 0.66)} />
    <polygon points={P([proj(x1, z1, y1), proj(x2, z1, y1), proj(x2, z2, y1), proj(x1, z2, y1)])} fill={color} />
  </g>);
}
/** Pseudoaleatorio determinista (misma entrada → misma salida): la escena no «parpadea» entre renderizados. */
export const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return Math.round((v - Math.floor(v)) * 1000) / 1000; }; // redondeado: servidor y navegador dibujan EXACTAMENTE lo mismo (sin avisos de hidratación)
