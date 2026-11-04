"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, BrandMark } from "@/components/Icon";
import { BuyLink } from "../tracking/attribution";
import { NAV } from "../config/content";

export function LandingHeader({ canBuy }: { canBuy: boolean }) {
  const [open, setOpen] = useState(false); const [active, setActive] = useState("");
  useEffect(() => {
    const ids = NAV.map((n) => n.href.slice(1)); const els = ids.map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }), { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((e) => io.observe(e)); return () => io.disconnect();
  }, []);
  const cta = canBuy ? <BuyLink cta="header" className="btn" testId="cta-comprar-header">Crear mi oficina IA <Icon name="arrow" size={16} /></BuyLink> : <a className="btn" href="#avisame" data-testid="cta-avisame-header">Avísame cuando abran</a>;
  return (<header className="lp-header fx-header" role="banner">
    <div className="lp-wrap"><Link href="/" className="lp-logo" aria-label="Crea tu Oficina IA, inicio"><BrandMark size={38} />Crea tu Oficina IA</Link>
      <nav className="lp-nav fx-nav" aria-label="Principal">{NAV.map((n) => <a key={n.href} href={n.href} className="fx-navlink" aria-current={active === n.href.slice(1) ? "true" : undefined}>{n.label}</a>)}<Link href="/ayuda/tutoriales">Ayuda</Link><Link href="/recuperar" data-testid="nav-login">Iniciar sesión</Link>{cta}</nav>
      <button type="button" className="lp-burger ghost" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="lp-mobile" onClick={() => setOpen((o) => !o)} data-testid="menu-movil"><Icon name={open ? "close" : "menu"} size={22} /></button></div>
    <div id="lp-mobile" className={`lp-mobile${open ? " open" : ""}`} aria-hidden={!open}>
      {NAV.map((n) => <a key={n.href} href={n.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>{n.label}</a>)}
      <Link href="/ayuda/tutoriales" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>Ayuda</Link><Link href="/recuperar" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} data-testid="nav-login-movil">Iniciar sesión</Link>
      {canBuy ? <BuyLink cta="header-movil" className="btn" testId="cta-comprar-movil">Crear mi oficina IA</BuyLink> : <a className="btn" href="#avisame" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>Avísame cuando abran</a>}</div>
  </header>);
}
