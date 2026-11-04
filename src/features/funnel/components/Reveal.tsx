"use client";
import { useEffect, useRef } from "react";

/** Animación sutil de entrada al hacer scroll. Sin JavaScript o con «reducir movimiento» el contenido se ve siempre. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return; const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("fx-js");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`fx-rv ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</div>;
}
