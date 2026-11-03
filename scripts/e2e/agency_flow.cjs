// Prueba E2E con navegador (Playwright). Requiere el servidor en http://localhost:3111 con base VACÍA:
//   rm -rf .data && npm run build && PORT=3111 npx next start -p 3111 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/agency_flow.cjs /tmp public/demo
// Verifica el flujo agencia→cliente→agente→tarea y los intentos de cruzar agencias.
const { chromium } = require("playwright");
const OUT = process.argv[2], DEMO = process.argv[3];
const base = "http://localhost:3111"; const ok = (m) => console.log("✓", m); const fail = (m) => { console.error("✗", m); process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1200, height: 760 } }); return { c, p: await c.newPage() }; };
  // ---- Landing, lead, privacidad, gracias
  let { c: c0, p } = await mk();
  await p.goto(base + "/?utm_source=meta&utm_campaign=prueba&fbclid=abc123");
  (await p.locator("h1").innerText()).includes("Crea tu propia agencia de inteligencia artificial sin empezar desde cero") ? ok("landing: título") : fail("título");
  await p.fill("#lead-email", "lead@example.com"); await p.fill("#lead-name", "Lead Prueba");
  await p.click("form button:has-text(\"Quiero acceso anticipado\")"); await p.waitForTimeout(800); /gracias/.test(p.url()) ? fail("el formulario pasó sin consentimiento") : ok("sin consentimiento el formulario NO se envía");
  await p.check("[name=consent]"); await p.click("form button:has-text(\"Quiero acceso anticipado\")"); await p.waitForURL(/gracias/); ok("con consentimiento → /gracias");
  await p.goto(base + "/privacidad"); (await p.locator("h1").innerText()) === "Política de privacidad" ? ok("privacidad") : fail("privacidad");
  // ---- Agencia A
  let A = await mk(); p = A.p;
  await p.goto(base + "/registro");
  await p.fill("[name=agencyName]", "Agencia Demo Nova"); await p.fill("[name=specialty]", "Marketing con IA para tiendas online"); await p.fill("[name=name]", "Ana Demo"); await p.fill("[name=email]", "ana@demo.test"); await p.fill("[name=password]", "clave-muy-larga-1");
  await p.click("button"); await p.waitForURL(/\/agencia$/); ok("1 · agencia creada → panel de agencia");
  await p.goto(base + "/agencia/identidad"); await p.fill("[name=tagline]", "Resultados medibles con IA"); await p.fill("[name=primaryColor]", "#0a7d5a");
  await p.click("text=Guardar identidad"); await p.waitForSelector("text=Identidad guardada"); ok("2 · identidad guardada");
  await p.goto(base + "/agencia/servicios"); await p.click("text=+ Comercio electrónico"); await p.waitForSelector("text=Se agregaron 3 servicios"); ok("3 · servicios desde plantilla de industria");
  await p.locator("button", { hasText: "Publicar" }).first().click(); await p.waitForSelector("text=Servicio actualizado"); ok("5 · servicio publicado");
  await p.goto(base + "/agencia/skills?plantilla=analista-meta-ads"); await p.fill("[name=systemPrompt]", (await p.inputValue("[name=systemPrompt]")) + "\nMétodo Nova: siempre separa hechos, hipótesis y pendientes.");
  await p.click("text=Guardar skill de la agencia"); await p.waitForSelector("text=Skill de la agencia guardada"); ok("4 · skill reutilizable de la agencia");
  await p.goto(base + "/agencia/clientes"); await p.fill("[name=name]", "Tienda Ejemplo (demo)"); await p.selectOption("[name=industry]", "ecommerce"); await p.click("text=Crear cliente y su oficina"); await p.waitForURL(/clientes\/[0-9a-f-]{36}/);
  const clientUrl = p.url(); ok("6 · empresa cliente creada → " + clientUrl.split("/").pop().slice(0, 8));
  { const v = await p.locator("[name=serviceId] option", { hasText: "Análisis de anuncios" }).getAttribute("value"); await p.selectOption("[name=serviceId]", v); } await p.click("text=Contratar sus agentes en esta oficina"); await p.waitForSelector("text=Servicio desplegado"); ok("7 · servicio desplegado (agentes contratados en la oficina del cliente)");
  await p.locator("button", { hasText: "Entrar a su oficina" }).first().click(); await p.waitForURL("**/oficina"); ok("oficina del cliente con marca: " + (await p.locator("nav .logo").innerText()).replace(/\n/g, " · "));
  await p.goto(base + "/departamentos"); await p.locator("a", { hasText: "Analista de Meta Ads" }).first().click(); await p.waitForURL(/empleados\//); const empUrl = p.url();
  await p.goto(empUrl + "/skill"); await p.fill("[name=sells]", "Joyería de plata hecha a mano"); await p.fill("[name=never]", "inventar reseñas; prometer descuentos"); await p.click("text=Convertir en instrucciones y guardar"); await p.waitForSelector("text=versión 2"); ok("8 · agente personalizado para este cliente (skill v2)");
  const sys = await (async () => { await p.goto(empUrl + "/skill?modo=avanzado"); return p.inputValue("[name=systemPrompt]"); })();
  sys.includes("Método Nova") && sys.includes("Joyería de plata") ? ok("la skill del cliente hereda el método de la agencia + su personalización") : fail("herencia de skill");
  await p.goto(empUrl); await p.fill("[name=instruction]", "Analiza mis campañas de la semana"); await p.click("text=Asignar y ejecutar"); await p.waitForURL(/actividad\//);
  const err = await p.locator(".notice.bad").innerText(); err.includes("no está configurada") ? ok("10 · tarea SIN clave de IA: falla de forma honesta («" + err.split("\n")[0].slice(0, 70) + "…»)") : fail("tarea sin IA");
  await p.goto(base + "/conexiones"); (await p.locator(".notice").first().innerText()).includes("Composio no está configurado") ? ok("9 · conexiones: Composio sin configurar, informado") : fail("conexiones");
  await p.screenshot({ path: DEMO + "/oficina-cliente.png" });
  await p.goto(base + "/departamentos"); await p.screenshot({ path: DEMO + "/oficina-cliente.png" });
  await p.click("text=← Volver a la agencia"); await p.waitForURL(/agencia\/clientes/);
  await p.goto(base + "/agencia/servicios"); await p.screenshot({ path: DEMO + "/servicios.png" });
  // propuesta
  await p.goto(base + "/agencia/propuestas"); await p.fill("[name=clientName]", "Tienda Ejemplo (demo)"); await p.locator("input[name=serviceId]").first().check(); await p.click("text=Crear propuesta"); await p.waitForURL(/propuestas\/[0-9a-f-]{36}/);
  (await p.locator("pre").innerText()).includes("no incluye resultados garantizados") ? ok("propuesta generada (sin promesas)") : fail("propuesta");
  await p.screenshot({ path: DEMO + "/propuesta.png" });
  await p.goto(base + "/agencia"); await p.screenshot({ path: DEMO + "/panel-agencia.png" });
  const idA = clientUrl.split("/").pop();
  // ---- Agencia B intenta entrar a datos de A
  let B = await mk(); const q = B.p;
  await q.goto(base + "/registro"); await q.fill("[name=agencyName]", "Agencia Rival"); await q.fill("[name=name]", "Beto"); await q.fill("[name=email]", "beto@rival.test"); await q.fill("[name=password]", "clave-muy-larga-2"); await q.click("button"); await q.waitForURL(/\/agencia$/);
  const r1 = await q.goto(base + "/agencia/clientes/" + idA); r1.status() === 404 ? ok("AISLAMIENTO: B → cliente de A por URL = 404") : fail("B vio cliente de A: " + r1.status());
  await B.c.addCookies([{ name: "cto_company", value: idA, url: base }]);
  await q.goto(base + "/oficina"); const landed = q.url(); /\/agencia/.test(landed) && !(await q.content()).includes("Tienda Ejemplo") ? ok("AISLAMIENTO: cookie de empresa falsificada ignorada (redirige a su agencia)") : fail("cookie falsificada aceptada: " + landed);
  await q.goto(base + "/departamentos"); !(await q.content()).includes("Analista de Meta Ads") ? ok("AISLAMIENTO: B no ve empleados de A") : fail("B vio empleados de A");
  await q.goto(base + "/agencia/clientes"); !(await q.content()).includes("Tienda Ejemplo") ? ok("AISLAMIENTO: lista de clientes de B no contiene los de A") : fail("lista");
  // ---- Usuario cliente de A: solo su empresa
  await p.goto(clientUrl); await p.click("summary:has-text('Crear usuario del cliente')"); await p.fill("details [name=name]", "Cliente Demo"); await p.fill("details [name=email]", "cliente@tienda.test"); await p.fill("details [name=password]", "clave-muy-larga-3"); await p.selectOption("details [name=role]", "viewer"); await p.click("details button:has-text(\"Crear usuario\")");
  await p.waitForSelector("text=Usuario del cliente creado");
  let C = await mk(); const w = C.p; await w.goto(base + "/login"); await w.fill("[name=email]", "cliente@tienda.test"); await w.fill("[name=password]", "clave-muy-larga-3"); await w.click("button"); await w.waitForURL(/oficina/); ok("usuario del cliente entra directo a SU oficina");
  const r2 = await w.goto(base + "/agencia"); /oficina|login/.test(w.url()) ? ok("AISLAMIENTO: usuario cliente no accede al panel de agencia") : fail("cliente entró a /agencia");
  await b.close();
})().catch((e) => { console.error("FALLÓ", e.message); process.exit(1); });
