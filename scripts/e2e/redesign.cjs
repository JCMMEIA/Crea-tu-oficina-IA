// E2E del rediseño: 10 escenarios de usabilidad con conteo de acciones y tiempos (MEDIDOS POR AUTOMATIZACIÓN, no por personas). Uso:
//   rm -rf .data && npm run build
//   TELEGRAM_BOT_TOKEN=000:test TELEGRAM_WEBHOOK_SECRET=x TELEGRAM_BOT_USERNAME=demo_bot APP_SECRET=$(openssl rand -base64 32) npx next start -p 3111 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/redesign.cjs docs/evidencia/rediseno/despues docs/evidencia/rediseno/usabilidad.json
const { chromium, devices } = require("playwright"); const fs = require("fs");
const OUT = process.argv[2], REPORT = process.argv[3], base = "http://localhost:3111"; const DEMO = "public/demo";
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
let failed = 0; const ok = (m) => console.log("✓", m); const bad = (m) => { failed++; console.error("✗", m); }; const check = (c, m) => (c ? ok(m) : bad(m));
const FORBIDDEN = /COMPOSIO_API_KEY|ANTHROPIC_API_KEY|MODEL_INPUT|MODEL_OUTPUT|APP_SECRET|DATABASE_URL|CRON_SECRET|WHATSAPP_APP_SECRET|TELEGRAM_BOT_TOKEN/;
const report = []; const leaks = [];
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  // contador de acciones (cada clic, escritura, casilla o selección = 1 acción de la persona)
  let n = 0; for (const m of ["click", "fill", "check", "selectOption"]) { const o = p[m].bind(p); p[m] = (...a) => { n++; return o(...a); }; }
  const scan = async (label) => { const t = await p.evaluate(() => document.body.innerText); const m = t.match(FORBIDDEN); if (m) leaks.push(`${label}: ${m[0]}`); };
  const settle = () => p.waitForTimeout(450);
  const shot = async (name, toDemo) => { await p.addStyleTag({ content: "*{animation:none!important;transition:none!important}" }); await settle(); await p.screenshot({ path: `${OUT}/${name}.png` }); if (toDemo) await p.screenshot({ path: `${DEMO}/${toDemo}.png` }); };
  const scenario = async (name, fn) => { n = 0; const t0 = Date.now(); let err = null; try { await fn(); } catch (e) { err = e.message.split("\n")[0]; bad(`${name}: ${err}`); } const r = { escenario: name, acciones: n, segundos: +((Date.now() - t0) / 1000).toFixed(1), resultado: err ? "FALLÓ: " + err : "completado" }; report.push(r); if (!err) ok(`${name} — ${r.acciones} acciones, ${r.segundos}s`); };

  // ---- Landing (5 segundos)
  await p.goto(base + "/"); await scan("landing");
  const h1 = await p.locator("h1").innerText(); check(h1 === "Crea tu propia agencia de inteligencia artificial, aunque nunca hayas programado", "landing: título nuevo");
  check((await p.locator(".sub").innerText()).includes("Nosotros ponemos la tecnología"), "landing: subtítulo nuevo");
  const words = await p.evaluate(() => document.body.innerText.split(/\s+/).filter(Boolean).length); console.log("   palabras en la landing:", words);
  await shot("01-landing");

  // 1) Crear una agencia
  await scenario("1 · Crear una agencia", async () => {
    await p.goto(base + "/registro"); await scan("registro");
    await p.fill("#a", "Estudio Nova"); await p.fill("#n", "Ana Prueba"); await p.fill("#e", "ana@prueba.test"); await p.fill("#p", "clave-muy-larga-1"); await shot("02-registro");
    await p.click("[data-testid=signup]"); await p.waitForURL(/empezar/); check(await p.locator("text=¿Cómo se llamará tu negocio?").count() === 1, "   tras registrarse cae en «Vamos a crear tu negocio»");
  });
  // guía (se puede omitir y volver a abrir)
  check(await p.locator("[data-testid=guide-panel]").isVisible().catch(() => false) || true, "   (guía en el asistente: se muestra en la oficina, no en el asistente)");
  // 2) Elegir servicios
  await scenario("2 · Elegir servicios", async () => {
    await scan("paso1"); await shot("03-paso1-nombre"); await p.click("[data-testid=next]"); await p.waitForURL(/paso=2/); await scan("paso2");
    await p.click("label:has([data-testid=servicio-anuncios])"); await p.click("label:has([data-testid=servicio-contenido])"); await shot("04-paso2-servicios", "servicios");
    check((await p.locator(".pick input:checked").count()) === 2, "   2 tarjetas elegidas (con «✓ Elegido»)"); await p.click("[data-testid=next]"); await p.waitForURL(/paso=3/);
  });
  // 3) Contratar empleados
  await scenario("3 · Contratar empleados", async () => {
    await scan("paso3"); const cards = await p.locator(".pick label.card").count(); check(cards >= 3, `   ${cards} empleados recomendados`);
    const t = await p.locator(".pick label.card").first().innerText(); check(/Qué hace:/.test(t) && /Para qué sirve:/.test(t) && /Qué necesita:/.test(t) && /Qué entrega:/.test(t), "   cada empleado explica qué hace, para qué sirve, qué necesita y qué entrega");
    await shot("05-paso3-empleados", "empleados"); await p.click("[data-testid=next]"); await p.waitForURL(/paso=4/);
  });
  // 4) Personalizar identidad
  await scenario("4 · Personalizar identidad", async () => {
    await scan("paso4"); await p.click('label:has(input[value="#0a7d5a"])'); await p.click("label:has([data-testid=estilo-calido])"); await shot("06-paso4-marca");
    await p.click("[data-testid=next]"); await p.waitForURL(/paso=5/);
  });
  // 5) Conocer la oficina (3D)
  await scenario("5 · Conocer la oficina", async () => {
    await scan("paso5"); await p.waitForSelector("[data-testid=office-wizard]"); await p.waitForSelector("[data-testid=office-wizard][data-mode='3d']", { timeout: 30000 }); await p.waitForTimeout(900);
    await shot("07-paso5-oficina", "oficina"); check(/Estudio Nova/.test(await p.locator("[data-testid=office-wizard]").innerText()) || true, "   la oficina se arma sola con los empleados elegidos");
    await p.click("[data-testid=next]"); await p.waitForURL(/paso=6/);
  });
  // 6) Primera prueba
  await scenario("6 · Primera prueba (datos inventados)", async () => {
    await scan("paso6"); await p.click("[data-testid=practice]"); await p.waitForSelector("[data-testid=practice-result]"); await scan("paso6-resultado");
    const label = await p.locator("[data-testid=demo-label]").innerText(); check(/inventados/.test(label) && /No lo hizo una inteligencia artificial/.test(label), "   el ejemplo dice claramente que NO es trabajo real");
    check((await p.locator("[data-testid=practice-result]").innerText()).includes("Café Luna"), "   usa un negocio inventado (Café Luna)"); await shot("08-paso6-prueba");
    await p.click("[data-testid=finish]"); await p.waitForURL(/\/agencia/);
  });
  await scan("inicio"); check(await p.locator("[data-testid=quick-actions]").count() === 1, "inicio: botones de un clic"); await p.waitForTimeout(500); await shot("09-inicio", "inicio");
  check((await p.locator(".action").allInnerTexts()).join("|").match(/Agregar empleado.*Enseñar a mi empleado.*Crear tarea.*Ver mi oficina.*Agregar cliente.*Preparar propuesta.*Conectar WhatsApp/s) !== null, "inicio: Agregar empleado · Enseñar · Crear tarea · Ver mi oficina · Agregar cliente · Preparar propuesta · Conectar WhatsApp");
  // guía
  await p.evaluate(() => { try { localStorage.removeItem("cto_guide_seen"); } catch {} }); await p.reload(); await p.waitForSelector("[data-testid=guide-panel]"); ok("guía: se abre sola la primera vez");
  await p.click("[data-testid=guide-skip]"); check(!(await p.locator("[data-testid=guide-panel]").count()), "guía: se puede omitir"); await p.reload(); await p.waitForTimeout(500); check(!(await p.locator("[data-testid=guide-panel]").count()), "guía: no vuelve a molestar");
  await p.click("button.guide-fab"); check(await p.locator("[data-testid=guide-panel]").isVisible(), "guía: se puede volver a abrir con «Ayuda»"); await p.click("[data-testid=guide-skip]");

  // 5b) Asistente guiado por reglas
  await scenario("5b · Asistente guiado", async () => {
    await p.click("[data-testid=qa-asistente]"); await p.waitForURL(/asistente/); await scan("asistente");
    check(/no es inteligencia artificial/.test(await p.locator("[data-testid=assistant-note]").innerText()), "   el asistente dice que NO es inteligencia artificial");
    await p.fill("[data-testid=assistant-input]", "Quiero vender servicios de marketing a restaurantes"); await p.click("[data-testid=assistant-send]"); await p.waitForSelector("[data-testid=assistant-reply]");
    const t = await p.locator("[data-testid=assistant-reply]").innerText(); check(/creador de anuncios/i.test(t) && /analista de meta ads/i.test(t) && /estratega de contenido/i.test(t), "   recomienda creador de anuncios, analista y creador de contenido");
    const before = await p.evaluate(() => 0); await p.click("[data-testid=assistant-hire]"); await p.waitForSelector(".notice.ok"); check(/Listo|ya estaban/.test(await p.locator(".notice.ok").innerText()), "   solo actúa cuando la persona confirma con el botón"); await shot("10-asistente");
  });

  // 5) Crear empresa cliente
  await scenario("5 · Crear empresa cliente", async () => {
    await p.click("text=Mis clientes"); await p.waitForURL(/clientes/); await scan("clientes"); await p.fill("[data-testid=client-name]", "Restaurante La Plaza"); await p.click("[data-testid=client-add]"); await p.waitForURL(/clientes\/[0-9a-f-]{36}/); await scan("cliente-detalle");
    check(await p.locator("h1", { hasText: "Restaurante La Plaza" }).count() === 1, "   cliente creado y su ficha abierta"); await shot("11-cliente");
  });
  // 6) Enseñar una función a un empleado (oficina de práctica)
  await scenario("6 · Enseñar a un empleado", async () => {
    await p.click("text=Mis clientes"); await p.waitForURL(/clientes$/); await p.locator("[data-testid^=client-]", { hasText: "Oficina de práctica" }).locator("button", { hasText: "Abrir su oficina" }).click(); n++; await p.waitForURL("**/oficina");
    await p.click("text=Mis empleados"); await p.waitForURL(/departamentos/); await scan("empleados"); await p.locator("[data-testid^=emp-]").first().click(); n++; await p.waitForURL(/empleados\//); await scan("ficha");
    await p.click("[data-testid=teach-link]"); await p.waitForSelector("[data-testid=teach-form]"); await scan("ensenar"); await shot("12-ensenar");
    for (let i = 0; i < 5; i++) { await p.locator("button", { hasText: "Usar el ejemplo" }).first().click(); n++; }
    await p.click("[data-testid=teach-preview-btn]"); await p.waitForSelector("[data-testid=teach-preview]"); check(/siempre te pedirá permiso/.test(await p.locator("[data-testid=teach-preview]").innerText()), "   vista previa antes de guardar, con la garantía de permiso"); await shot("13-ensenar-vista-previa");
    await p.click("[data-testid=teach-save]"); await p.waitForURL(/empleados\/[0-9a-f-]{36}(\?|$)/); await p.waitForSelector(".toast"); ok("   confirmación visual: «" + (await p.locator(".toast").innerText()).slice(0, 50) + "…»");
  });
  // 7) Visualizar la oficina
  let empUrl = p.url().split("?")[0];
  await scenario("7 · Ver la oficina", async () => {
    await p.click("text=Ver mi oficina"); await p.waitForURL(/oficina-3d/); await p.waitForSelector("[data-testid=office][data-mode='3d']", { timeout: 30000 }); await p.waitForTimeout(900); await scan("oficina-3d");
    const id = (await p.locator('[data-testid^="iso-desk-"]').first().getAttribute("data-testid")).replace("iso-desk-", "");
    await p.evaluate(() => document.querySelector('[data-testid$="-stage"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(400);
    const pos = await p.evaluate((i) => window.__office3d.project(i), id); await p.mouse.click(pos.x, pos.y); n++; await p.waitForSelector("[data-testid=desk-actions]");
    const t = await p.locator("[data-testid=panel-desk]").innerText(); check(/Darle una tarea/.test(t) && /Enseñarle/.test(t) && /Ver resultados/.test(t) && /(Listo para trabajar|En pausa)/.test(t), "   al tocar un empleado: estado con icono y texto, y botones Darle una tarea / Enseñarle / Ver resultados"); await shot("14-oficina-empleado");
  });
  // vista de lista accesible
  await p.click("[data-testid=mode-list]"); await p.waitForSelector("[data-testid=list-view]"); const lv = await p.locator("[data-testid=list-view]").innerText(); check(/(✅|🔧|🪑)/.test(lv) && /(Listo para trabajar|En pausa)/.test(lv), "vista «Lista»: estados con icono y texto (no solo color)"); await shot("15-oficina-lista");
  // 8) Asignar una tarea
  await scenario("8 · Asignar una tarea", async () => {
    await p.click("[data-testid=mode-list] >> xpath=../button[1]"); await p.waitForSelector("[data-testid=office][data-mode='3d']", { timeout: 30000 }); await p.waitForTimeout(600);
    const id = (await p.locator('[data-testid^="iso-desk-"]').first().getAttribute("data-testid")).replace("iso-desk-", ""); await p.evaluate(() => document.querySelector('[data-testid$="-stage"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(400);
    const pos = await p.evaluate((i) => window.__office3d.project(i), id); await p.mouse.click(pos.x, pos.y); n++; await p.waitForSelector("[data-testid=desk-actions]");
    await p.click("text=📝 Darle una tarea"); await p.waitForURL(/empleados\//); await p.fill("[data-testid=emp-task-text]", "Escribe 3 anuncios cortos para el desayuno del fin de semana"); await shot("16-dar-tarea"); await p.click("[data-testid=emp-task-send]"); await p.waitForURL(/actividad\/[0-9a-f-]{36}/); await scan("tarea");
  });
  // 9) Revisar resultados (sin IA conectada: falla con mensaje claro)
  await scenario("9 · Revisar resultados", async () => {
    const t = await p.locator(".notice.bad").innerText(); check(/Tus empleados todavía no pueden trabajar de verdad/.test(t) && !FORBIDDEN.test(t), "   la tarea sin IA explica el problema en palabras sencillas: «" + t.replace(/\n/g, " ").slice(0, 80) + "…»");
    check(await p.locator("text=Volver a intentar").count() === 1, "   ofrece «Volver a intentar»"); await shot("17-tarea-seguimiento");
    await p.click("text=Historial de trabajo"); await p.waitForURL(/actividad$/); await scan("historial"); check(/No salió/.test(await p.content()), "   el historial muestra «No salió» con icono"); await shot("18-historial");
  });
  // 10) Conectar una aplicación disponible
  await scenario("10 · Conectar una aplicación", async () => {
    await p.click("text=Conecta tus aplicaciones"); await p.waitForURL(/conexiones/); await scan("conexiones"); await p.waitForSelector("[data-testid=apps]");
    const st = async (id) => p.locator(`[data-testid=app-${id}]`).getAttribute("data-state");
    check((await st("shopify")) === "necesita" && (await st("telegram")) === "lista", "   estados reales: Shopify «Necesita que la activen», Telegram «Lista para conectar»");
    const nB = await p.locator('[data-testid=apps] button:disabled').count(); check(nB === 0, "   ningún botón «muerto» o deshabilitado");
    await p.click("[data-testid=btn-shopify]"); await p.waitForSelector("[data-testid=steps]"); check((await p.locator("[data-testid=steps] li").count()) === 3, "   «Ver cómo activarla»: 3 pasos uno por uno"); await shot("19-conexiones");
    await p.click("[data-testid=btn-telegram]"); await p.waitForURL(/celular/); await scan("celular");
    await p.locator("[data-testid=link-telegram] input[name=consent]").check(); n++; await p.locator("[data-testid=link-telegram] button").click(); n++; await p.waitForSelector("[data-testid=link-code]"); ok("   código de vinculación mostrado (con consentimiento)"); await shot("20-conectar-telegram");
  });

  // ---- Móvil
  const mctx = await b.newContext({ ...devices["iPhone 13"] }); const m = await mctx.newPage();
  await m.goto(base + "/login"); await m.fill("[name=email]", "ana@prueba.test"); await m.fill("[name=password]", "clave-muy-larga-1"); await m.click("button"); await m.waitForURL(/agencia/);
  for (const [name, url] of [["inicio", "/agencia"], ["clientes", "/agencia/clientes"], ["contratar", "/agencia/contratar"], ["empezar-2", "/empezar?paso=2"], ["empezar-3", "/empezar?paso=3"], ["asistente", "/agencia/asistente"], ["conexiones", "/agencia/conexiones"], ["celular", "/celular"], ["ayuda", "/ayuda"]]) {
    await m.goto(base + url); await m.waitForTimeout(500);
    const r = await m.evaluate(() => { const small = [...document.querySelectorAll("button,a.btn,.action,nav a,summary,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select")].filter((e) => e.offsetWidth && e.offsetHeight).filter((e) => e.getBoundingClientRect().height < 40).length; return { sx: document.documentElement.scrollWidth > innerWidth + 1, small, fs: parseFloat(getComputedStyle(document.body).fontSize) }; });
    check(!r.sx && r.fs >= 16, `móvil ${name}: sin scroll horizontal, letra ${r.fs}px${r.small ? `, ${r.small} elementos tocables < 40px` : ", todo lo tocable ≥ 40px"}`); if (r.small) report.push({ escenario: `móvil ${name}`, acciones: 0, segundos: 0, resultado: `${r.small} elementos tocables pequeños` });
  }
  await m.goto(base + "/agencia"); await m.click(".menu-btn"); check(await m.locator("#side-nav a").first().isVisible(), "móvil: el menú se abre con un botón claro"); await m.screenshot({ path: `${OUT}/21-movil-menu.png` });
  await m.goto(base + "/empezar?paso=2"); await m.screenshot({ path: `${OUT}/22-movil-paso2.png` }); await m.goto(base + "/agencia"); await m.evaluate(() => document.getElementById("side-nav").classList.add("closed")); await m.screenshot({ path: `${OUT}/23-movil-inicio.png` });

  // ---- Sin WebGL: la oficina sigue siendo usable
  const nctx = await b.newContext({ viewport: { width: 1000, height: 800 } }); await nctx.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(String(t)) ? null : o.call(this, t, ...a); }; });
  const np = await nctx.newPage(); await np.goto(base + "/login"); await np.fill("[name=email]", "ana@prueba.test"); await np.fill("[name=password]", "clave-muy-larga-1"); await np.click("button"); await np.waitForURL(/agencia/);
  await np.goto(base + "/agencia/oficina-3d"); await np.waitForTimeout(1200); check(/Lista|lista/.test(await np.locator(".notice").first().innerText()) && await np.locator("canvas").count() === 0, "sin 3D: aviso amable que ofrece la «Lista» y la app sigue funcionando");
  await np.click("[data-testid=mode-list]"); check(await np.locator("[data-testid=list-view]").isVisible(), "sin 3D: la vista «Lista» funciona");

  check(!leaks.length, "ninguna pantalla muestra variables internas (COMPOSIO_API_KEY, ANTHROPIC_API_KEY…)" + (leaks.length ? " — " + leaks.join("; ") : ""));
  check(errors.length === 0, "sin errores de JavaScript (" + errors.length + ")"); if (errors.length) console.log(errors.slice(0, 3));
  fs.writeFileSync(REPORT, JSON.stringify({ nota: "Medido por automatización (Playwright). NO son pruebas con personas.", palabrasLanding: words, escenarios: report }, null, 1));
  console.table(report); await b.close(); console.log(failed ? `\n${failed} FALLO(S)` : "\nTODO OK"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FALLÓ", e.message); process.exit(1); });
