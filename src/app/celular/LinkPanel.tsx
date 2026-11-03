"use client";
import { useActionState } from "react";
import { createCodeAction, CodeState } from "./actions";

export function LinkPanel({ channel, label, configured, botUsername, waNumber }: { channel: "telegram" | "whatsapp"; label: string; configured: boolean; botUsername: string; waNumber: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(createCodeAction, null);
  const mine = state?.channel === channel ? state : null;
  const link = mine?.code ? (channel === "telegram" ? (botUsername ? `https://t.me/${botUsername}?start=${mine.code}` : "") : waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${encodeURIComponent(mine.code)}` : "") : "";
  return (<div className="card" data-testid={`link-${channel}`}>
    <h3>{label}</h3>
    {!configured && <p className="notice">🔧 {label} todavía no está activado en esta instalación. Puedes generar tu código, pero no funcionará hasta que quien instaló la plataforma lo active (en «Ayuda» está dónde encontrar los pasos).</p>}
    <form action={action}><input type="hidden" name="channel" value={channel} />
      <label style={{ fontWeight: 400, display: "flex", gap: 8 }}><input type="checkbox" name="consent" required style={{ width: "auto", marginTop: 4 }} /><span>Acepto recibir mensajes por {label} (avisos, resultados y permisos por aprobar). Puedo desconectarlo cuando quiera.</span></label>
      <p><button className="big" disabled={pending}>{pending ? "Preparando tu código…" : `Conectar ${label}`}</button></p></form>
    {mine?.error && <div className="notice bad" role="alert">{mine.error}</div>}
    {mine?.code && (<div className="notice ok" role="status"><p>Tu código (sirve una sola vez, vence a las {new Date(mine.expiresAt!).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}):</p>
      <p style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: ".08em" }} data-testid="link-code">{mine.code}</p>
      <p>{channel === "telegram" ? "Abre el bot y pulsa «Iniciar», o envíale: " : "Envía este código al número de WhatsApp de la plataforma: "}<code>{channel === "telegram" ? `/start ${mine.code}` : mine.code}</code></p>
      {link ? <p><a className="btn" href={link} target="_blank" rel="noreferrer">Abrir {label}</a></p> : <p className="muted">El administrador aún no configuró {channel === "telegram" ? "el usuario del bot" : "el número visible"}: busca el contacto de la plataforma manualmente.</p>}
      <p className="muted">No compartas este código con nadie. Solo se muestra una vez.</p></div>)}
  </div>);
}
