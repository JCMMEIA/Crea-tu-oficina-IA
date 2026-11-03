"use client";
import { useEffect, useState } from "react";
import Script from "next/script";

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;
declare global { interface Window { fbq?: (...a: unknown[]) => void } }

/** Medición de Meta preparada: NO carga nada hasta que (1) exista NEXT_PUBLIC_META_PIXEL_ID y (2) la persona acepte. */
export function MetaPixel() {
  const [consent, setConsent] = useState<"yes" | "no" | null>(null);
  useEffect(() => { try { const v = localStorage.getItem("cto_consent"); setConsent(v === "yes" || v === "no" ? v : null); } catch {} }, []);
  if (!PIXEL) return null; // sin ID: sin banner y sin scripts
  const choose = (v: "yes" | "no") => { try { localStorage.setItem("cto_consent", v); } catch {} setConsent(v); };
  return (<>
    {consent === "yes" && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL.replace(/[^0-9]/g, "")}');fbq('track','PageView');`}</Script>}
    {consent === null && <div role="dialog" aria-label="Cookies" className="cookie"><span>Usamos cookies de medición (Meta) solo si lo aceptas. <a href="/privacidad">Privacidad</a></span><button onClick={() => choose("yes")}>Aceptar</button><button className="ghost" onClick={() => choose("no")}>Rechazar</button></div>}
  </>);
}
/** Dispara el evento Lead en la página de gracias (solo si hay consentimiento y píxel). */
export function TrackLead() {
  useEffect(() => { if (!PIXEL) return; try { if (localStorage.getItem("cto_consent") === "yes") { const t = setInterval(() => { if (window.fbq) { window.fbq("track", "Lead"); clearInterval(t); } }, 300); setTimeout(() => clearInterval(t), 5000); } } catch {} }, []);
  return null;
}
