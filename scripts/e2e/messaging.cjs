// E2E de mensajería por HTTP real. El ÚNICO elemento simulado es el servidor de la API de Telegram (local). Uso:
//   rm -rf .data && npx tsx scripts/e2e/seed_messaging.ts /tmp/ids.json && npm run build
//   TELEGRAM_API_BASE=http://127.0.0.1:4010 TELEGRAM_BOT_TOKEN=000:test TELEGRAM_WEBHOOK_SECRET=e2e-secret TELEGRAM_BOT_USERNAME=demo_bot APP_SECRET=$(openssl rand -base64 32) npx next start -p 3111 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/messaging.cjs docs/evidencia/mensajeria
const { chromium } = require("playwright"); const http = require("http"); const OUT = process.argv[2]; const base = "http://localhost:3111"; const SEC = "e2e-secret";
let failed = 0; const ok = (m) => console.log("✓", m); const bad = (m) => { failed++; console.error("✗", m); }; const check = (c, m) => (c ? ok(m) : bad(m));
const sent = []; // lo que "Telegram" recibió del bot
const mock = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { try { sent.push({ path: req.url.replace(/bot[^/]+/, "bot***"), ...JSON.parse(b) }); } catch {} res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, result: { message_id: sent.length } })); }); });
const wait = async (cond, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };
let uid = 100; const upd = (chat, text, id) => ({ update_id: id ?? ++uid, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: chat, type: "private" }, from: { id: chat, is_bot: false, first_name: "Ana" }, text } });
const post = (body, secret = SEC) => fetch(base + "/api/channels/telegram", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) }, body: JSON.stringify(body) });
const last = () => sent.at(-1)?.text ?? "";
(async () => {
  await new Promise((r) => mock.listen(4010, "127.0.0.1", r));
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto(base + "/login"); await p.fill("[name=email]", "ana@demo.test"); await p.fill("[name=password]", "clave-muy-larga-1"); await p.click("button"); await p.waitForURL(/agencia/);
  await p.goto(base + "/celular"); ok("página «Mi oficina en el celular» abre");
  // 1) sin consentimiento no genera código
  await p.locator("[data-testid=link-telegram] button").click(); await p.waitForTimeout(500); check(!(await p.locator("[data-testid=link-code]").count()), "sin aceptar el consentimiento no se genera código (el navegador lo exige)");
  await p.locator("[data-testid=link-telegram] input[name=consent]").check(); await p.locator("[data-testid=link-telegram] button").click(); await p.waitForSelector("[data-testid=link-code]");
  const code = (await p.locator("[data-testid=link-code]").innerText()).trim(); check(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), "código temporal mostrado en pantalla");
  check(!p.url().includes(code), "el código no viaja en la URL");
  check((await p.locator("[data-testid=link-telegram] a.btn").getAttribute("href")) === `https://t.me/demo_bot?start=${code}`, "enlace profundo oficial de Telegram (t.me/<bot>?start=<código>)");
  await p.screenshot({ path: `${OUT}/01-conectar-telegram.png` });
  // 2) webhook: seguridad
  check((await post(upd(4242, "hola"), "mal")).status === 401, "webhook con secreto incorrecto → 401");
  check((await post(upd(4242, "hola"), null)).status === 401, "webhook sin secreto → 401");
  check(sent.length === 0, "nada se respondió a un webhook no autenticado");
  // 3) chat desconocido
  check((await post(upd(999, "mis clientes"))).status === 200, "chat desconocido: aceptado pero sin acceso"); await wait(() => sent.length >= 1);
  check(/no está vinculado/.test(last()) && !/Alquimia|Beta/.test(last()), "chat desconocido: solo recibe instrucciones de vinculación (sin datos)");
  // 4) vinculación desde el canal
  sent.length = 0; await post(upd(4242, `/start ${code}`)); await wait(() => sent.length >= 1);
  check(/vinculado|Listo/.test(last()) && sent[0].chat_id === "4242", "vinculación confirmada desde Telegram; bienvenida enviada al chat correcto");
  await post(upd(4242, `/start ${code}`)); await new Promise((r) => setTimeout(r, 1500)); check(sent.length === 1 || !/Listo/.test(last()), "el código no sirve dos veces");
  // 5) ayuda y selección de empresa
  sent.length = 0; await post(upd(4242, "mis clientes")); await wait(() => sent.length >= 1);
  check(/Alquimia Demo/.test(last()) && /Tienda Beta/.test(last()) && !/Secreto/.test(last()), "«mis clientes» lista solo las empresas de su agencia");
  // 6) tarea en lenguaje natural + duplicado
  sent.length = 0; const u = upd(4242, "Investiga cinco competidores para mi cliente Alquimia"); await post(u); await post(u); // mismo update_id dos veces
  await wait(() => sent.some((s) => /Recibido/.test(s.text))); await new Promise((r) => setTimeout(r, 1500));
  check(sent.filter((s) => /Recibido/.test(s.text)).length === 1 && /Analista de competidores \(Alquimia Demo\)/.test(sent.find((s) => /Recibido/.test(s.text)).text), "tarea creada y confirmada UNA sola vez (webhook duplicado ignorado), agente y empresa correctos");
  // 7) la tarea corre en la cola; sin clave de IA falla de forma honesta y avisa
  check(await wait(() => sent.some((s) => /no se pudo completar/.test(s.text)), 20000), "la cola ejecutó la tarea con el motor existente: sin clave de IA falla y avisa el motivo («" + (sent.find((s) => /no se pudo completar/.test(s.text))?.text.split("\n")[0].slice(0, 70) ?? "") + "…»)");
  // 8) otra agencia: sin acceso por chat a datos ajenos
  sent.length = 0; await post(upd(4242, "Investiga competidores para mi cliente Secreto")); await wait(() => sent.length >= 1);
  check(/No encontré la empresa/.test(last()), "mencionar un cliente de otra agencia: «no encontré» (sin revelar nada)");
  // 9) página con historial y vinculaciones
  await p.goto(base + "/celular"); await p.waitForSelector("text=conectado");
  check((await p.content()).includes("Telegram") && (await p.content()).includes("••••4242"), "identidad vinculada visible, enmascarada (••••4242)");
  check((await p.locator("text=Investiga cinco competidores").count()) > 0, "historial de tareas iniciadas por mensajes");
  await p.screenshot({ path: `${OUT}/02-vinculaciones-e-historial.png`, fullPage: true });
  // 10) revocación desde la app
  await p.locator("button", { hasText: "Desconectar este celular" }).first().click(); await p.waitForSelector("text=Acceso revocado");
  sent.length = 0; await post(upd(4242, "mis clientes")); await wait(() => sent.length >= 1);
  check(/no está vinculado/.test(last()) && !/Alquimia/.test(last()), "tras revocar, el chat vuelve a ser desconocido (sin acceso)");
  await p.screenshot({ path: `${OUT}/03-revocado.png` });
  // 11) móvil
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); await m.goto(base + "/login"); await m.fill("[name=email]", "ana@demo.test"); await m.fill("[name=password]", "clave-muy-larga-1"); await m.click("button"); await m.waitForURL(/agencia/); await m.goto(base + "/celular");
  check(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "página sin scroll horizontal en móvil"); await m.screenshot({ path: `${OUT}/04-movil.png` });
  await b.close(); mock.close(); console.log(failed ? `\n${failed} FALLO(S)` : "\nTODO OK"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FALLÓ", e.message); process.exit(1); });
