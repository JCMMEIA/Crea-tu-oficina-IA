"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, IconName } from "@/components/Icon";

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  { icon: "sparkle", title: "¡Bienvenido!", text: "Aquí armas tu propio negocio de empleados digitales. No necesitas saber de tecnología: te vamos guiando." },
  { icon: "users", title: "Tus empleados", text: "Cada empleado hace un trabajo (escribir anuncios, contestar mensajes…). Tú eliges quién te ayuda y le enseñas cómo trabajar." },
  { icon: "shield", title: "Tú decides", text: "Nada se publica, se envía ni se paga sin tu permiso. Primero te lo muestran y tú aceptas o rechazas." },
  { icon: "template", title: "Practica sin riesgo", text: "Puedes hacer pruebas con datos inventados antes de conectar cuentas reales." },
];
/** Guía que se puede omitir y volver a abrir con el botón «Ayuda». Recuerda tu elección solo en este dispositivo. */
export function GuideHost({ helpHref = "/ayuda" }: { helpHref?: string }) {
  const [open, setOpen] = useState(false); const [i, setI] = useState(0); const path = usePathname();
  // Se abre sola solo la primera vez y solo en el inicio (no tapa otras pantallas); «Ayuda» la abre en cualquier parte.
  useEffect(() => { try { if (!localStorage.getItem("cto_guide_seen") && (path === "/agencia" || path === "/oficina")) setOpen(true); } catch { /* sin almacenamiento: no se abre sola */ } }, [path]);
  const close = () => { setOpen(false); try { localStorage.setItem("cto_guide_seen", "1"); } catch {} };
  const s = SLIDES[i];
  return (<>
    <button className="guide-fab" onClick={() => { setI(0); setOpen((o) => !o); }} aria-expanded={open} aria-label="Ayuda: ver la guía"><Icon name="help" size={18} />Ayuda</button>
    {open && <div className="guide-panel" role="dialog" aria-label="Guía rápida" data-testid="guide-panel">
      <span className="icon-box" aria-hidden="true"><Icon name={s.icon} size={24} /></span><h3>{s.title}</h3><p>{s.text}</p>
      <div className="dots" aria-hidden="true">{SLIDES.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
      <div className="row">{i < SLIDES.length - 1 ? <button onClick={() => setI(i + 1)}>Siguiente</button> : <button onClick={close}>¡Entendido!</button>}<button className="ghost" onClick={close} data-testid="guide-skip">Omitir</button></div>
      <p className="muted" style={{ marginTop: 10 }}><Link href={helpHref} onClick={close}>Ver la guía completa</Link></p></div>}
  </>);
}
/** Aviso breve de confirmación (desaparece solo). */
export function Toast({ message }: { message: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 4500); return () => clearTimeout(t); }, []);
  return show ? <div className="toast" role="status"><Icon name="check" size={18} /> {message}</div> : null;
}
export function MenuButton({ target = "side-nav" }: { target?: string }) {
  const [closed, setClosed] = useState(true);
  useEffect(() => { document.getElementById(target)?.classList.toggle("closed", closed); }, [closed, target]);
  return <button className="menu-btn ghost" onClick={() => setClosed((c) => !c)} aria-expanded={!closed} aria-controls={target}><Icon name={closed ? "menu" : "close"} size={18} />{closed ? "Abrir el menú" : "Cerrar el menú"}</button>;
}

/** Aviso cuando un empleado terminó un trabajo reciente. Se muestra una sola vez por trabajo (se recuerda en este dispositivo). */
export function DoneToast({ id, title, who }: { id: string; title: string; who: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (localStorage.getItem("cto_seen_task") !== id) { setShow(true); localStorage.setItem("cto_seen_task", id); const t = setTimeout(() => setShow(false), 7000); return () => clearTimeout(t); } } catch {} }, [id]);
  return show ? <div className="toast" role="status" data-testid="done-toast"><Icon name="check" size={18} /> {who} terminó: {title.slice(0, 50)} · <Link href={`/actividad/${id}`} style={{ color: "#fff", textDecoration: "underline" }}>Ver resultado</Link></div> : null;
}
