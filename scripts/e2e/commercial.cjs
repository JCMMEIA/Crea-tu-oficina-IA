// E2E del recorrido comercial (Playwright). Servidor con base VACÍA en :3112 y operador configurado:
//   rm -rf .data && npm run build && PLATFORM_ADMIN_EMAILS=jose@ejemplo.test PORT=3112 npx next start -p 3112 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/commercial.cjs docs/comercial/evidencia
// Recorre: landing → demo → gracias → planes → registro → activación → solicitud de plan (sin cobro) → panel de operador → licencia manual → soporte.
const { chromium } = require("playwright"); const fs = require("fs");
const OUT = process.argv[2] || "/tmp/cm"; fs.mkdirSync(OUT + "/capturas", { recursive: true });
const base = "http://localhost:3112"; const res = [];
const ok = (m) => { console.log("✓", m); res.push({ m, ok: true }); }; const fail = (m) => { console.error("✗", m); res.push({ m, ok: false }); process.exitCode = 1; };
const check = (c, m) => (c ? ok(m) : fail(m));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (vp = { width: 1200, height: 800 }) => { const c = await b.newContext({ viewport: vp }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(String(e))); return p; };
  const shot = (p, n) => p.screenshot({ path: `${OUT}/capturas/${n}.png`, fullPage: true });
  // 1. Visitante desde un anuncio
  let p = await mk();
  await p.goto(base + "/?utm_source=meta&utm_campaign=prueba&fbclid=abc"); await p.waitForTimeout(600);
  check((await p.locator("h1").innerText()).includes("Crea tu propia agencia"), "landing carga con su título");
  check(await p.locator("[data-testid=cta-demo]").count() === 1 && await p.locator("[data-testid=cta-registro]").count() === 1, "landing: CTAs «Pedir demostración» y «Crear cuenta de prueba»");
  check(!(await p.content()).includes("US$"), "landing no muestra precios inventados");
  await shot(p, "01-landing");
  await p.click("[data-testid=cta-demo]"); await p.waitForURL(/\/demo/);
  await p.fill("#lead-name", "Lucía Prospecto"); await p.fill("#lead-email", "lucia@prospecto.test"); await p.fill("#lead-company", "Tienda Lucía"); await p.fill("#lead-phone", "5551234");
  await p.check("input[name=interests][value=inventarios]"); await p.check("input[name=interests][value=anuncios]"); await p.fill("#lead-time", "martes por la tarde");
  await p.click("[data-testid=lead-submit]"); await p.waitForTimeout(500); check(!/gracias/.test(p.url()), "demo: sin consentimiento NO se envía");
  await shot(p, "02-demo-form");
  await p.check("[name=consent]"); await p.click("[data-testid=lead-submit]"); await p.waitForURL(/gracias\?tipo=demo/);
  check(await p.locator("[data-testid=thanks-demo]").count() === 1, "gracias de demostración (dice que la respuesta es manual)");
  await shot(p, "03-gracias-demo");
  // 2. Planes → registro con plan → asistente
  await p.goto(base + "/planes"); await p.waitForSelector("[data-testid=plan-agencia]");
  const pt = await p.innerText("body");
  check(pt.includes("Precio por confirmar") && !/US\$ \d/.test(pt), "planes: precios «por confirmar», sin cifras inventadas");
  check(pt.includes("Todavía no se cobra"), "planes: avisa que no hay cobro");
  await shot(p, "04-planes");
  await p.click("[data-testid=plan-agencia] a.btn"); await p.waitForURL(/registro\?plan=agencia/);
  await p.fill("[name=agencyName]", "Agencia Lucía"); await p.fill("[name=name]", "Lucía"); await p.fill("[name=email]", "lucia@agencia.test"); await p.fill("[name=password]", "clave-muy-larga-1");
  await p.click("[data-testid=signup]"); await p.waitForURL(/empezar/); ok("registro con plan de interés → asistente");
  // 3. Activación
  await p.goto(base + "/agencia/activacion"); const before = await p.innerText("[data-testid=act-progress]");
  check(/^[0-2] de 7/.test(before), "activación: progreso inicial bajo (" + before + ")");
  await p.check("[data-testid=demo-anuncios]"); await p.check("[data-testid=demo-inventarios]"); await p.click("[data-testid=prepare-demo]");
  await p.waitForSelector("text=Demostración lista"); const after = await p.innerText("[data-testid=act-progress]");
  check(await p.locator("[data-testid=act-demo]").getAttribute("data-done") === "true" && await p.locator("[data-testid=act-empleados]").getAttribute("data-done") === "true", "activación: demo y empleados se marcan solos");
  await shot(p, "05-activacion");
  // 4. Compra: solo solicitud
  await p.goto(base + "/agencia/plan?plan=agencia"); check((await p.innerText("body")).includes("Cobros desactivados"), "mi plan: dice «Cobros desactivados»");
  await p.click("[data-testid=request-agencia]"); await p.waitForSelector("text=No se cobró nada");
  check(await p.locator("[data-testid=plan-pending]").count() === 1, "solicitud de plan registrada");
  check((await p.innerText("body")).includes("Hoy tienes: Prueba"), "el plan sigue en «Prueba» (no se activó nada sin pago/autorización)");
  await shot(p, "06-mi-plan");
  // 5. Ayuda y soporte
  const h = await mk(); await h.goto(base + "/ayuda/tutoriales");
  check(await h.locator("[data-testid^=tut-]").count() >= 6, "ayuda: ≥6 tutoriales"); await h.click("[data-testid=tut-primera-demo] summary"); await shot(h, "07-ayuda");
  await h.fill("#s-email", "duda@usuario.test"); await h.fill("#s-subject", "No encuentro el paso 3"); await h.fill("#s-body", "Estoy en el asistente y no entiendo el paso de empleados.");
  await h.click("[data-testid=support-submit]"); await h.waitForSelector("text=Recibimos tu mensaje"); ok("soporte: mensaje enviado");
  // 6. Intruso
  const i = await mk(); await i.goto(base + "/admin"); check(!/\/admin/.test(i.url()), "/admin sin sesión → redirige (" + i.url() + ")");
  check(!/\/admin/.test((await (async () => { await p.goto(base + "/admin"); return p.url(); })())), "/admin con sesión de agencia que NO es operadora → redirige");
  // 7. Operador
  const o = await mk(); await o.goto(base + "/registro"); await o.fill("[name=agencyName]", "Operación"); await o.fill("[name=name]", "José"); await o.fill("[name=email]", "jose@ejemplo.test"); await o.fill("[name=password]", "clave-muy-larga-1");
  await o.click("[data-testid=signup]"); await o.waitForURL(/empezar/);
  await o.goto(base + "/admin"); await o.waitForSelector("[data-testid=m-visitas]");
  const num = async (id) => Number((await o.innerText(`[data-testid=${id}] div:nth-child(2)`)).trim());
  check((await num("m-visitas")) >= 1, "panel: visitas > 0 (reales, medidas por el sitio)"); check((await num("m-leads")) === 1 && (await num("m-demos")) === 1, "panel: 1 prospecto y 1 demo");
  check((await num("m-registros")) >= 2, "panel: registros ≥ 2");
  check((await o.innerText("[data-testid=m-compras]")).includes("No activo"), "panel: Compras = «No activo»"); await shot(o, "08-panel-resumen");
  await o.goto(base + "/admin/prospectos"); check(await o.locator("[data-email='lucia@prospecto.test']").count() === 1, "prospecto aparece en el panel");
  check((await o.innerText("[data-email='lucia@prospecto.test']")).includes("meta"), "fuente «meta» conservada desde el anuncio hasta el prospecto");
  await shot(o, "09-prospectos"); await o.click("text=Lucía Prospecto"); await o.waitForURL(/prospectos\//);
  check((await o.innerText("body")).includes("inventarios") || (await o.innerText("body")).includes("inventarios".slice(0, 5)), "detalle: muestra intereses");
  await o.selectOption("select[name=status]", "demo_agendada"); await o.click("[data-testid=save-status]"); await o.waitForTimeout(1200); await o.waitForLoadState("networkidle");
  check(await o.locator("select[name=status]").inputValue() === "demo_agendada", "estado de venta guardado");
  await o.fill("[name=body]", "Quedamos el martes 4pm."); await o.click("[data-testid=save-note]"); await o.waitForSelector("text=Quedamos el martes 4pm."); ok("nota guardada");
  const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16); await o.fill("[name=when]", d); await o.fill("#n", "Enviar enlace"); await o.click("[data-testid=save-followup]"); await o.waitForSelector("text=Enviar enlace"); ok("recordatorio programado");
  await shot(o, "10-detalle-prospecto");
  await o.goto(base + "/admin/agencias"); check(await o.locator("[data-testid=plan-requests]").count() === 1, "agencias: aparece la solicitud de plan");
  await o.click("[data-testid=plan-requests] button:has-text('Conceder licencia')"); await o.waitForURL(/admin\/agencias/); await o.waitForTimeout(400);
  await shot(o, "11-agencias");
  await o.goto(base + "/admin/soporte"); check(await o.locator("[data-testid=support-item]").count() === 1, "soporte: el mensaje llega al panel");
  await p.goto(base + "/agencia/plan"); check((await p.innerText("body")).includes("Hoy tienes: Agencia") && (await p.innerText("body")).includes("concedida por el equipo"), "tras concesión MANUAL el plan de la agencia cambia a «Agencia»");
  await o.goto(base + "/admin"); check((await o.innerText("[data-testid=m-compras]")).includes("No activo"), "una licencia manual NO cuenta como compra");
  // 8. Móvil
  const m = await mk({ width: 390, height: 800 }); for (const u of ["/", "/demo", "/planes", "/ayuda/tutoriales"]) { await m.goto(base + u); const w = await m.evaluate(() => document.documentElement.scrollWidth); check(w <= 392, `móvil ${u}: sin scroll horizontal (${w}px)`); }
  await shot(m, "12-movil-landing");
  check(errs.length === 0, "0 errores de JavaScript en el recorrido" + (errs.length ? ": " + errs.slice(0, 2).join(" | ") : ""));
  fs.writeFileSync(OUT + "/e2e_comercial.json", JSON.stringify({ fecha: new Date().toISOString(), resultados: res }, null, 1));
  await b.close(); console.log(res.filter((r) => r.ok).length + "/" + res.length + " verificaciones OK");
})();
