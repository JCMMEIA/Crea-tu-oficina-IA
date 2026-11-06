"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Desk, OfficeScene, ThemeLook, Zone } from "@/server/office3d/types";
import type { Sel } from "./iso";
import { Backdrop3D, Decor3D } from "./Look3D";

const statusRing: Record<Desk["status"], string> = { active: "#16a34a", paused: "#d97706", inactive: "#9ca3af" };

function Avatar({ color, status }: { color: string; status: Desk["status"] }) {
  const c = status === "active" ? color : status === "paused" ? "#9ca3af" : "#6b7280";
  return (<group position={[0, 0, 0.62]}>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.26, 0.34, 24]} /><meshBasicMaterial color={statusRing[status]} /></mesh>
    <mesh position={[0, 0.5, 0]}><capsuleGeometry args={[0.2, 0.42, 4, 10]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>
    <mesh position={[0, 1.02, 0]}><sphereGeometry args={[0.17, 14, 12]} /><meshStandardMaterial color="#fcd9b6" roughness={0.8} /></mesh>
  </group>);
}
function DeskMesh({ look, d, color, selected, hovered, onSelect, onHover, labels }: { look?: ThemeLook; labels: React.RefObject<HTMLDivElement | null>; d: Desk; color: string; selected: boolean; hovered: boolean; onSelect: () => void; onHover: (h: boolean) => void }) {
  const s = selected || hovered ? 1.07 : 1;
  return (
    <group position={[d.x, 0, d.z]} scale={s}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = ""; }}>
      <mesh position={[0, 0.7, -0.1]}><boxGeometry args={[1.2, 0.07, 0.7]} /><meshStandardMaterial color="#e5e1d8" roughness={0.7} /></mesh>
      <mesh position={[0, 0.35, -0.1]}><boxGeometry args={[1.1, 0.68, 0.6]} /><meshStandardMaterial color="#cfcac0" roughness={0.8} /></mesh>
      <mesh position={[0, 1.0, -0.3]}><boxGeometry args={[0.55, 0.36, 0.04]} /><meshStandardMaterial color={look?.screen ?? "#1f2937"} emissive={selected ? color : look?.fx.lights ? look.screen : "#0b1220"} emissiveIntensity={selected ? 0.6 : 0.25} /></mesh>
      <mesh position={[0, 0.8, -0.3]}><boxGeometry args={[0.08, 0.1, 0.06]} /><meshStandardMaterial color="#475569" /></mesh>
      <Avatar color={color} status={d.status} />
      {(selected || hovered) && <Html portal={labels as React.RefObject<HTMLElement>} position={[0, 1.55, 0.62]} center style={{ pointerEvents: "none" }}><div className="o3d-tag">{d.label}</div></Html>}
    </group>
  );
}
function ZoneMesh({ look, z, selected, hoveredDesk, selDesk, onSelectZone, onSelectDesk, onHoverDesk, labels }: { look?: ThemeLook; labels: React.RefObject<HTMLDivElement | null>; z: Zone; selected: boolean; hoveredDesk: string | null; selDesk: string | null; onSelectZone: () => void; onSelectDesk: (id: string) => void; onHoverDesk: (id: string | null) => void }) {
  return (
    <group>
      <mesh position={[z.x, 0.06, z.z]} onClick={(e) => { e.stopPropagation(); onSelectZone(); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <boxGeometry args={[z.w, 0.12, z.d]} /><meshStandardMaterial color={z.color} transparent opacity={selected ? 0.55 : 0.28} roughness={0.9} />
        <Edges color={z.color} lineWidth={selected ? 3 : 1.5} />
      </mesh>
      <Html portal={labels as React.RefObject<HTMLElement>} position={[z.x - z.w / 2 + 0.1, 0.25, z.z - z.d / 2]} style={{ pointerEvents: "none", transform: "translate(0,-100%)" }}>
        <div className="o3d-label" style={{ borderColor: z.color }}>{z.icon} {z.label} · {z.desks.length}{z.status === "needs_setup" ? " 🔧" : z.status === "empty" ? " 🪑" : " ✓"}</div>
      </Html>
      {z.desks.map((d) => <DeskMesh key={d.id} look={look} d={d} color={z.color} selected={selDesk === d.id} hovered={hoveredDesk === d.id} onSelect={() => onSelectDesk(d.id)} onHover={(h) => onHoverDesk(h ? d.id : null)} labels={labels} />)}
    </group>
  );
}
function Reception({ scene, labels }: { scene: OfficeScene; labels: React.RefObject<HTMLDivElement | null> }) {
  const R = scene.reception;
  return (<group position={[R.x, 0, R.z]}>
    <mesh position={[0, 0.04, 0]}><boxGeometry args={[R.w, 0.08, R.d]} /><meshStandardMaterial color={scene.brand.color} transparent opacity={0.25} /><Edges color={scene.brand.color} /></mesh>
    <mesh position={[0, 0.45, 0.25]}><boxGeometry args={[R.w * 0.6, 0.8, 0.7]} /><meshStandardMaterial color={scene.brand.color} roughness={0.5} /></mesh>
    <mesh position={[0, 1.2, -0.5]}><boxGeometry args={[R.w * 0.55, 0.9, 0.08]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>
    <Html portal={labels as React.RefObject<HTMLElement>} position={[0, 1.2, -0.44]} center style={{ pointerEvents: "none" }}>
      <div className="o3d-sign" style={{ color: scene.brand.color }}>{scene.brand.logo && <img src={scene.brand.logo} alt="" />}<b>{scene.brand.name}</b></div>
    </Html>
  </group>);
}
function Plant({ x, z }: { x: number; z: number }) {
  return (<group position={[x, 0, z]}><mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.16, 0.12, 0.36, 10]} /><meshStandardMaterial color="#a8a29e" /></mesh><mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.3, 10, 8]} /><meshStandardMaterial color="#4d7c0f" roughness={0.9} /></mesh></group>);
}
/** Expone la posición en pantalla de cada elemento (diagnóstico y pruebas E2E). Sin efectos en la app. */
function Probe({ scene }: { scene: OfficeScene }) {
  const { camera, gl, size } = useThree();
  useEffect(() => {
    const pos = new Map<string, [number, number, number]>();
    for (const z of scene.zones) { pos.set(z.id, [z.x, 0.13, z.z + z.d / 2 - 0.25]); for (const d of z.desks) pos.set(d.id, [d.x, 0.8, d.z + 0.62]); }
    (window as any).__office3d = { ready: true, project(id: string) { const p = pos.get(id); if (!p) return null; const v = new THREE.Vector3(...p).project(camera); const r = gl.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; }, size: { w: size.width, h: size.height } };
    return () => { delete (window as any).__office3d; };
  }, [scene, camera, gl, size]);
  return null;
}

/**
 * Animación ligera: en lugar de un bucle continuo a 60 fps, pide un cuadro cada 40 ms (≈25 fps) y SOLO si el movimiento está activo y la pestaña es visible.
 * Sin movimiento no hay temporizador: el lienzo no dibuja nada hasta que la persona lo mueva.
 */
function Ticker({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (!document.hidden) invalidate(); }, 40);
    return () => clearInterval(t);
  }, [active, invalidate]);
  return null;
}

/** Ajusta la distancia inicial para que TODA la oficina quepa según la proporción del lienzo (pantallas verticales: más lejos). */
function FitCamera({ base, halfExtent }: { base: [number, number, number]; halfExtent: number }) {
  const { camera, size, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as { update?: () => void } | null;
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const baseDist = Math.hypot(...base), tan = Math.tan(THREE.MathUtils.degToRad(38 / 2));
    const k = Math.min(3.5, Math.max(1, halfExtent / (tan * Math.min(aspect, 1.6) * baseDist)));
    camera.position.set(base[0] * k, base[1] * k, base[2] * k); camera.lookAt(0, 0.5, 0); controls?.update?.(); invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);
  return null;
}

export default function Scene3D({ scene, selected, onSelect, onReady, resetKey, labels }: { labels: React.RefObject<HTMLDivElement | null>; scene: OfficeScene; selected: Sel; onSelect: (s: Sel) => void; onReady: () => void; resetKey: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const r = Math.max(scene.bounds.w, scene.bounds.d, 9);
  const look = scene.theme.look; const half = Math.max(scene.bounds.w, scene.bounds.d) / 2 + (look?.margin ?? 2.5);
  const plants = useMemo(() => [[-half + 0.6, -half + 0.6], [half - 0.6, -half + 0.6], [-half + 0.6, half - 0.6], [half - 0.6, half - 0.6]] as [number, number][], [half]);
  const fired = useRef(false);
  return (
    <Canvas key={resetKey} frameloop="demand" dpr={[1, 1.75]} shadows={false} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [r * 0.74, r * 0.62, r * 0.74], fov: 38, near: 0.1, far: 300 }}
      style={{ touchAction: "none" }} onPointerMissed={() => onSelect(null)}
      onCreated={() => { if (!fired.current) { fired.current = true; onReady(); } }}>
      <ambientLight intensity={look?.ambient ?? 0.85} color={look?.lightColor ?? "#ffffff"} /><directionalLight position={[8, 14, 6]} intensity={look?.sun ?? 1.1} color={look?.lightColor ?? "#ffffff"} /><hemisphereLight args={["#ffffff", "#bbb7ae", 0.35]} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[half * 2 + 2, half * 2 + 2]} /><meshStandardMaterial color={scene.theme.floor} roughness={1} /></mesh>
      <mesh position={[0, 0.0, -half - 1]}><boxGeometry args={[half * 2 + 2, 0.05, 0.1]} /><meshStandardMaterial color={scene.theme.wall} /></mesh>
      <Reception scene={scene} labels={labels} />
      {look ? <><Backdrop3D look={look} scene={scene} /><Decor3D look={look} scene={scene} /></> : plants.map(([x, z], i) => <Plant key={i} x={x} z={z} />)}
      {scene.zones.map((z) => (
        <ZoneMesh key={z.id} look={look} z={z} selected={selected?.type === "zone" && selected.id === z.id} hoveredDesk={hover} selDesk={selected?.type === "desk" ? selected.id : null}
          onSelectZone={() => onSelect({ type: "zone", id: z.id })} onSelectDesk={(id) => onSelect({ type: "desk", id })} onHoverDesk={setHover} labels={labels} />
      ))}
      <OrbitControls makeDefault enableDamping={false} maxPolarAngle={Math.PI / 2.15} minPolarAngle={0.2} minDistance={4} maxDistance={r * 4} target={[0, 0.5, 0]} />
      <FitCamera base={[r * 0.74, r * 0.62, r * 0.74]} halfExtent={(scene.bounds.w + scene.bounds.d) * 0.354 + 2} />
      <Ticker active={!!look?.fx.motion} />
      <Probe scene={scene} />
    </Canvas>
  );
}
