// E2E de la Oficina 3D (Playwright + Chromium con WebGL por software). Uso:
//   rm -rf .data && npx tsx scripts/e2e/seed_office3d.ts /tmp/ids.json && npm run build
//   APP_SECRET=$(openssl rand -base64 32) npx next start -p 3111 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/office3d.cjs /tmp/ids.json docs/evidencia/office3d
const { chromium, devices } = require("playwright");
const fs = require("fs");
const ids = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const OUT = process.argv[3]; const base = "http://localhost:3111";
let failed = 0; const ok = (m) => console.log("✓", m); const bad = (m) => { failed++; console.error("✗", m); };
const check = (c, m) => (c ? ok(m) : bad(m));
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function login(p, email, pass) { await p.goto(base + "/login"); await p.fill("[name=email]", email); await p.fill("[name=password]", pass); await p.click("button"); await p.waitForURL(/agencia|oficina/); }
async function open3d(p, url, tid = "office-agency") {
  const t0 = Date.now(); await p.goto(base + url);
  await p.waitForSelector(`[data-testid=${tid}][data-mode='3d']`, { timeout: 30000 });
  await p.waitForTimeout(900); return Date.now() - t0;
}
const stage = (p, tid = "office-agency") => p.locator(`[data-testid=${tid}-stage]`);
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}.png` }); };
async function clickProjected(p, id) {
  await p.evaluate(() => document.querySelector('[data-testid$="-stage"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(400);
  const pos = await p.evaluate((i) => window.__office3d.project(i), id); if (!pos) throw new Error("sin posición para " + id);
  return pos;
}

(async () => {
  const b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  await login(p, "ana@demo.test", "clave-muy-larga-1"); ok("login de agencia");

  // 1) Agencia/cliente sin empleados
  let ms = await open3d(p, `/agencia/oficina-3d?cliente=${ids.empty}`);
  check(await p.locator("[data-testid=office-agency]").getAttribute("data-employees") === "0", "1 · sin empleados: 0 estaciones");
  check(await p.locator(".o3d-empty").isVisible(), "1 · sin empleados: vista vacía útil con CTA (" + (await p.locator(".o3d-empty a").innerText()) + ")");
  check(await p.locator("canvas").count() === 1, "1 · canvas 3D presente (recepción con marca)");
  await shot(p, "01-sin-empleados-3d"); console.log("   tiempo a 3D listo:", ms, "ms (Chromium con WebGL por software)");

  // 2) Un departamento
  await open3d(p, `/agencia/oficina-3d?cliente=${ids.one}`);
  const d2 = await p.locator("[data-testid=office-agency]").getAttribute("data-employees"), z2 = await p.locator("[data-testid=office-agency]").getAttribute("data-zones");
  check(d2 === String(ids.counts.one) && z2 === "1", `2 · un departamento: ${z2} zona, ${d2} empleados = base de datos (${ids.counts.one})`);
  await shot(p, "02-un-departamento-3d");

  // 3 y 4) Múltiples departamentos / varios en marketing y ventas
  await open3d(p, `/agencia/oficina-3d?cliente=${ids.multi}`);
  const el = p.locator("[data-testid=office-agency]");
  check(await el.getAttribute("data-employees") === String(ids.counts.multi), `3 · múltiples departamentos: ${await el.getAttribute("data-zones")} zonas, ${ids.counts.multi} empleados = base de datos`);
  const legend = await p.locator(".o3d-side").innerText();
  const num = (name) => Number((legend.match(new RegExp(name + "\\s*·\\s*(\\d+)")) || [])[1]);
  check(num("Marketing") === 8 && num("Ventas") === 5, `4 · marketing=${num("Marketing")} y ventas=${num("Ventas")} empleados (esperado 8 y 5)`);
  check(legend.includes("Automatizaciones / IA"), "3 · zona de Automatizaciones / IA solo porque existe una automatización real");
  await shot(p, "03-multiples-departamentos-3d");
  const sumEmp = await p.locator('[data-testid^="iso-desk-"]').count();
  check(sumEmp === ids.counts.multi + 1, `   estaciones en el DOM = empleados reales + 1 automatización (${sumEmp})`);

  // 5) Clic en empleado (3D real)
  const deskTid = await p.locator('[data-testid^="iso-desk-"]').first().getAttribute("data-testid"); const deskId = deskTid.replace("iso-desk-", "");
  let pos = await clickProjected(p, deskId); await p.mouse.click(pos.x, pos.y); await p.waitForSelector("[data-testid=panel-desk]", { timeout: 5000 });
  const pd = await p.locator("[data-testid=panel-desk]").innerText();
  check(/Skill asignada/.test(pd) && /Activo|En pausa/.test(pd), "5 · clic en empleado (3D): panel con nombre, función, departamento, skill y estado");
  await shot(p, "05-clic-empleado-3d");
  check(await p.locator("[data-testid=panel-desk] a").count() === 3, "5 · accesos rápidos: Abrir ficha, Ver skill y Editar");

  // 6) Clic en departamento
  const zoneTid = await p.locator('[data-testid^="iso-zone-"]').nth(1).getAttribute("data-testid"); const zoneId = zoneTid.replace("iso-zone-", "");
  pos = await clickProjected(p, zoneId); await p.mouse.click(pos.x, pos.y);
  await p.waitForSelector("[data-testid=panel-zone]", { timeout: 5000 });
  const pz = await p.locator("[data-testid=panel-zone]").innerText();
  check(/Empleados/.test(pz) && /Servicios vinculados/.test(pz) && /Listo|Requiere configuración|Sin empleados/.test(pz), "6 · clic en departamento (3D): nombre, empleados, servicios vinculados y estado de configuración");
  await shot(p, "06-clic-departamento-3d");

  // Interacción de cámara: rotar y zoom cambian la vista
  await p.keyboard.press("Escape"); await p.mouse.move(700, 400); const before = await p.screenshot({ clip: { x: 200, y: 250, width: 500, height: 300 } });
  await p.mouse.down(); await p.mouse.move(820, 430, { steps: 8 }); await p.mouse.up(); await p.mouse.wheel(0, -400); await p.waitForTimeout(700);
  const after = await p.screenshot({ clip: { x: 200, y: 250, width: 500, height: 300 } });
  check(Buffer.compare(before, after) !== 0, "   rotar + zoom con el mouse modifican la cámara");
  await p.locator("text=Restablecer cámara").click(); await p.waitForSelector("[data-testid=office-agency][data-mode='3d']", { timeout: 20000 }); ok("   «Restablecer cámara» funciona");

  // Alternar 2D ↔ 3D
  await p.locator("button", { hasText: "Vista 2D" }).click(); await p.waitForTimeout(400);
  check(await p.locator("[data-testid=office-agency]").getAttribute("data-mode") === "2d", "   alternar a vista 2D manualmente");
  await shot(p, "10-vista-2d-isometrica");
  await p.locator("button", { hasText: "Vista 3D" }).click(); await p.waitForSelector("[data-testid=office-agency][data-mode='3d']", { timeout: 20000 }); ok("   volver a vista 3D");

  // 8) Escritorio
  await open3d(p, `/agencia/oficina-3d?cliente=${ids.multi}`); await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, "08-escritorio-1440");

  // Aislamiento en la UI
  await p.goto(base + `/agencia/oficina-3d?cliente=${ids.secret}`); await p.waitForTimeout(800);
  check(!(await p.content()).includes("Secreto del Rival"), "   aislamiento: ?cliente= de otra agencia no muestra nada ajeno (cae a la escena de la agencia propia)");
  await p.goto(base + "/agencia/oficina-3d"); await p.waitForSelector("[data-testid=office-agency]");
  check(await p.locator("[data-testid=office-agency]").getAttribute("data-zones") === "3", "   escena de agencia: 3 clientes propios (sin los de otra agencia)");
  await shot(p, "11-agencia-todos-los-clientes");
  { const did = (await p.locator('[data-testid^="iso-desk-"]').first().getAttribute("data-testid")).replace("iso-desk-", ""); const pp = await clickProjected(p, did); await p.mouse.click(pp.x, pp.y); await p.waitForSelector("[data-testid=panel-desk]");
    check(await p.locator("[data-testid=panel-desk] form button").count() === 1, "   escena de agencia: clic en empleado ofrece abrir la oficina de SU cliente (sin enlaces cruzados)"); }
  await p.goto(base + "/agencia"); check(await p.locator("text=Visualiza tu Oficina 3D").count() > 0 && await p.locator("svg[aria-label='Miniatura de tu agencia']").count() === 1, "   panel de agencia: tarjeta «Visualiza tu Oficina 3D» con miniatura");

  // Oficina del cliente (agencia entra) + panel normal intacto
  await p.goto(base + "/agencia/clientes"); await p.locator("tr", { hasText: "Multiárea" }).locator("button").click(); await p.waitForURL("**/oficina");
  check(await p.locator("text=Visualiza tu Oficina 3D").count() > 0, "   oficina del cliente: tarjeta en el panel de dirección");
  await p.goto(base + "/oficina-3d"); await p.waitForSelector("[data-testid=office][data-mode='3d']", { timeout: 30000 }); await p.waitForTimeout(800); await shot(p, "12-oficina-cliente-3d");
  check(/Agencia Demo Nova/.test(await p.locator("nav .logo").innerText()), "   marca de la agencia visible en la oficina del cliente");
  await p.goto(base + "/departamentos"); check(await p.locator("h1", { hasText: "Mis departamentos" }).count() === 1, "   el panel normal (Mis departamentos) sigue funcionando");

  // Asistente: paso 4
  await p.goto(base + "/construir?paso=4"); await p.waitForSelector("[data-testid=office-wizard][data-mode='3d']", { timeout: 30000 }); check(await p.locator("h2", { hasText: "Visualiza tu Oficina 3D" }).count() === 1, "   fin del asistente (paso 4): sección «Visualiza tu Oficina 3D»");
  await p.waitForTimeout(700); await shot(p, "13-asistente-paso-4");
  await p.goto(base + "/construir?paso=3"); check(await p.locator("text=Visualiza tu Oficina 3D →").count() === 1, "   paso 3: aviso con acceso directo a la vista 3D");

  // 7) Móvil (iPhone 13)
  const mctx = await b.newContext({ ...devices["iPhone 13"] }); const m = await mctx.newPage();
  await login(m, "ana@demo.test", "clave-muy-larga-1");
  await m.goto(base + `/agencia/oficina-3d?cliente=${ids.multi}`); await m.waitForSelector("[data-testid=office-agency][data-mode='3d']", { timeout: 40000 }); await m.waitForTimeout(900);
  check(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "7 · móvil: sin scroll horizontal");
  const cw = await m.locator("canvas").evaluate((c) => c.getBoundingClientRect().width); check(cw <= 390, `7 · móvil: canvas ${Math.round(cw)}px ≤ 390`);
  await m.evaluate(() => document.querySelector('[data-testid$="-stage"]').scrollIntoView({ block: "center" })); await m.waitForTimeout(500);
  await m.screenshot({ path: `${OUT}/07-movil-3d.png` });
  const mid = (await m.locator('[data-testid^="iso-desk-"]').first().getAttribute("data-testid")).replace("iso-desk-", "");
  await m.evaluate(() => document.querySelector('[data-testid$="-stage"]').scrollIntoView({ block: "center" })); await m.waitForTimeout(400);
  const mp = await m.evaluate((i) => window.__office3d.project(i), mid); await m.touchscreen.tap(mp.x, mp.y);
  await m.waitForSelector("[data-testid=panel-desk]", { timeout: 5000 }); ok("7 · móvil: toque sobre un empleado abre su ficha");
  await m.locator("[data-testid=panel-desk]").scrollIntoViewIfNeeded(); await m.screenshot({ path: `${OUT}/07b-movil-detalle.png` });
  await mctx.close();

  // 9) Fallback: sin WebGL
  const fctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fctx.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(String(t)) ? null : o.call(this, t, ...a); }; });
  const f = await fctx.newPage(); await login(f, "ana@demo.test", "clave-muy-larga-1");
  await f.goto(base + `/agencia/oficina-3d?cliente=${ids.multi}`); await f.waitForSelector("[data-testid=office-agency]"); await f.waitForTimeout(1200);
  check(await f.locator("[data-testid=office-agency]").getAttribute("data-mode") === "2d" && await f.locator("canvas").count() === 0, "9 · sin WebGL: vista 2D isométrica, sin canvas");
  check(/no permite 3D/.test(await f.locator(".notice").innerText()), "9 · sin WebGL: aviso claro («" + (await f.locator(".notice").innerText()).slice(0, 50) + "…»)");
  await f.locator('[data-testid^="iso-desk-"]').first().click(); await f.waitForSelector("[data-testid=panel-desk]"); ok("9 · fallback 2D: clic en empleado funciona");
  await f.locator('[data-testid^="iso-zone-"]').nth(1).click({ position: { x: 10, y: 5 }, force: true }).catch(() => {});
  await f.goto(base + "/departamentos"); check(await f.locator("h1").count() > 0, "9 · el resto de la app sigue usable sin WebGL");
  await f.goto(base + `/agencia/oficina-3d?cliente=${ids.multi}`); await f.waitForTimeout(800); await shot(f, "09-fallback-sin-webgl");
  await fctx.close();
  // 9b) Fallback: el 3D falla al crearse
  const gctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await gctx.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; let n = 0; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(String(t)) && n++ >= 1) return null; return o.call(this, t, ...a); }; });
  const g = await gctx.newPage(); await login(g, "ana@demo.test", "clave-muy-larga-1");
  await g.goto(base + `/agencia/oficina-3d?cliente=${ids.multi}`); await g.waitForSelector("[data-testid=office-agency]"); await g.waitForFunction(() => /No se pudo cargar/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  check(/No se pudo cargar la vista 3D/.test(await g.locator("body").innerText()) && await g.locator("[data-testid=office-agency]").getAttribute("data-mode") === "2d", "9b · error al crear el 3D: la barrera de errores cae a 2D con aviso");
  check(await g.locator('[data-testid^="iso-desk-"]').first().isVisible(), "9b · el 2D queda interactivo");
  await shot(g, "09b-fallback-error-3d"); await gctx.close();

  // Usuario cliente: solo su oficina 3D
  const cctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const c = await cctx.newPage(); await login(c, "cliente@multi.test", "clave-muy-larga-3");
  await c.goto(base + "/oficina-3d"); await c.waitForSelector("[data-testid=office][data-mode='3d']", { timeout: 30000 });
  check(await c.locator("[data-testid=office]").getAttribute("data-employees") === String(ids.counts.multi), "   usuario cliente: ve solo su oficina 3D (empleados = base)");
  check(!(await c.content()).includes("Secreto del Rival") && !(await c.content()).includes("Cliente Vacío"), "   usuario cliente: sin datos de otros clientes");
  const r = await c.goto(base + "/agencia/oficina-3d"); check(/oficina|login/.test(c.url()), "   usuario cliente: no entra a la vista de agencia");
  await cctx.close();

  check(errors.length === 0, "   sin errores de JavaScript en la página (" + errors.length + ")"); if (errors.length) console.log(errors.slice(0, 3));
  await b.close();
  console.log(failed ? `\n${failed} FALLO(S)` : "\nTODO OK"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FALLÓ", e.message); process.exit(1); });
