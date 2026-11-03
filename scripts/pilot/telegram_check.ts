// Verificación REAL de Telegram SIN enviar mensajes (solo getMe y getWebhookInfo). Opcional: si defines TELEGRAM_TEST_CHAT_ID
// (tu propio chat, a propósito) envía UN mensaje de prueba. Uso: TELEGRAM_BOT_TOKEN=... npm run pilot:telegram
(async () => {
  const t = process.env.TELEGRAM_BOT_TOKEN; if (!t) { console.log("NO VERIFICADO: falta TELEGRAM_BOT_TOKEN. No se contactó a Telegram."); process.exit(2); }
  const base = `${process.env.TELEGRAM_API_BASE || "https://api.telegram.org"}/bot${t}`;
  const get = async (m: string) => (await fetch(`${base}/${m}`, { signal: AbortSignal.timeout(15000) })).json() as Promise<any>;
  const me = await get("getMe"); if (!me.ok) { console.log("✗ Token no válido:", me.description); process.exit(1); }
  const wh = await get("getWebhookInfo");
  console.log(`✓ Bot real: @${me.result.username}. Webhook actual: ${wh.result?.url || "(ninguno)"}${wh.result?.last_error_message ? ` · último error: ${wh.result.last_error_message}` : ""}`);
  console.log("  Para recibir mensajes: setWebhook a https://TU-DOMINIO/api/channels/telegram con secret_token = TELEGRAM_WEBHOOK_SECRET (ver docs/MENSAJERIA.md).");
  const chat = process.env.TELEGRAM_TEST_CHAT_ID; if (chat) { const r = await (await fetch(`${base}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: "Prueba del piloto Nova AI Solutions (mensaje de verificación)." }) })).json() as any; console.log(r.ok ? "✓ Mensaje de prueba enviado a tu chat." : `✗ No se pudo enviar: ${r.description}`); process.exit(r.ok ? 0 : 1); }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
