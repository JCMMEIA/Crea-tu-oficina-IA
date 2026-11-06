"use client";
/**
 * Señales visibles de «un empleado de IA está trabajando». Solo presentación: no toca el motor de tareas.
 * - TaskForm + SubmitButton: el botón se bloquea al instante, dice «Trabajando…» y evita doble envío.
 * - EmployeeState: estado del empleado («Trabajando» / «Listo para trabajar» / «En pausa»).
 * - AutoRefresh: refresca la página sola, con calma, mientras la tarea sigue en curso.
 */
import "./working.css";
import React, { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export function WorkingDots() { return <span className="wk-dots" aria-hidden="true"><i /><i /><i /></span>; }

/** «hasta 2 minutos» a partir de los segundos máximos de la tarea (mínimo 1 minuto). */
export function minutesText(maxSeconds = 120) { const m = Math.max(1, Math.ceil(maxSeconds / 60)); return `${m} ${m === 1 ? "minuto" : "minutos"}`; }
export function workingMessage(name: string, maxSeconds = 120) { return `${name} está trabajando en tu tarea; puede tardar hasta ${minutesText(maxSeconds)}, no cierres ni vuelvas a pulsar.`; }

/** Botón de envío: se deshabilita mientras el formulario se envía y muestra «Trabajando…» con animación. */
export function SubmitButton({ children, pendingLabel = "Trabajando…", className, disabled, testId }: { children: React.ReactNode; pendingLabel?: string; className?: string; disabled?: boolean; testId?: string }) {
  const { pending } = useFormStatus();
  return (<button type="submit" className={`${className ?? ""}${pending ? " wk-btn-pending" : ""}`.trim()} disabled={pending || disabled} aria-disabled={pending || disabled || undefined} aria-busy={pending || undefined} data-testid={testId}>
    {pending ? <><WorkingDots /> {pendingLabel}</> : children}</button>);
}

/** Zona de aviso: SIEMPRE presente (para que los lectores de pantalla anuncien el cambio) y con texto solo mientras trabaja. */
function PendingNotice({ message, locked }: { message: string; locked: React.RefObject<boolean> }) {
  const { pending } = useFormStatus();
  useEffect(() => { if (!pending) locked.current = false; }, [pending, locked]); // al terminar el envío se vuelve a permitir
  return (<div role="status" aria-live="polite" data-testid="working-notice">{pending && <p className="wk-notice"><WorkingDots /><span><b>Trabajando…</b> {message}</span></p>}</div>);
}

/** Formulario que ejecuta una tarea. Ignora envíos repetidos (clics o Enter muy seguidos) antes de que React alcance a deshabilitar el botón. */
export function TaskForm({ action, workerName, maxSeconds = 120, children, className }: { action: (f: FormData) => void | Promise<void>; workerName: string; maxSeconds?: number; children: React.ReactNode; className?: string }) {
  const locked = useRef(false);
  return (<form action={action} className={className} onSubmit={(e) => { if (locked.current) { e.preventDefault(); return; } locked.current = true; }}>
    {children}<PendingNotice message={workingMessage(workerName, maxSeconds)} locked={locked} /></form>);
}

/** Estado del empleado: animado si tiene una tarea en curso. */
export function EmployeeState({ status, working, idleText = "✅ Listo para trabajar" }: { status: string; working?: boolean; idleText?: string }) {
  if (status === "active" && working) return <span className="state working" role="status"><WorkingDots /> Trabajando…</span>;
  return <span className={`state ${status === "active" ? "ok" : "warn"}`}>{status === "active" ? idleText : status === "paused" ? "⏸ En pausa" : "⏸ Apagado"}</span>;
}

/** Refresca los datos de la página cada pocos segundos mientras `active` sea verdadero; se detiene solo al terminar. */
export function AutoRefresh({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return active ? <p className="muted" data-testid="auto-refresh"><WorkingDots /> Esta página se actualiza sola mientras trabaja.</p> : null;
}
