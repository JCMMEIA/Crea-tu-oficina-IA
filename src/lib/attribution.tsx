"use client";
import { useEffect, useState } from "react";

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
type First = { source: string; landing: string; utm: Record<string, string> };
function firstTouch(): First {
  try { const s = sessionStorage.getItem("cto_first"); if (s) return JSON.parse(s); } catch {}
  const q = new URLSearchParams(location.search); const utm: Record<string, string> = {};
  KEYS.forEach((k) => { const v = q.get(k); if (v) utm[k] = v.slice(0, 200); });
  let ref = ""; try { ref = document.referrer && new URL(document.referrer).hostname !== location.hostname ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch {}
  const f: First = { source: (utm.utm_source || (utm.fbclid ? "meta" : "") || ref || "directo").toLowerCase().slice(0, 60), landing: location.pathname.slice(0, 120), utm };
  try { sessionStorage.setItem("cto_first", JSON.stringify(f)); } catch {}
  return f;
}
/** Medición sin cookies: guarda la primera fuente de la visita en esta pestaña y la manda con el formulario. Anónimo: sin IP ni identificadores. */
export function Attribution({ track }: { track?: "visita" | "plan_visto" }) {
  const [f, setF] = useState<First | null>(null);
  useEffect(() => {
    const t = firstTouch(); setF(t);
    if (track) { try { const key = `cto_seen_${track}_${location.pathname}`; if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ name: track, path: location.pathname, utm: t.utm, referrer: document.referrer })], { type: "application/json" })); } } catch {} }
  }, [track]);
  return (<>
    <input type="hidden" name="source" value={f?.source ?? ""} /><input type="hidden" name="landing" value={f?.landing ?? ""} />
    {KEYS.map((k) => <input key={k} type="hidden" name={k} value={f?.utm[k] ?? ""} />)}
  </>);
}
/** Cuenta un clic en un botón de llamada a la acción (anónimo). */
export function trackCta(cta: string) {
  try { const t = JSON.parse(sessionStorage.getItem("cto_first") ?? "{}"); navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ name: "cta_click", path: location.pathname, cta, utm: t.utm ?? {}, referrer: document.referrer })], { type: "application/json" })); } catch {}
}
export function CtaLink({ href, cta, className, children, testId }: { href: string; cta: string; className?: string; children: React.ReactNode; testId?: string }) {
  return <a href={href} className={className} data-testid={testId} onClick={() => trackCta(cta)}>{children}</a>;
}
