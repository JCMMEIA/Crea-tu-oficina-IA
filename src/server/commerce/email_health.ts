import { promises as dns } from "node:dns";
import { Db } from "../db";
import { mailConfig } from "./mail";

export interface Issue { nivel: "critico" | "aviso" | "info"; titulo: string; detalle: string; solucion: string }
export const maskEmail = (e: string) => e.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2");
/** Traduce el error del proveedor a una causa y una acción concretas (sin mostrar secretos). */
export function classifyMailError(err: string | null | undefined): { causa: string; solucion: string } | null {
  if (!err) return null; const e = err.toLowerCase();
  if (e.includes("sin proveedor")) return { causa: "No hay proveedor de correo configurado.", solucion: "Define RESEND_API_KEY y MAIL_FROM en el servidor (bash configurar_ventas.sh) y reinicia solo crea-oficina." };
  if (e.startsWith("401") || e.includes("invalid_api_key") || e.includes("api key")) return { causa: "La clave de Resend es inválida, fue revocada o no tiene permiso de envío.", solucion: "En Resend → API Keys crea una clave con permiso «Sending access» y guárdala con configurar_ventas.sh." };
  if (e.startsWith("403") || e.includes("not verified") || e.includes("verify") || e.includes("domain")) return { causa: "El dominio del remitente no está verificado en Resend (o el remitente no pertenece a un dominio verificado).", solucion: "En Resend → Domains verifica el dominio (registros DKIM/SPF en el DNS) y usa un remitente de ese dominio (p. ej. acceso@tu-dominio)." };
  if (e.startsWith("422") || e.includes("validation")) return { causa: "El proveedor rechazó el formato del remitente o del destinatario.", solucion: "Revisa que MAIL_FROM tenga el formato «Nombre <correo@dominio>» y que el destinatario sea un correo válido." };
  if (e.startsWith("429") || e.includes("rate")) return { causa: "Se alcanzó el límite de envíos del proveedor.", solucion: "Espera unos minutos o revisa los límites de tu plan en Resend; los correos se reintentan solos." };
  if (e.includes("no se pudo contactar") || e.startsWith("0 red")) return { causa: "El servidor no logra conectarse a api.resend.com.", solucion: "Revisa la salida a internet del VPS (firewall/DNS) con: curl -sS -o /dev/null -w '%{http_code}' https://api.resend.com/emails (debe responder 401 o 405, no fallar)." };
  if (e.includes("sin_sitio") || e.includes("dirección pública")) return { causa: "Falta la dirección pública del sitio para armar los enlaces.", solucion: "Define NEXT_PUBLIC_SITE_URL=https://app.mmeia.tech (o SITE_URL) y vuelve a compilar/reiniciar." };
  return { causa: "Error del proveedor sin clasificar.", solucion: "Revisa el detalle del error y los registros del servicio (journalctl -u crea-oficina)." };
}
/** Diagnóstico de TODO el sistema de correo a partir de la configuración y de lo que realmente pasó con los correos (no de suposiciones). */
export async function diagnoseEmail(db: Db): Promise<{ issues: Issue[]; stats: Record<string, number>; configured: boolean }> {
  const c = mailConfig(); const issues: Issue[] = []; const add = (i: Issue) => issues.push(i);
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!c.keySet) add({ nivel: "critico", titulo: "Falta RESEND_API_KEY", detalle: "Sin clave de Resend ningún correo sale del servidor. Los pedidos de acceso quedan en cola sin avisar al usuario.", solucion: "Crea una clave en Resend (API Keys → Sending access) y guárdala con: sudo bash configurar_ventas.sh" });
  if (!c.from) add({ nivel: "critico", titulo: "Falta MAIL_FROM", detalle: "No hay remitente definido.", solucion: "Define un remitente de tu dominio verificado, p. ej. «Crea tu Oficina IA <acceso@mmeia.tech>», con configurar_ventas.sh." });
  else if (!c.fromOk) add({ nivel: "critico", titulo: "MAIL_FROM tiene un formato inválido", detalle: "Debe ser «Nombre <correo@dominio>» o «correo@dominio».", solucion: "Corrígelo con configurar_ventas.sh." });
  if (c.keySet && !c.keyShapeOk) add({ nivel: "aviso", titulo: "La clave de Resend no tiene el formato esperado (re_…)", detalle: "Puede estar mal copiada.", solucion: "Vuelve a copiarla desde Resend → API Keys." });
  if (c.fromDomain === "resend.dev") add({ nivel: "aviso", titulo: "Remitente de pruebas de Resend", detalle: "Con @resend.dev solo se entrega al correo de tu cuenta de Resend.", solucion: "Verifica tu dominio y usa acceso@tu-dominio." });
  if (!/^https:\/\//.test(siteUrl)) add({ nivel: "critico", titulo: "La dirección pública no es HTTPS", detalle: "Los enlaces de acceso deben apuntar a https://…", solucion: "Define NEXT_PUBLIC_SITE_URL=https://app.mmeia.tech y vuelve a compilar." });
  if (!(process.env.PLATFORM_ADMIN_EMAILS ?? "").trim()) add({ nivel: "aviso", titulo: "No hay correos de operador", detalle: "Nadie podrá iniciar sesión en /admin.", solucion: "Define PLATFORM_ADMIN_EMAILS con tu correo." });
  if (c.keySet && !c.webhookSecretSet) add({ nivel: "aviso", titulo: "Sin estado de entrega real", detalle: "Sin RESEND_WEBHOOK_SECRET el sistema solo sabe que Resend ACEPTÓ el mensaje, no si llegó al buzón o rebotó.", solucion: "En Resend → Webhooks crea uno a https://app.mmeia.tech/api/email/webhook (eventos email.delivered, email.bounced, email.complained, email.delivery_delayed) y guarda su secreto con configurar_ventas.sh." });
  const stats: Record<string, number> = {}; for (const r of await db.query("SELECT status s, count(*)::int n FROM emails GROUP BY 1")) stats[r.s] = r.n;
  for (const r of await db.query("SELECT delivery_status s, count(*)::int n FROM emails WHERE status='enviado' GROUP BY 1")) stats["entrega_" + (r.s ?? "sin_dato")] = r.n;
  const stuck = (await db.query("SELECT count(*)::int n, min(created_at) oldest FROM emails WHERE status='en_cola' AND created_at < now() - interval '10 minutes'"))[0];
  if (stuck.n > 0) { const last = (await db.query("SELECT last_error FROM emails WHERE status='en_cola' AND last_error IS NOT NULL ORDER BY created_at DESC LIMIT 1"))[0]?.last_error; const k = classifyMailError(last);
    add({ nivel: "critico", titulo: `${stuck.n} correo(s) llevan más de 10 minutos sin salir`, detalle: k ? k.causa : "Se están reintentando o no hay quien los procese.", solucion: k ? k.solucion : "Comprueba que el temporizador crea-tick-cola esté activo: systemctl list-timers crea-tick-cola.timer" }); }
  const failed = (await db.query("SELECT count(*)::int n FROM emails WHERE status='error'"))[0].n;
  if (failed > 0) { const last = (await db.query("SELECT last_error FROM emails WHERE status='error' ORDER BY created_at DESC LIMIT 1"))[0]?.last_error; const k = classifyMailError(last); add({ nivel: "critico", titulo: `${failed} correo(s) fallaron tras todos los reintentos`, detalle: k ? k.causa : String(last ?? ""), solucion: (k ? k.solucion + " Después " : "") + "usa «Reintentar fallidos» en este panel." }); }
  const bad = (await db.query("SELECT count(*)::int n FROM emails WHERE delivery_status IN ('bounced','complained') AND created_at > now() - interval '7 days'"))[0].n;
  if (bad > 0) add({ nivel: "aviso", titulo: `${bad} correo(s) rebotaron o fueron marcados como spam (7 días)`, detalle: "El proveedor aceptó el mensaje pero NO llegó (dirección inexistente, buzón lleno o rechazo).", solucion: "Revisa el detalle por correo; confirma que el destinatario escribió bien su dirección." });
  if (c.webhookSecretSet) { const lost = (await db.query("SELECT count(*)::int n FROM emails WHERE status='enviado' AND delivery_status='aceptado' AND sent_at < now() - interval '30 minutes' AND sent_at > now() - interval '7 days'"))[0].n;
    if (lost > 0) add({ nivel: "aviso", titulo: `${lost} correo(s) enviados hace más de 30 min sin confirmación de entrega`, detalle: "El webhook de Resend no está llegando (URL o secreto incorrectos) o el mensaje sigue demorado.", solucion: "En Resend → Webhooks revisa los intentos de entrega a /api/email/webhook y que el secreto coincida." }); }
  return { issues, stats, configured: c.keySet && !!c.from && c.fromOk };
}

/** Revisa en el DNS REAL los registros que Resend pide (solo lectura). Los valores exactos los da Resend: aquí solo se comprueba que existan y no choquen con los actuales. */
export async function checkDns(domain: string): Promise<{ registro: string; estado: "ok" | "falta" | "aviso"; detalle: string }[]> {
  const out: { registro: string; estado: "ok" | "falta" | "aviso"; detalle: string }[] = [];
  const txt = async (n: string) => { try { return (await dns.resolveTxt(n)).map((a) => a.join("")); } catch { return null; } };
  const mx = async (n: string) => { try { return await dns.resolveMx(n); } catch { return null; } };
  const dkim = await txt(`resend._domainkey.${domain}`); out.push({ registro: `resend._domainkey.${domain} (TXT, DKIM)`, estado: dkim?.some((t) => /p=/.test(t)) ? "ok" : "falta", detalle: dkim ? (dkim.some((t) => /p=/.test(t)) ? "Clave DKIM publicada." : "Existe pero sin «p=».") : "No existe. Cópialo desde Resend → Domains." });
  const smx = await mx(`send.${domain}`); out.push({ registro: `send.${domain} (MX, ruta de rebote)`, estado: smx?.some((m) => /amazonses\.com/i.test(m.exchange)) ? "ok" : "falta", detalle: smx ? smx.map((m) => `${m.priority} ${m.exchange}`).join(", ") : "No existe. Cópialo desde Resend → Domains." });
  const stx = await txt(`send.${domain}`); out.push({ registro: `send.${domain} (TXT, SPF)`, estado: stx?.some((t) => /v=spf1/.test(t) && /amazonses\.com/.test(t)) ? "ok" : "falta", detalle: stx ? stx.join(" | ").slice(0, 160) : "No existe. Cópialo desde Resend → Domains." });
  const dm = await txt(`_dmarc.${domain}`); out.push({ registro: `_dmarc.${domain} (TXT, DMARC)`, estado: dm?.some((t) => /^v=DMARC1/i.test(t)) ? "ok" : "aviso", detalle: dm ? dm.join(" | ").slice(0, 160) : "No existe (recomendado): v=DMARC1; p=none; rua=mailto:tu@correo" });
  const root = await txt(domain); const spf = (root ?? []).filter((t) => /^v=spf1/i.test(t)); out.push({ registro: `${domain} (TXT raíz, SPF existente)`, estado: spf.length > 1 ? "aviso" : "ok", detalle: spf.length > 1 ? "HAY MÁS DE UN SPF en la raíz: es inválido; fusiónalos en uno solo (no borres el de tu correo actual)." : spf.length === 1 ? "Un solo SPF (no se toca). " + spf[0].slice(0, 120) : "Sin SPF en la raíz (no es necesario para Resend, que usa el subdominio send)." });
  const rmx = await mx(domain); out.push({ registro: `${domain} (MX raíz, correo recibido)`, estado: "ok", detalle: rmx ? "Existe (tu correo de entrada): NO lo toques." : "No hay MX en la raíz." });
  return out;
}
