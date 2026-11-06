import React from "react";
import type { OfficeScene, ThemeLook } from "@/server/office3d/types";
import { placeDecor, DecorItem } from "@/server/office3d/design";
import { Box, P, proj, rnd, shade } from "./iso_geom";

type Pt = { px: number; py: number };
const poly = (pts: Pt[], fill: string, extra: React.SVGProps<SVGPolygonElement> & { key?: string } = {}) => { const { key, ...rest } = extra; return <polygon key={key} points={P(pts)} fill={fill} {...rest} />; };
export const gradId = (k: string, n: string) => `pz-${n}-${k.replace(/[^a-z0-9]/gi, "")}`;
const glow = (look: ThemeLook) => (look.fx.lights ? (look.fx.motion ? "pz-glow" : "pz-lit") : undefined);
const floaty = (look: ThemeLook) => (look.fx.motion ? "pz-float" : undefined);

/** Degradados del cielo/mar que usan las paredes. */
export function LookDefs({ look, k }: { look: ThemeLook; k: string }) {
  return (<defs>
    <linearGradient id={gradId(k, "sky")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={look.skyFrom} /><stop offset="1" stopColor={look.skyTo} /></linearGradient>
    <linearGradient id={gradId(k, "sea")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#52c1e8" /><stop offset="1" stopColor="#1b79b8" /></linearGradient>
  </defs>);
}

/** Dos paredes traseras con ventanales (o pantallas, en el salón grande). Solo con «ambiente inmersivo». */
export function Backdrop2D({ look, scene, k }: { look: ThemeLook; scene: OfficeScene; k: string }) {
  if (!look.backdrop || !look.fx.immersive) return null;
  const hw = scene.bounds.w / 2 + look.margin, hd = scene.bounds.d / 2 + look.margin, H = 3.3;
  const wallCol = scene.theme.wall, g = glow(look);
  const wall = (len: number, pt: (u: number, y: number) => Pt, seed: number) => {
    const n = Math.max(2, Math.round(len / 4)), nodes: React.ReactNode[] = [];
    nodes.push(poly([pt(-len / 2, 0), pt(len / 2, 0), pt(len / 2, H), pt(-len / 2, H)], shade(wallCol, 0.92), { key: "w" }));
    for (let i = 0; i < n; i++) {
      const a = -len / 2 + (i / n) * len + 0.35, b = -len / 2 + ((i + 1) / n) * len - 0.35, y0 = 0.7, y1 = 3;
      const win = [pt(a, y0), pt(b, y0), pt(b, y1), pt(a, y1)];
      if (look.backdrop === "hall") {
        nodes.push(poly(win, "#0f172a", { key: `s${i}`, stroke: look.accent, strokeWidth: 1.2 }));
        nodes.push(<polyline key={`l${i}`} className={g} points={P([pt(a + 0.3, 2.3), pt((a + b) / 2, 1.7), pt(b - 0.5, 2.5)])} fill="none" stroke={look.accent2} strokeWidth={2} opacity={0.8} />);
        continue;
      }
      nodes.push(poly(win, `url(#${gradId(k, "sky")})`, { key: `v${i}`, stroke: shade(wallCol, 0.6), strokeWidth: 1.5 }));
      if (look.backdrop === "skyline" || look.backdrop === "night") {
        const m = 4;
        for (let j = 0; j < m; j++) {
          const ba = a + ((b - a) / m) * j + 0.05, bb = a + ((b - a) / m) * (j + 1) - 0.1, bh = y0 + 0.5 + rnd(seed + i * 9 + j) * 1.4;
          nodes.push(poly([pt(ba, y0), pt(bb, y0), pt(bb, bh), pt(ba, bh)], look.backdrop === "night" ? "#1c1b3a" : "#6f8fb8", { key: `b${i}-${j}`, opacity: 0.9 }));
          if (look.backdrop === "night") { const c = pt((ba + bb) / 2, bh - 0.3); nodes.push(<circle key={`d${i}-${j}`} cx={c.px} cy={c.py} r={1.6} fill="#ffd166" className={g} />); }
        }
      } else if (look.backdrop === "garden") {
        nodes.push(poly([pt(a, y0), pt(b, y0), pt(b, y0 + 0.7), pt(a, y0 + 0.7)], "#7bc67b", { key: `g${i}` }));
        const c = pt((a + b) / 2, y0 + 1.1); nodes.push(<circle key={`t${i}`} cx={c.px} cy={c.py} r={9} fill="#3f9d4a" />);
      } else if (look.backdrop === "sea") {
        nodes.push(poly([pt(a, y0), pt(b, y0), pt(b, y0 + 0.9), pt(a, y0 + 0.9)], `url(#${gradId(k, "sea")})`, { key: `m${i}` }));
        if (i === 0) { const c = pt((a + b) / 2, 2.4); nodes.push(<circle key="sun" cx={c.px} cy={c.py} r={7} fill="#ffe28a" />); }
      }
    }
    return nodes;
  };
  return (<g aria-hidden="true" data-testid="iso-backdrop">
    <g>{wall(hw * 2, (u, y) => proj(u, -hd, y), 1)}</g>
    <g>{wall(hd * 2, (u, y) => proj(-hw, u, y), 40)}</g>
  </g>);
}

/** Patrón del piso (el piso como material). Cantidades acotadas para que siga siendo ligero. */
export function FloorPattern2D({ look, scene }: { look: ThemeLook; scene: OfficeScene }) {
  if (look.pattern === "none") return null;
  const hw = scene.bounds.w / 2 + look.margin, hd = scene.bounds.d / 2 + look.margin, out: React.ReactNode[] = [], line = shade(scene.theme.wall, 0.8);
  if (look.pattern === "tiles" || look.pattern === "grid") {
    const st = look.pattern === "grid" ? 2 : 2.5;
    for (let x = -hw + st; x < hw; x += st) out.push(<polyline key={`x${x}`} points={P([proj(x, -hd), proj(x, hd)])} stroke={line} strokeWidth={0.8} opacity={0.35} fill="none" />);
    for (let z = -hd + st; z < hd; z += st) out.push(<polyline key={`z${z}`} points={P([proj(-hw, z), proj(hw, z)])} stroke={line} strokeWidth={0.8} opacity={0.35} fill="none" />);
  } else if (look.pattern === "planks") {
    for (let z = -hd + 0.9; z < hd; z += 0.9) out.push(<polyline key={z} points={P([proj(-hw, z), proj(hw, z)])} stroke={line} strokeWidth={0.8} opacity={0.4} fill="none" />);
  } else if (look.pattern === "marble") {
    const st = 3;
    for (let x = -hw, i = 0; x < hw; x += st, i++) for (let z = -hd, j = 0; z < hd; z += st, j++) if ((i + j) % 2 === 0) out.push(poly([proj(x, z), proj(Math.min(hw, x + st), z), proj(Math.min(hw, x + st), Math.min(hd, z + st)), proj(x, Math.min(hd, z + st))], "#ffffff", { key: `${i}-${j}`, opacity: 0.22 }));
  } else if (look.pattern === "studs") {
    const st = Math.max(1.6, Math.sqrt((hw * 2 * hd * 2) / 160));
    for (let x = -hw + st / 2; x < hw; x += st) for (let z = -hd + st / 2; z < hd; z += st) { const p = proj(x, z); out.push(<ellipse key={`${x}-${z}`} cx={p.px} cy={p.py} rx={5} ry={2.6} fill="#ffffff" opacity={0.35} />); }
  } else {
    for (let i = 0; i < 50; i++) { const p = proj(-hw + rnd(i) * hw * 2, -hd + rnd(i + 99) * hd * 2); out.push(look.pattern === "sand" ? <circle key={i} cx={p.px} cy={p.py} r={1.4} fill={shade(scene.theme.wall, 0.85)} opacity={0.35} /> : <path key={i} d={`M${p.px - 6} ${p.py} q3 -3 6 0 t6 0`} stroke="#ffffff" strokeWidth={1.2} fill="none" opacity={0.55} />); }
  }
  return <g aria-hidden="true">{out}</g>;
}

function Decor({ it, look }: { it: DecorItem; look: ThemeLook }) {
  const { x, z } = it, a = look.accent, b = look.accent2, g = glow(look), f = floaty(look), p = proj(x, z), top = (y: number) => proj(x, z, y);
  switch (it.kind) {
    case "plant": return (<g><Box x={x} z={z} w={0.4} d={0.4} h={0.35} color="#a8a29e" /><circle cx={top(0.8).px} cy={top(0.8).py} r={10} fill="#4d7c0f" /><circle cx={top(1.05).px + 4} cy={top(1.05).py} r={6} fill="#65a30d" /></g>);
    case "blocks": return (<g><Box x={x} z={z} w={0.9} d={0.9} h={0.45} color={a} /><Box x={x + 0.1} z={z} w={0.7} d={0.7} h={0.45} y0={0.45} color={b} /><Box x={x} z={z} w={0.5} d={0.5} h={0.4} y0={0.9} color="#e63946" /></g>);
    case "neon": return (<g><Box x={x} z={z} w={0.14} d={0.14} h={1.9} color="#111827" /><line className={g} x1={top(0.2).px} y1={top(0.2).py} x2={top(1.8).px} y2={top(1.8).py} stroke={a} strokeWidth={3} strokeLinecap="round" opacity={0.9} /></g>);
    case "holo": return (<g className={f}>{poly([proj(x - 0.5, z, 0.6), proj(x + 0.5, z, 0.6), proj(x + 0.5, z, 1.9), proj(x - 0.5, z, 1.9)], b, { opacity: 0.28, stroke: b, strokeWidth: 1.2 })}<polyline className={g} points={P([proj(x - 0.3, z, 1.0), proj(x, z, 1.5), proj(x + 0.3, z, 1.2)])} fill="none" stroke={b} strokeWidth={1.6} /></g>);
    case "star": return (<g className={f}><path className={g} d={`M${top(1.7).px} ${top(1.7).py - 9} l2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5z`} fill={a} /></g>);
    case "tower": return (<g><Box x={x} z={z} w={0.8} d={0.8} h={1.5} color="#e9defa" /><polygon points={P([proj(x - 0.5, z + 0.5, 1.5), proj(x + 0.5, z + 0.5, 1.5), proj(x, z, 2.5)])} fill={b} /><circle cx={top(2.5).px} cy={top(2.5).py - 3} r={2.5} className={g} fill={a} /></g>);
    case "crystal": return (<g className={f}><polygon className={g} points={P([top(0.2), proj(x + 0.35, z, 0.9), top(1.6), proj(x - 0.35, z, 0.9)])} fill={b} opacity={0.88} /></g>);
    case "cactus": return (<g><Box x={x} z={z} w={0.3} d={0.3} h={1.2} color="#3f9d4a" /><Box x={x - 0.3} z={z} w={0.22} d={0.22} h={0.5} y0={0.5} color="#3f9d4a" /><Box x={x + 0.3} z={z} w={0.22} d={0.22} h={0.4} y0={0.7} color="#3f9d4a" /></g>);
    case "flask": return (<g><polygon points={P([proj(x, z, 0.9), proj(x - 0.35, z, 0.1), proj(x + 0.35, z, 0.1)])} fill="#e0f2f1" opacity={0.7} stroke="#94a3b8" strokeWidth={1} /><polygon className={g} points={P([proj(x - 0.2, z, 0.35), proj(x + 0.2, z, 0.35), proj(x + 0.35, z, 0.1), proj(x - 0.35, z, 0.1)])} fill={a} opacity={0.95} /><Box x={x} z={z} w={0.12} d={0.12} h={0.35} y0={0.85} color="#94a3b8" /></g>);
    case "coral": return (<g><circle cx={top(0.4).px} cy={top(0.4).py} r={9} fill="#ff6f91" /><circle cx={top(0.7).px - 8} cy={top(0.7).py} r={6} fill="#ffb347" /><circle cx={top(0.8).px + 8} cy={top(0.8).py + 2} r={6} fill="#ff8fa3" /></g>);
    case "bubble": return (<g className={f}>{[0, 1, 2].map((i) => <circle key={i} cx={top(0.9 + i * 0.55).px + (i - 1) * 6} cy={top(0.9 + i * 0.55).py} r={7 - i * 1.6} fill="#ffffff" opacity={0.35} stroke="#ffffff" strokeWidth={1} />)}</g>);
    case "palm": return (<g><Box x={x} z={z} w={0.2} d={0.2} h={1.7} color="#9a6b3b" />{[-1, 0, 1].map((i) => <ellipse key={i} cx={top(1.9).px + i * 11} cy={top(1.9).py + Math.abs(i) * 3} rx={13} ry={4} fill="#2f9e44" transform={`rotate(${i * 28} ${top(1.9).px + i * 11} ${top(1.9).py})`} />)}</g>);
    case "dish": return (<g><Box x={x} z={z} w={0.12} d={0.12} h={1.2} color="#64748b" /><ellipse cx={top(1.4).px} cy={top(1.4).py} rx={11} ry={7} fill="#f8fafc" stroke="#94a3b8" transform={`rotate(-25 ${top(1.4).px} ${top(1.4).py})`} /><circle className={g} cx={top(1.55).px + 6} cy={top(1.55).py - 4} r={2} fill="#22c55e" /></g>);
    case "column": return (<g><Box x={x} z={z} w={0.55} d={0.55} h={2.5} color="#f1ece0" /><Box x={x} z={z} w={0.75} d={0.75} h={0.2} y0={2.5} color="#e2dccb" /></g>);
    case "fountain": return (<g><ellipse cx={p.px} cy={p.py} rx={24} ry={12} fill="#9bdcf0" stroke="#cbd5e1" strokeWidth={3} /><line className={g} x1={p.px} y1={p.py} x2={p.px} y2={p.py - 26} stroke="#e0f7ff" strokeWidth={3} strokeLinecap="round" /><circle cx={p.px} cy={p.py - 28} r={3} fill="#e0f7ff" /></g>);
    case "sofa": return (<g><Box x={x} z={z} w={1.7} d={0.7} h={0.45} color={b} /><Box x={x} z={z - 0.3} w={1.7} d={0.2} h={0.5} y0={0.45} color={b} /></g>);
    case "lamp": return (<g><Box x={x} z={z} w={0.1} d={0.1} h={1.8} color="#475569" /><circle className={g} cx={top(1.9).px} cy={top(1.9).py} r={9} fill={look.lightColor} opacity={0.85} /></g>);
    default: return null;
  }
}
/** Decoración como elementos con profundidad, para mezclarla con escritorios y zonas (orden correcto al dibujar). */
export function decor2DItems(look: ThemeLook, scene: OfficeScene): { depth: number; node: React.ReactNode }[] {
  return placeDecor(look, scene.bounds).map((it) => ({ depth: it.x + it.z, node: <g key={`decor-${it.i}`} aria-hidden="true" data-testid="iso-decor"><Decor it={it} look={look} /></g> }));
}
