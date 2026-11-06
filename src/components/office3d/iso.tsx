import type { OfficeScene, Zone, Desk } from "@/server/office3d/types";
import { Box, P, proj } from "./iso_geom";
import { Backdrop2D, FloorPattern2D, LookDefs, decor2DItems } from "./iso_look";

/** Vista isométrica 2D en SVG. Sin hooks ni WebGL: sirve en el servidor, como miniatura y como fallback del 3D. */
const statusColor = (s: Desk["status"]) => (s === "active" ? "#16a34a" : s === "paused" ? "#d97706" : "#9ca3af");

export type Sel = { type: "zone"; id: string } | { type: "desk"; id: string } | null;
interface Props { scene: OfficeScene; selected?: Sel; onSelect?: (s: Sel) => void; label?: string; showLabels?: boolean }

export function IsoSvg({ scene, selected = null, onSelect, label = "Vista isométrica de la oficina", showLabels = true }: Props) {
  const interactive = !!onSelect;
  const look = scene.theme.look; const m = look?.margin ?? 2.5, hw = scene.bounds.w / 2 + m, hd = scene.bounds.d / 2 + m;
  const corners = [proj(-hw, -hd, 0), proj(hw, -hd, 0), proj(hw, hd, 0), proj(-hw, hd, 0), proj(0, 0, 3), proj(-hw, -hd, 3.4)];
  const minX = Math.min(...corners.map((c) => c.px)) - 20, maxX = Math.max(...corners.map((c) => c.px)) + 20;
  const minY = Math.min(...corners.map((c) => c.py)) - 50, maxY = Math.max(...corners.map((c) => c.py)) + 20;
  const key = (fn: () => void) => ({ role: "button", tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } } });
  const clickable = (fn: () => void, lbl: string) => interactive ? { ...key(fn), onClick: (e: React.MouseEvent) => { e.stopPropagation(); fn(); }, "aria-label": lbl, style: { cursor: "pointer" } } : {};
  const R = scene.reception;
  const items: { depth: number; node: React.ReactNode }[] = [];
  items.push({ depth: R.x + R.z - 50, node: (<g key="reception">
    <polygon points={P([proj(R.x - R.w / 2, R.z - R.d / 2), proj(R.x + R.w / 2, R.z - R.d / 2), proj(R.x + R.w / 2, R.z + R.d / 2), proj(R.x - R.w / 2, R.z + R.d / 2)])} fill={scene.brand.color} opacity={0.18} stroke={scene.brand.color} strokeWidth={1.2} />
    <Box x={R.x} z={R.z + 0.2} w={R.w * 0.6} d={0.7} h={0.8} color={scene.brand.color} />
    {scene.brand.logo && <image href={scene.brand.logo} x={proj(R.x, R.z - 0.4, 1.9).px - 14} y={proj(R.x, R.z - 0.4, 1.9).py - 14} width={28} height={28} preserveAspectRatio="xMidYMid meet" />}
    {showLabels && <text x={proj(R.x, R.z - 0.9, 0).px} y={proj(R.x, R.z - 0.9, 0).py - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor">{scene.brand.name}</text>}
    {showLabels && <text x={proj(R.x, R.z + 1.1, 0).px} y={proj(R.x, R.z + 1.1, 0).py + 12} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>Recepción</text>}
  </g>) });
  for (const z of scene.zones) {
    const zSel = selected?.type === "zone" && selected.id === z.id;
    const floor = [proj(z.x - z.w / 2, z.z - z.d / 2), proj(z.x + z.w / 2, z.z - z.d / 2), proj(z.x + z.w / 2, z.z + z.d / 2), proj(z.x - z.w / 2, z.z + z.d / 2)];
    const lab = proj(z.x - z.w / 2 + 0.1, z.z - z.d / 2 + 0.1, 0);
    items.push({ depth: z.x + z.z - 40, node: (<g key={z.id} {...clickable(() => onSelect!({ type: "zone", id: z.id }), `Departamento ${z.label}`)} data-testid={`iso-zone-${z.id}`}>
      <polygon points={P(floor)} fill={z.color} opacity={zSel ? 0.42 : 0.2} stroke={z.color} strokeWidth={zSel ? 3 : 1.4} strokeDasharray={z.status === "empty" ? "5 4" : undefined} />
      {showLabels && <text x={lab.px + 6} y={lab.py - 6} fontSize={11} fontWeight={700} fill="currentColor">{z.icon} {z.label} · {z.desks.length}{z.status === "needs_setup" ? " 🔧" : z.status === "empty" ? " 🪑" : " ✓"}</text>}
      {z.desks.length === 0 && showLabels && <text x={proj(z.x, z.z).px} y={proj(z.x, z.z).py + 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.55}>vacío</text>}
    </g>) });
    for (const d of z.desks) {
      const dSel = selected?.type === "desk" && selected.id === d.id; const a = proj(d.x, d.z + 0.62, 0.0), head = proj(d.x, d.z + 0.62, 1.5);
      const body = d.status === "active" ? z.color : d.status === "paused" ? "#9ca3af" : "#6b7280";
      items.push({ depth: d.x + d.z, node: (<g key={d.id} {...clickable(() => onSelect!({ type: "desk", id: d.id }), `Empleado ${d.label}`)} data-testid={`iso-desk-${d.id}`}>
        {dSel && <ellipse cx={a.px} cy={a.py} rx={22} ry={11} fill="none" stroke="currentColor" strokeWidth={2.5} />}
        <Box x={d.x} z={d.z - 0.1} w={1.2} d={0.7} h={0.7} color={look?.deskTop ?? "#e5e1d8"} />
        <Box x={d.x} z={d.z - 0.3} w={0.55} d={0.06} h={0.38} y0={0.74} color={look?.screen ?? "#334155"} />
        <ellipse cx={a.px} cy={a.py + 2} rx={9} ry={4} fill={statusColor(d.status)} opacity={0.9} />
        <rect x={a.px - 7} y={a.py - 22} width={14} height={20} rx={6} fill={body} />
        <circle cx={head.px} cy={head.py + 2} r={6} fill="#fcd9b6" stroke={body} strokeWidth={1.5} />
        <title>{`${d.label} — ${d.roleTitle}`}</title>
      </g>) });
    }
  }
  if (look) items.push(...decor2DItems(look, scene));
  items.sort((a, b) => a.depth - b.depth);
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className={look && !look.fx.motion ? "pz-still" : undefined} data-look={look ? look.style + "+" + look.space : undefined} role="img" aria-label={label} style={{ width: "100%", height: "100%", display: "block" }} onClick={interactive ? () => onSelect!(null) : undefined}>
      {look && <LookDefs look={look} k={scene.theme.key} />}
      {look && <Backdrop2D look={look} scene={scene} k={scene.theme.key} />}
      <polygon points={P([proj(-hw, -hd), proj(hw, -hd), proj(hw, hd), proj(-hw, hd)])} fill={scene.theme.floor} opacity={0.85} stroke={scene.theme.wall} strokeWidth={2} />
      {look && <FloorPattern2D look={look} scene={scene} />}
      {items.map((i) => i.node)}
    </svg>
  );
}
export type { Zone, Desk };
