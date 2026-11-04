// Captura el panel en MODO DEMOSTRACIÓN (/panel-demo/*, datos de ejemplo) para la landing. Uso: NODE_PATH=$(npm root -g) node scripts/landing/capturas.cjs http://127.0.0.1:3115 /var/tmp/landing_png
const { chromium } = require("playwright"); const fs = require("fs");
const base = process.argv[2] || "http://127.0.0.1:3115", out = process.argv[3] || "/var/tmp/landing_png"; fs.mkdirSync(out, { recursive: true });
const vistas = ["inicio", "nueva-oficina", "mis-oficinas", "empleados", "departamentos", "automatizaciones", "configuracion", "facturacion"];
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1120, height: 700 }, deviceScaleFactor: 1, reducedMotion: "reduce" })).newPage();
  for (const v of vistas) { await p.goto(`${base}/panel-demo/${v}`, { waitUntil: "networkidle" }); if (v === "nueva-oficina") { await p.selectOption("[data-testid=demo-negocio]", "ecommerce"); } await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${v}.png` }); }
  await b.close(); console.log("capturas listas en " + out); })();
