"use client";
import { useMemo, useState } from "react";
import type { OfficeScene } from "@/server/office3d/types";
import { FX_INFO, FxFlags, MAX_DESCRIPTION, OfficeDesign, SPACE_INFO, SPACE_KEYS, STYLE_INFO, StyleKey, SpaceKey, resolveTheme, suggestFromDescription } from "@/server/office3d/design";
import { IsoSvg } from "./iso";
import { SpaceThumb, StyleThumb } from "./Thumbs";

const GALLERY: StyleKey[] = ["bloques", "heroes", "cuentos", "desierto", "submarino", "personalizado"];
interface Props { scene: OfficeScene; initial: OfficeDesign; legacyStyle: string; /** «page»: trae su propio formulario y botón Guardar. «embedded»: va dentro de otro formulario (paso 4 de /empezar). */ mode: "page" | "embedded"; action?: (f: FormData) => void | Promise<void> }

/**
 * «Personaliza tu oficina». Elegir NO guarda: cambia la vista previa; se puede cambiar de idea hasta pulsar Guardar.
 * Todo funciona con teclado (tarjetas = botones de opción reales, interruptores = casillas reales).
 */
export function PersonalizeOffice({ scene, initial, legacyStyle, mode, action }: Props) {
  const [d, setD] = useState<OfficeDesign>(initial);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const preview = useMemo<OfficeScene>(() => ({ ...scene, theme: resolveTheme(d, legacyStyle) }), [scene, d, legacyStyle]);
  const set = (p: Partial<OfficeDesign>) => { setMsg(""); setD((x) => ({ ...x, ...p })); };
  const setFx = (k: keyof FxFlags, v: boolean) => { setMsg(""); setD((x) => ({ ...x, fx: { ...x.fx, [k]: v, ...(k === "reduceMotion" && v ? {} : {}) } })); };
  const build = () => {
    const s = suggestFromDescription(d.description); setMsg(s.summary);
    if (s.understood) setD((x) => ({ ...x, style: "personalizado", space: s.space ?? x.space, fx: { ...x.fx, ...s.fx } }));
  };
  const body = (<div className="pz" data-testid="personaliza">
    <div className="pz-head"><span className="pz-badge">✦ Personalización total</span><h2>Personaliza <span>tu oficina</span></h2>
      <p>Haz que tu oficina IA se vea como tú quieras. Elige un estilo y el tipo de espacio donde trabajarán tus empleados: se combinan libremente.</p></div>

    <section className="pz-panel" aria-labelledby="pz-h-style"><h3 id="pz-h-style">¿Cómo quieres que se vea tu oficina?</h3>
      <div className="pz-grid" role="radiogroup" aria-labelledby="pz-h-style">
        {GALLERY.map((k) => <label key={k} className={`pz-card${d.style === k ? " on" : ""}`} data-testid={`pz-style-${k}`}>
          <input type="radio" name="pz-style" value={k} checked={d.style === k} onChange={() => set({ style: k })} />
          <span className="pz-thumb"><StyleThumb k={k} /></span><span className="pz-name">{STYLE_INFO[k].name}</span><span className="pz-blurb">{STYLE_INFO[k].blurb}</span>
          {d.style === k && <span className="pz-check" aria-hidden="true">✓</span>}</label>)}
      </div>
      {d.style !== "clasico" && <button type="button" className="pz-link" onClick={() => set({ style: "clasico" })} data-testid="pz-style-clasico">Quitar el estilo y volver al aspecto limpio</button>}
      {d.style === "personalizado" && <div className="pz-custom" data-testid="pz-custom">
        <label htmlFor="pz-desc">Cuéntanos cómo imaginas tu oficina</label>
        <textarea id="pz-desc" value={d.description} maxLength={MAX_DESCRIPTION} rows={3} placeholder="Ej.: una oficina en una isla tropical, con luces azules y mucha magia" onChange={(e) => set({ description: e.target.value })} />
        <div className="pz-row"><button type="button" className="pz-btn" onClick={build} data-testid="pz-build">Armar mi combinación</button><span className="pz-count">{d.description.length}/{MAX_DESCRIPTION}</span></div>
        <p className="pz-note" role="status" aria-live="polite">{msg || "Armamos la combinación con estilos y espacios que ya existen. No generamos imágenes nuevas con inteligencia artificial."}</p>
      </div>}
    </section>

    <section className="pz-panel" aria-labelledby="pz-h-space"><h3 id="pz-h-space">¿Qué tipo de oficina quieres?</h3>
      <div className="pz-grid six" role="radiogroup" aria-labelledby="pz-h-space">
        {SPACE_KEYS.map((k) => <label key={k} className={`pz-card${d.space === k ? " on" : ""}`} data-testid={`pz-space-${k}`}>
          <input type="radio" name="pz-space" value={k} checked={d.space === k} onChange={() => set({ space: k as SpaceKey })} />
          <span className="pz-thumb"><SpaceThumb k={k} /></span><span className="pz-name">{SPACE_INFO[k].name}</span><span className="pz-blurb">{SPACE_INFO[k].blurb}</span>
          {d.space === k && <span className="pz-check" aria-hidden="true">✓</span>}</label>)}
      </div>
      <div className="pz-fx" role="group" aria-label="Efectos">
        {FX_INFO.map((f) => <label key={f.key} className={`pz-chip${d.fx[f.key] ? " on" : ""}`} title={f.hint} data-testid={`pz-fx-${f.key}`}>
          <input type="checkbox" role="switch" checked={d.fx[f.key]} onChange={(e) => setFx(f.key, e.target.checked)} aria-describedby={`pz-fxh-${f.key}`} /><span>{f.name}</span><span id={`pz-fxh-${f.key}`} className="pz-sr">{f.hint}</span></label>)}
      </div>
    </section>

    <section className="pz-panel" aria-labelledby="pz-h-prev"><h3 id="pz-h-prev">Vista previa con tu equipo real</h3>
      <div className="pz-stage" data-testid="pz-preview" data-look={`${d.style}+${d.space}`} style={preview.theme.look?.fx.immersive ? { background: `linear-gradient(180deg,${preview.theme.look.bgFrom},${preview.theme.look.bgTo})` } : undefined}>
        <IsoSvg scene={preview} label={`Vista previa: ${STYLE_INFO[d.style].name}, ${SPACE_INFO[d.space].name}`} showLabels={false} /></div>
      <p className="pz-note" aria-live="polite">{STYLE_INFO[d.style].name} · {SPACE_INFO[d.space].name}{dirty ? " — cambios sin guardar" : ""}. {scene.stats.employees ? `Se ven tus ${scene.stats.employees} empleado(s) y ${scene.stats.zones} área(s) reales.` : "Cuando contrates empleados, los verás sentados aquí."}</p>
    </section>
    <input type="hidden" name="diseno" value={JSON.stringify(d)} />
    {mode === "page" && <div className="pz-actions"><button className="pz-btn big" data-testid="pz-save" disabled={!dirty}>Guardar mi diseño</button>
      <button type="button" className="pz-btn ghost" disabled={!dirty} onClick={() => { setD(initial); setMsg(""); }}>Descartar cambios</button></div>}
  </div>);
  return mode === "page" ? <form action={action}>{body}</form> : body;
}
