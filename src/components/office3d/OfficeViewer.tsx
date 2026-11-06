"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Desk, OfficeScene, Zone } from "@/server/office3d/types";
import { IsoSvg, Sel } from "./iso";
import { WorkingDots } from "@/components/Working";
import { enterClientAction } from "@/app/agency_actions";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

export function webglAvailable(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
class Boundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const STATUS: Record<Desk["status"], [string, string]> = { active: ["✅ Listo para trabajar", "ok"], paused: ["⏸ En pausa", "warn"], inactive: ["⏸ Apagado", "bad"] };
/** Estado visible del puesto: «Trabajando…» (animado) si tiene una tarea en curso. */
const deskState = (d: Desk): [React.ReactNode, string] => (d.status === "active" && d.working ? [<><WorkingDots /> Trabajando…</>, "working"] : STATUS[d.status]);
const ZSTATUS: Record<Zone["status"], [string, string]> = { empty: ["🪑", ""], needs_setup: ["🔧", "warn"], ready: ["✅", "ok"] };

type Mode = "3d" | "2d" | "list";
interface Props { scene: OfficeScene; height?: number; emptyCta?: { href: string; label: string }; compact?: boolean; testId?: string }

export function OfficeViewer({ scene, height = 560, emptyCta, compact = false, testId = "office" }: Props) {
  const [mode, setMode] = useState<Mode>("2d");
  const [ready3d, setReady3d] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [resetKey, setResetKey] = useState(0);
  const labelsRef = useRef<HTMLDivElement | null>(null); // contenedor ESTABLE de etiquetas: evita una carrera de React al cambiar de vista

  // Mejora progresiva: el servidor entrega la vista 2D; si hay WebGL y la persona no prefiere 2D, se activa el 3D.
  useEffect(() => {
    let pref: string | null = null; try { pref = localStorage.getItem("cto_office_mode"); } catch {}
    if (!webglAvailable()) { setNotice("Tu navegador o dispositivo no permite 3D: te mostramos la vista 2D. También puedes usar la «Lista», que es más sencilla."); if (pref === "list") setMode("list"); return; }
    if (pref === "list") setMode("list"); else if (pref !== "2d") setMode("3d");
  }, []);
  const choose = (m: Mode) => {
    if (m === "3d" && !webglAvailable()) { setNotice("Este dispositivo no permite 3D (WebGL). Seguimos en 2D."); return; }
    setNotice(null); setMode(m); setReady3d(false); try { localStorage.setItem("cto_office_mode", m); } catch {}
  };
  const failed3d = () => { setMode("2d"); setNotice("No se pudo cargar la vista 3D. Mostramos la vista 2D; el resto de la aplicación no se ve afectado."); };

  const zones = scene.zones;
  const selZone = sel?.type === "zone" ? zones.find((z) => z.id === sel.id) : undefined;
  const selDesk = useMemo(() => { if (sel?.type !== "desk") return undefined; for (const z of zones) { const d = z.desks.find((x) => x.id === sel.id); if (d) return { d, z }; } }, [sel, zones]);
  const empty = zones.length === 0;
  const show3d = mode === "3d";

  return (
    <div className="o3d" data-testid={testId} data-mode={mode === "list" ? "list" : show3d && ready3d ? "3d" : "2d"} data-zones={zones.length} data-employees={scene.stats.employees}>
      <div className="o3d-bar">
        <span className="muted">{scene.stats.zones} {scene.kind === "agency" ? (scene.stats.zones === 1 ? "cliente" : "clientes") : (scene.stats.zones === 1 ? "área" : "áreas")} · {scene.stats.employees} {scene.stats.employees === 1 ? "empleado" : "empleados"}</span>
        <span className="row">
          <button className={mode === "3d" ? "" : "ghost"} aria-pressed={mode === "3d"} onClick={() => choose("3d")}>Vista 3D</button>
          <button className={mode === "2d" ? "" : "ghost"} aria-pressed={mode === "2d"} onClick={() => choose("2d")}>Vista 2D</button>
          <button className={mode === "list" ? "" : "ghost"} aria-pressed={mode === "list"} onClick={() => choose("list")} data-testid="mode-list">Lista</button>
          {show3d && <button className="ghost" onClick={() => setResetKey((k) => k + 1)}>Volver a la vista inicial</button>}
        </span>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="o3d-layout">
        {mode === "list" ? <ListView scene={scene} onSelect={setSel} emptyCta={emptyCta} /> : <div className="o3d-stage" style={{ height }} data-testid={`${testId}-stage`}>
          <div className="o3d-2d" style={{ visibility: show3d && ready3d ? "hidden" : "visible" }}>
            <IsoSvg scene={scene} selected={sel} onSelect={setSel} />
          </div>
          {show3d && (
            <div className="o3d-3d" style={{ opacity: ready3d ? 1 : 0 }}><div ref={labelsRef} className="o3d-labels" />
              <Boundary onError={failed3d}><Scene3D scene={scene} selected={sel} onSelect={setSel} onReady={() => setReady3d(true)} resetKey={resetKey} labels={labelsRef} /></Boundary>
            </div>
          )}
          {show3d && !ready3d && <div className="o3d-loading muted" role="status">Cargando vista 3D…</div>}
          {empty && <div className="o3d-empty"><b>¡Tu oficina está vacía!</b><span>Contrata a tu primer empleado y lo verás sentarse aquí. La recepción ya lleva tu marca.</span>{emptyCta && <Link className="btn" href={emptyCta.href}>{emptyCta.label}</Link>}</div>}
          {show3d && ready3d && !compact && <div className="o3d-hint muted">Arrastra para girar · rueda o pellizco para acercar · toca a un empleado para conocerlo</div>}
        </div>}
        <aside className="o3d-side" aria-live="polite">
          {selDesk ? <DeskPanel d={selDesk.d} z={selDesk.z} scene={scene} onClose={() => setSel(null)} />
            : selZone ? <ZonePanel z={selZone} scene={scene} onSelect={setSel} onClose={() => setSel(null)} />
            : <Legend scene={scene} onSelect={setSel} />}
        </aside>
      </div>
    </div>
  );
}

function Legend({ scene, onSelect }: { scene: OfficeScene; onSelect: (s: Sel) => void }) {
  return (<div><h3>{scene.title}</h3><p className="muted">{scene.subtitle}</p>
    {scene.zones.length ? <ul className="o3d-list">{scene.zones.map((z) => <li key={z.id}><button className="ghost" onClick={() => onSelect({ type: "zone", id: z.id })}><span className="dot" style={{ background: z.color }} /> {z.icon} {z.label} <span className="muted">· {z.desks.length}</span></button></li>)}</ul> : <p className="muted">Sin departamentos todavía.</p>}
    <p className="muted">Toca un área o un empleado para ver su detalle.</p></div>);
}
function ZonePanel({ z, scene, onSelect, onClose }: { z: Zone; scene: OfficeScene; onSelect: (s: Sel) => void; onClose: () => void }) {
  return (<div data-testid="panel-zone"><button className="ghost" onClick={onClose} aria-label="Cerrar detalle">← Resumen</button>
    <h3><span className="dot" style={{ background: z.color }} /> {z.icon} {z.label}</h3>
    <p><span className={`state ${ZSTATUS[z.status][1]}`}>{ZSTATUS[z.status][0]} {z.statusLabel}</span></p>
    {z.notes.length > 0 && <ul>{z.notes.map((n) => <li key={n} className="muted">{n}</li>)}</ul>}
    <h4>{z.kind === "client" ? "Empleados del cliente" : "Quiénes trabajan aquí"} ({z.desks.length})</h4>
    {z.desks.length ? <ul className="o3d-list">{z.desks.map((d) => <li key={d.id}><button className="ghost" onClick={() => onSelect({ type: "desk", id: d.id })}>{d.label} <span className="muted">· {d.roleTitle}</span></button></li>)}</ul> : <p className="muted">Nadie todavía.</p>}
    {z.kind === "department" && <><h4>Servicios que le das</h4>{z.services.length ? <ul>{z.services.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted">Todavía ninguno.</p>}<p><Link className="btn" href="/agregar-empleado">➕ Agregar empleado</Link> <Link className="btn ghost" href="/departamentos">Ver mis empleados</Link></p></>}
    {z.kind === "client" && z.companyId && <EnterClient companyId={z.companyId} label="Abrir su oficina" />}
  </div>);
}
function DeskPanel({ d, z, scene, onClose }: { d: Desk; z: Zone; scene: OfficeScene; onClose: () => void }) {
  const [label, cls] = deskState(d);
  const agencyView = scene.kind === "agency";
  return (<div data-testid="panel-desk"><button className="ghost" onClick={onClose} aria-label="Cerrar detalle">← Resumen</button>
    <h3>🧑‍💼 {d.label}</h3><p className="muted">{d.roleTitle}</p>
    <p><span className={`state ${cls}`} role={d.working ? "status" : undefined}>{label}</span> <span className="chip"><span className="dot" style={{ background: z.color }} /> {z.kind === "client" ? z.label : d.departmentName}</span></p>
    {d.needs.length > 0 && <p><span className="state warn">🔧 Falta configurar</span> Conéctale: {d.needs.join(", ")}.</p>}
    <p><b>Lo que sabe hacer:</b> {d.skillName}{d.skillCustomized && <span className="state ok">🎓 Le enseñaste</span>}</p>
    {agencyView && z.companyId ? <EnterClient companyId={z.companyId} label="Abrir la oficina de este cliente" />
      : z.kind === "automation" ? <p className="muted">Gestiónala en <Link href="/automatizaciones">Automatizaciones</Link>.</p>
      : <div className="row" data-testid="desk-actions"><Link className="btn big" href={`${d.href}#tarea`}>📝 Darle una tarea</Link><Link className="btn ghost" href={`${d.href}/ensenar`}>🎓 Enseñarle</Link><Link className="btn ghost" href="/actividad">📋 Ver resultados</Link><Link className="btn ghost" href={d.href}>Abrir su ficha</Link></div>}
  </div>);
}
function EnterClient({ companyId, label }: { companyId: string; label: string }) {
  return (<form action={enterClientAction}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="to" value="oficina3d" /><button className="big">{label}</button></form>);
}

/** Vista en lista: ligera y accesible (sin WebGL, ideal para móviles y lectores de pantalla). Muestra TODO con icono y texto. */
function ListView({ scene, onSelect, emptyCta }: { scene: OfficeScene; onSelect: (s: Sel) => void; emptyCta?: { href: string; label: string } }) {
  if (!scene.zones.length) return <div className="empty-state" data-testid="list-view"><div className="ic" aria-hidden="true">🪑</div><h3>¡Tu oficina está vacía!</h3><p>Contrata a tu primer empleado y aparecerá aquí.</p>{emptyCta && <Link className="btn big" href={emptyCta.href}>{emptyCta.label}</Link>}</div>;
  return (<div data-testid="list-view" role="list" aria-label="Áreas y empleados de la oficina">{scene.zones.map((z) => (<section key={z.id} className="card" role="listitem" style={{ marginBottom: 10, borderLeft: `6px solid ${z.color}` }}>
    <h3>{z.icon} {z.label} <span className={`state ${ZSTATUS[z.status][1]}`}>{ZSTATUS[z.status][0]} {z.statusLabel}</span></h3>
    {z.notes.map((n) => <p className="muted" key={n}>{n}</p>)}
    {z.desks.length ? <ul className="o3d-list">{z.desks.map((d) => <li key={d.id}><button className="ghost" onClick={() => onSelect({ type: "desk", id: d.id })}>🧑‍💼 {d.label} — {deskState(d)[0]}{d.needs.length ? " · 🔧 falta configurar" : ""}</button></li>)}</ul> : <p className="muted">Nadie todavía.</p>}</section>))}</div>);
}
