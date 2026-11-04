// Diagnóstico REAL del correo, etapa por etapa, ejecutado EN EL SERVIDOR (no muestra claves ni enlaces).
//   npm run correo:diagnostico                       → configuración, cola, salida a internet y DNS
//   npm run correo:diagnostico -- --admin            → además envía un correo de PRUEBA al primer correo de PLATFORM_ADMIN_EMAILS
//   npm run correo:diagnostico -- --enviar a@b.com   → ídem a otro destinatario
//   (agrega --esperar para consultar al proveedor el estado del mensaje, si la clave lo permite)
import { getDb } from "../src/server/db";
import { mailConfig, mailProvider, MailError } from "../src/server/commerce/mail";
import { checkDns, diagnoseEmail, maskEmail } from "../src/server/commerce/email_health";
import { esc, layout, plain } from "../src/server/commerce/email_templates";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? (process.argv[i + 1] ?? "") : null; };
const has = (k: string) => process.argv.includes(k); const ok = (m: string) => console.log("✅", m), bad = (m: string) => console.log("❌", m), warn = (m: string) => console.log("⚠️ ", m);
(async () => {
  const c = mailConfig(); console.log("\n== 1. Configuración (sin mostrar secretos) ==");
  c.keySet ? ok(`RESEND_API_KEY definida (${c.keyShapeOk ? "formato re_… correcto" : "formato inesperado"})`) : bad("RESEND_API_KEY NO está definida");
  c.from ? (c.fromOk ? ok(`MAIL_FROM definido, dominio remitente: ${c.fromDomain}`) : bad("MAIL_FROM con formato inválido")) : bad("MAIL_FROM NO está definido");
  c.webhookSecretSet ? ok("RESEND_WEBHOOK_SECRET definido (estado de entrega real activo)") : warn("RESEND_WEBHOOK_SECRET no definido: solo sabremos que el proveedor ACEPTÓ el mensaje");
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""; /^https:\/\//.test(site) ? ok(`Dirección pública de los enlaces: ${site}`) : bad("NEXT_PUBLIC_SITE_URL/SITE_URL ausente o sin https:// (los enlaces del correo saldrían mal)");
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean); admins.length ? ok(`PLATFORM_ADMIN_EMAILS: ${admins.length} correo(s) de operador`) : warn("PLATFORM_ADMIN_EMAILS vacío: nadie entraría a /admin");
  console.log("\n== 2. Cola de correos y diagnóstico ==");
  const db = await getDb(); const d = await diagnoseEmail(db); console.log("   Estados:", JSON.stringify(d.stats));
  if (!d.issues.length) ok("Sin problemas detectados en la cola"); for (const i of d.issues) { (i.nivel === "critico" ? bad : warn)(`${i.titulo}\n      ${i.detalle}\n      → ${i.solucion}`); }
  console.log("\n== 3. ¿El servidor llega al proveedor? ==");
  try { const r = await fetch(c.base, { method: "GET", signal: AbortSignal.timeout(10_000) }); ok(`Se conecta a ${new URL(c.base).host} (HTTP ${r.status})`); } catch (e: any) { bad(`NO llega a ${new URL(c.base).host}: ${String(e?.cause?.code ?? e?.message)} → revisa DNS/firewall de salida del VPS`); }
  if (c.fromDomain) { console.log(`\n== 4. DNS de ${c.fromDomain} (lectura en vivo) ==`); try { for (const r of await checkDns(c.fromDomain)) (r.estado === "ok" ? ok : r.estado === "aviso" ? warn : bad)(`${r.registro}: ${r.detalle}`); } catch (e: any) { warn("No se pudo consultar el DNS: " + e.message); } }
  const to = has("--admin") ? admins[0] : arg("--enviar");
  if (to) {
    console.log(`\n== 5. Envío de prueba REAL a ${maskEmail(to)} ==`); const p = mailProvider();
    if (!p) bad("No hay proveedor configurado: no se puede enviar."); else {
      const s = site || "https://example.invalid"; const stamp = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
      try { const id = await p.send({ to, subject: "Prueba de correo de Crea tu Oficina IA", text: plain({ title: "Prueba de correo", lines: [`Si lees esto, el proveedor ACEPTÓ y entregó el mensaje. Enviado: ${stamp}.`] }), html: layout({ site: s, preheader: "Prueba de entrega.", title: "Prueba de correo", blocks: [{ p: `Si lees este mensaje, el correo de <strong>Crea tu Oficina IA</strong> funciona de punta a punta.` }, { note: `Enviado: ${esc(stamp)} (hora de Ciudad de México). Este mensaje no contiene enlaces de acceso.` }] }) });
        ok(`Resend ACEPTÓ el mensaje (id ${id.slice(0, 8)}…). Ahora confirma que LLEGÓ: revisa tu bandeja y «Spam».`);
        if (has("--esperar")) { for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 5000)); const r = await fetch(`${c.base}/emails/${id}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } }).catch(() => null); if (!r) continue; if (r.status === 401 || r.status === 403) { warn("La clave (solo envío) no permite consultar el estado. Usa el webhook y el panel «Correos» para ver la entrega."); break; } const j: any = await r.json().catch(() => ({})); console.log(`   estado del proveedor: ${j.last_event ?? "desconocido"}`); if (["delivered", "bounced", "complained"].includes(j.last_event)) { (j.last_event === "delivered" ? ok : bad)(`El proveedor reporta: ${j.last_event}`); break; } } }
      } catch (e: any) { bad(`Resend RECHAZÓ el mensaje: ${e instanceof MailError ? `${e.status} ${e.code} — ${e.message}` : e.message}`); }
    }
  } else console.log("\n(Para probar el envío real: npm run correo:diagnostico -- --admin)");
  console.log("\nRecuerda: «aceptado por la API» NO es «llegó al buzón». La confirmación final es ver el correo en tu bandeja (o el estado «Entregado» en /admin/correos con el webhook activo).\n"); await db.close(); process.exit(0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
