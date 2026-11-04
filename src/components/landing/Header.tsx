"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon, BrandMark } from "@/components/Icon";
import { BuyLink } from "@/lib/attribution";

export function LandingHeader({ canBuy }: { canBuy: boolean }) {
  const [open, setOpen] = useState(false);
  const cta = canBuy ? <BuyLink cta="header" className="btn" testId="cta-comprar-header">Crear mi oficina IA <Icon name="arrow" size={16} /></BuyLink> : <a className="btn" href="#oferta" data-testid="cta-avisame-header" onClick={() => setOpen(false)}>Avísame cuando abran</a>;
  return (<header className="lp-header" role="banner">
    <div className="lp-wrap"><Link href="/" className="lp-logo" aria-label="Crea tu Oficina IA, inicio"><BrandMark size={38} />Crea tu Oficina IA</Link>
      <nav className="lp-nav" aria-label="Principal"><Link href="/ayuda/tutoriales">Ayuda</Link><Link href="/recuperar" data-testid="nav-login">Iniciar sesión</Link>{cta}</nav>
      <button type="button" className="lp-burger ghost" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="lp-mobile" onClick={() => setOpen((o) => !o)} data-testid="menu-movil"><Icon name={open ? "close" : "menu"} size={22} /></button></div>
    <div id="lp-mobile" className={`lp-mobile${open ? " open" : ""}`} hidden={false} aria-hidden={!open}>
      <Link href="/ayuda/tutoriales" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>Ayuda</Link><Link href="/recuperar" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} data-testid="nav-login-movil">Iniciar sesión</Link>
      {canBuy ? <BuyLink cta="header-movil" className="btn" testId="cta-comprar-movil">Crear mi oficina IA</BuyLink> : <a className="btn" href="#oferta" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>Avísame cuando abran</a>}</div>
  </header>);
}
