/**
 * Plantillas de correo: HTML (tablas + estilos en línea, apto para Gmail/Outlook/celular) y texto plano. Logo e identidad de Crea tu Oficina IA.
 * Todo texto variable se ESCAPA. Los enlaces con token solo existen en el cuerpo enviado; nunca se guardan en la base ni se registran.
 */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export interface Mail { subject: string; text: string; html: string }
export interface Block { p?: string; strong?: string; list?: string[]; note?: string }
const C = { bg: "#060616", card: "#ffffff", ink: "#16152b", muted: "#5b5978", brand: "#6d3df0", brand2: "#8b5cf6", line: "#e6e4f5", soft: "#f4f2ff" };

export function layout(o: { site: string; preheader: string; title: string; blocks: Block[]; cta?: { label: string; url: string }; footerNote?: string }): string {
  const logo = o.site ? `${o.site}/icons/icon-192.png` : "";
  const body = o.blocks.map((b) => b.p ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink}">${b.p}</p>`
    : b.strong ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink}"><strong>${b.strong}</strong></p>`
    : b.list ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:${C.ink}">${b.list.map((i) => `<li>${i}</li>`).join("")}</ul>`
    : b.note ? `<p style="margin:16px 0 0;padding:12px 14px;background:${C.soft};border-radius:10px;font-size:13px;line-height:1.55;color:${C.muted}">${b.note}</p>` : "").join("");
  const button = o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:10px;background:${C.brand}"><a href="${esc(o.cta.url)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:linear-gradient(135deg,${C.brand},${C.brand2})">${esc(o.cta.label)}</a></td></tr></table>
    <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${C.muted}">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${esc(o.cta.url)}" style="color:${C.brand};word-break:break-all">${esc(o.cta.url)}</a></p>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title>
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding:24px 18px!important}h1{font-size:22px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
<tr><td style="padding:0 4px 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo ? `<td style="padding-right:12px"><img src="${esc(logo)}" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0"></td>` : ""}<td style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff">Crea tu Oficina IA</td></tr></table></td></tr>
<tr><td class="pad" style="background:${C.card};border-radius:16px;padding:34px 32px;font-family:Inter,Segoe UI,Arial,sans-serif">
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:${C.ink}">${esc(o.title)}</h1>${body}${button}
<hr style="border:0;border-top:1px solid ${C.line};margin:22px 0 14px"><p style="margin:0;font-size:12px;line-height:1.55;color:${C.muted}">${o.footerNote ?? ""}</p></td></tr>
<tr><td style="padding:16px 8px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:#a9a7c6;text-align:center">Crea tu Oficina IA · Este es un correo automático de tu cuenta.${o.site ? `<br><a href="${esc(o.site)}/ayuda/tutoriales#soporte" style="color:#b9a2ff">Ayuda y soporte</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}
/** Texto plano equivalente (para clientes sin HTML y para la puntuación anti-spam). */
export function plain(o: { title: string; lines: string[]; cta?: { label: string; url: string }; footer?: string }): string {
  return [o.title, "", ...o.lines, ...(o.cta ? ["", `${o.cta.label}: ${o.cta.url}`] : []), "", o.footer ?? "", "— Crea tu Oficina IA"].join("\n");
}
