// E2E de la identidad de empleados en la demostración pública: directorio → ficha, rotulado IA, estados honestos, móvil y accesibilidad.
//   AXE=/ruta/axe.min.js NODE_PATH=$(npm root -g) node scripts/e2e/empleados.cjs http://127.0.0.1:3115 docs/empleados/capturas
const { chromium } = require("playwright"); const fs = require("fs");
const BASE = process.argv[2] || "http://127.0.0.1:3115", OUT = process.argv[3] || "/var/tmp/empout", AXE = process.env.AXE; fs.mkdirSync(OUT, { recursive: true });
const check = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [name, vp, dsf] of [["escritorio", { width: 1440, height: 900 }, 2], ["movil", { width: 390, height: 844 }, 2]]) {
    const c = await b.newContext({ viewport: vp, deviceScaleFactor: dsf }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.goto(BASE + "/panel-demo/empleados", { waitUntil: "networkidle" });
    const n = await p.locator(".emp-card").count(); check(n >= 6, `${name}: directorio con tarjetas (${n})`);
    const first = p.locator(".emp-card").first(); const txt = await first.innerText();
    check(/Empleado IA · imagen ilustrativa/.test(txt), `${name}: la tarjeta rotula «Empleado IA · imagen ilustrativa»`);
    check(await first.locator(".emp-photo").count() === 1, `${name}: la tarjeta muestra foto o monograma`);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${name}: sin scroll horizontal`);
    await p.screenshot({ path: `${OUT}/directorio-${name}.png` });
    if (AXE) { await p.addScriptTag({ path: AXE }); const r0 = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id)); check(r0.length === 0, `${name}: accesibilidad directorio (${r0.join(",") || "0 graves"})`); }
    await first.locator("a.emp-card-main").click(); await p.waitForURL(/\/panel-demo\/empleados\/.+/);
    check(await p.locator("[data-testid=ficha] h1").count() === 1, `${name}: la tarjeta abre la ficha`);
    const f = await p.locator("[data-testid=ficha]").innerText();
    check(/Responsabilidades/.test(f) && /Habilidades y herramientas/.test(f) && /Qué entrega/.test(f), `${name}: la ficha trae responsabilidades, habilidades y herramientas`);
    const rd = await p.locator("[data-testid=readiness]").innerText();
    check(/Configurado: Sí/.test(rd) && /Operativo: No/.test(rd), `${name}: recién contratado = configurado, NO operativo (estado honesto)`);
    await p.screenshot({ path: `${OUT}/ficha-${name}.png`, fullPage: true });
    if (AXE) { await p.addScriptTag({ path: AXE }); const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id)); check(r.length === 0, `${name}: accesibilidad ficha (${r.join(",") || "0 graves"})`); }
    await c.close();
  }
  const v = await b.newPage(); const r = await v.goto(BASE + "/panel-demo/empleados/no-existe"); check(r.status() === 404, "clave inexistente → 404");
  check(errs.length === 0, "sin errores de consola/página" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : "")); await b.close();
})();
