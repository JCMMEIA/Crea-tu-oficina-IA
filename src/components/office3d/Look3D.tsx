"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeScene, ThemeLook } from "@/server/office3d/types";
import { placeDecor, DecorItem } from "@/server/office3d/design";
import { rnd } from "./iso_geom";

const M = ({ c, e = 0, o = 1 }: { c: string; e?: number; o?: number }) => <meshStandardMaterial color={c} emissive={e ? c : "#000000"} emissiveIntensity={e} roughness={0.7} transparent={o < 1} opacity={o} />;
const Box = ({ p, s, c, e, o }: { p: [number, number, number]; s: [number, number, number]; c: string; e?: number; o?: number }) => <mesh position={p}><boxGeometry args={s} /><M c={c} e={e} o={o} /></mesh>;

/** Hace flotar un grupo suavemente. Solo existe si el movimiento está activo (si no, no hay bucle de animación). */
function Float({ children, y = 0, i = 0, amp = 0.12 }: { children: React.ReactNode; y?: number; i?: number; amp?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.1 + i) * amp; });
  return <group ref={ref} position={[0, y, 0]}>{children}</group>;
}

function DecorMesh({ it, look }: { it: DecorItem; look: ThemeLook }) {
  const a = look.accent, b = look.accent2, e = look.fx.lights ? 0.9 : 0.15, mv = look.fx.motion;
  const fl = (y: number, node: React.ReactNode) => (mv ? <Float y={y} i={it.i}>{node}</Float> : <group position={[0, y, 0]}>{node}</group>);
  let body: React.ReactNode = null;
  switch (it.kind) {
    case "plant": body = <><mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.16, 0.12, 0.36, 10]} /><M c="#a8a29e" /></mesh><mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.3, 10, 8]} /><M c="#4d7c0f" /></mesh></>; break;
    case "blocks": body = <><Box p={[0, 0.22, 0]} s={[0.9, 0.45, 0.9]} c={a} /><Box p={[0.05, 0.68, 0]} s={[0.7, 0.45, 0.7]} c={b} /><Box p={[0, 1.1, 0]} s={[0.5, 0.4, 0.5]} c="#e63946" /></>; break;
    case "neon": body = <><Box p={[0, 0.95, 0]} s={[0.12, 1.9, 0.12]} c="#111827" /><Box p={[0, 1.0, 0.08]} s={[0.05, 1.5, 0.05]} c={a} e={e} /></>; break;
    case "holo": body = fl(1.2, <Box p={[0, 0, 0]} s={[0.9, 1.3, 0.04]} c={b} e={e * 0.6} o={0.4} />); break;
    case "star": body = fl(1.7, <mesh><octahedronGeometry args={[0.22]} /><M c={a} e={e} /></mesh>); break;
    case "tower": body = <><Box p={[0, 0.75, 0]} s={[0.8, 1.5, 0.8]} c="#e9defa" /><mesh position={[0, 2.0, 0]}><coneGeometry args={[0.55, 1, 4]} /><M c={b} /></mesh></>; break;
    case "crystal": body = fl(1.0, <mesh><octahedronGeometry args={[0.4]} /><M c={b} e={e * 0.7} o={0.9} /></mesh>); break;
    case "cactus": body = <><Box p={[0, 0.6, 0]} s={[0.3, 1.2, 0.3]} c="#3f9d4a" /><Box p={[-0.3, 0.75, 0]} s={[0.2, 0.5, 0.2]} c="#3f9d4a" /><Box p={[0.3, 0.9, 0]} s={[0.2, 0.4, 0.2]} c="#3f9d4a" /></>; break;
    case "flask": body = <><mesh position={[0, 0.4, 0]}><coneGeometry args={[0.35, 0.8, 12]} /><M c="#e0f2f1" o={0.6} /></mesh><mesh position={[0, 0.15, 0]}><coneGeometry args={[0.25, 0.3, 12]} /><M c={a} e={e * 0.6} /></mesh></>; break;
    case "coral": body = <><mesh position={[0, 0.35, 0]}><sphereGeometry args={[0.35, 10, 8]} /><M c="#ff6f91" /></mesh><mesh position={[-0.3, 0.25, 0.1]}><sphereGeometry args={[0.22, 10, 8]} /><M c="#ffb347" /></mesh></>; break;
    case "bubble": body = <>{[0, 1, 2].map((k) => <group key={k}>{fl(0.9 + k * 0.5, <mesh position={[(k - 1) * 0.2, 0, 0]}><sphereGeometry args={[0.2 - k * 0.04, 12, 10]} /><M c="#ffffff" o={0.4} /></mesh>)}</group>)}</>; break;
    case "palm": body = <><mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.08, 0.12, 1.7, 8]} /><M c="#9a6b3b" /></mesh>{[0, 1, 2, 3].map((k) => <mesh key={k} position={[Math.cos(k * 1.57) * 0.4, 1.75, Math.sin(k * 1.57) * 0.4]} rotation={[0, -k * 1.57, 0.5]}><boxGeometry args={[0.9, 0.03, 0.3]} /><M c="#2f9e44" /></mesh>)}</>; break;
    case "dish": body = <><Box p={[0, 0.6, 0]} s={[0.1, 1.2, 0.1]} c="#64748b" /><mesh position={[0, 1.3, 0]} rotation={[0.7, 0, 0]}><cylinderGeometry args={[0.45, 0.1, 0.12, 16]} /><M c="#f8fafc" /></mesh><mesh position={[0.2, 1.5, 0.2]}><sphereGeometry args={[0.05, 8, 6]} /><M c="#22c55e" e={e} /></mesh></>; break;
    case "column": body = <><Box p={[0, 1.25, 0]} s={[0.55, 2.5, 0.55]} c="#f1ece0" /><Box p={[0, 2.6, 0]} s={[0.75, 0.2, 0.75]} c="#e2dccb" /></>; break;
    case "fountain": body = <><mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.8, 0.9, 0.3, 20]} /><M c="#cbd5e1" /></mesh><mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.7, 0.7, 0.05, 20]} /><M c="#9bdcf0" e={e * 0.3} /></mesh><mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.05, 0.08, 1, 8]} /><M c="#e0f7ff" o={0.7} /></mesh></>; break;
    case "sofa": body = <><Box p={[0, 0.25, 0]} s={[1.7, 0.5, 0.7]} c={b} /><Box p={[0, 0.65, -0.3]} s={[1.7, 0.5, 0.2]} c={b} /></>; break;
    case "lamp": body = <><Box p={[0, 0.9, 0]} s={[0.08, 1.8, 0.08]} c="#475569" /><mesh position={[0, 1.9, 0]}><sphereGeometry args={[0.2, 12, 10]} /><M c={look.lightColor} e={e} /></mesh></>; break;
  }
  return <group position={[it.x, 0, it.z]}>{body}</group>;
}

export function Decor3D({ look, scene }: { look: ThemeLook; scene: OfficeScene }) {
  return <>{placeDecor(look, scene.bounds).map((it) => <DecorMesh key={it.i} it={it} look={look} />)}</>;
}

/** Fondo de escena (solo «ambiente inmersivo»): dos paredes con ventanales y siluetas. Pocas mallas: ligero. */
export function Backdrop3D({ look, scene }: { look: ThemeLook; scene: OfficeScene }) {
  if (!look.backdrop || !look.fx.immersive) return null;
  const hw = scene.bounds.w / 2 + look.margin, hd = scene.bounds.d / 2 + look.margin, H = 3.3, wall = scene.theme.wall;
  const wallSet = (len: number, seed: number) => {
    const n = Math.max(2, Math.round(len / 4)), out: React.ReactNode[] = [];
    out.push(<mesh key="w" position={[0, H / 2, 0]}><boxGeometry args={[len, H, 0.12]} /><M c={wall} /></mesh>);
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + ((i + 0.5) / n) * len, w = len / n - 0.7;
      const hall = look.backdrop === "hall";
      out.push(<mesh key={`v${i}`} position={[cx, 1.9, 0.08]}><boxGeometry args={[w, 2.3, 0.05]} /><M c={hall ? "#0f172a" : look.skyTo} e={hall ? 0 : 0.55} /></mesh>);
      if (hall) out.push(<mesh key={`l${i}`} position={[cx, 1.9, 0.12]}><boxGeometry args={[w * 0.7, 0.05, 0.02]} /><M c={look.accent2} e={look.fx.lights ? 1 : 0.2} /></mesh>);
      else if (look.backdrop === "skyline" || look.backdrop === "night") for (let j = 0; j < 3; j++) { const bh = 0.5 + rnd(seed + i * 7 + j) * 1.2; out.push(<mesh key={`b${i}-${j}`} position={[cx - w / 3 + (j * w) / 3, 0.75 + bh / 2, 0.12]}><boxGeometry args={[w / 3 - 0.08, bh, 0.03]} /><M c={look.backdrop === "night" ? "#1c1b3a" : "#6f8fb8"} /></mesh>); }
      else if (look.backdrop === "sea") out.push(<mesh key={`m${i}`} position={[cx, 1.2, 0.12]}><boxGeometry args={[w, 0.7, 0.02]} /><M c="#1b79b8" /></mesh>);
      else if (look.backdrop === "garden") out.push(<mesh key={`g${i}`} position={[cx, 1.2, 0.12]}><boxGeometry args={[w, 0.7, 0.02]} /><M c="#7bc67b" /></mesh>);
    }
    return out;
  };
  return (<group>
    <group position={[0, 0, -hd]}>{wallSet(hw * 2, 1)}</group>
    <group position={[-hw, 0, 0]} rotation={[0, Math.PI / 2, 0]}>{wallSet(hd * 2, 40)}</group>
  </group>);
}
