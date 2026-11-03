// Auditoría de experiencia: captura pantallas y mide jerga, campos, botones y enlaces. Uso:
//   NODE_PATH=$(npm root -g) node scripts/e2e/ux_audit.cjs <ids.json> <carpeta_salida> [escritorio|movil]
const { chromium, devices } = require("playwright"); const fs = require("fs");
const ids = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const OUT = process.argv[3]; const base = "http://localhost:3111";
// Términos que un principiante no debería ver. Se buscan como PALABRAS completas (no dentro de otras: «logo», «catálogo»).
const JARGON = ["skills?", "agentes?", "dashboard", "workflows?", "api", "tokens?", "webhooks?", "prompts?", "integraci[oó]n(?:es)?", "crm", "leads?", "logs?", "deploy", "desplegar|desplegado|despliegue", "saas", "white label", "composio", "anthropic", "tarifas?", "plantillas?", "json", "versi[oó]n", "oauth", "cron", "endpoint", "ia", "usd|us\\$", "borrador", "kpi", "onboarding", "backend", "owner", "viewer", "toolkit", "evidencia", "webgl", "claves?"];
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
(async () => {
  const b = await chromium.launch({ args: ARGS }); const mobile = process.argv[4] === "movil";
  const ctx = await b.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const NEW = process.argv[5] === "nuevo"; const rows = []; const snap = async (name, url, opts = {}) => {
    await p.goto(base + url); await p.waitForTimeout(opts.wait ?? 700);
    const m = await p.evaluate((J) => {
      const t = document.body.innerText.toLowerCase(); const hits = {}; for (const j of J) { const n = (t.match(new RegExp("(?<![\\p{L}\\p{N}])(?:" + j + ")(?![\\p{L}\\p{N}])", "gu")) || []).length; if (n) hits[j] = n; }
      const vis = (e) => { if (!(e.offsetWidth || e.offsetHeight)) return false; const d = e.closest("details:not([open])"); return !d || (e.tagName === "SUMMARY" && e.parentElement === d); }; // lo que está dentro de secciones plegadas NO cuenta como visible
      return { palabras: t.split(/\s+/).filter(Boolean).length, campos: [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(vis).length, botones: [...document.querySelectorAll("button,a.btn")].filter(vis).length, enlaces: [...document.querySelectorAll("a")].filter(vis).length, jerga: hits, jergaTotal: Object.values(hits).reduce((a, c) => a + c, 0), scrollX: document.documentElement.scrollWidth > innerWidth + 1, alto: document.documentElement.scrollHeight };
    }, JARGON);
    rows.push({ pantalla: name, url, ...m }); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !mobile });
  };
  await snap("01-landing", "/"); await snap("02-registro", "/registro"); await snap("03-login", "/login");
  await p.goto(base + "/login"); await p.fill("[name=email]", "ana@demo.test"); await p.fill("[name=password]", "clave-muy-larga-1"); await p.click("button"); await p.waitForURL(/agencia/);
  for (const [n, u] of [["10-panel-agencia", "/agencia"], ["11-clientes", "/agencia/clientes"], ["12-cliente-detalle", `/agencia/clientes/${ids.multi}`], ["13-servicios", "/agencia/servicios"], ["14-skills-agencia", "/agencia/skills?plantilla=analista-meta-ads"], ["15-propuestas", "/agencia/propuestas"], ["16-identidad", "/agencia/identidad"], ["17-soporte", "/agencia/soporte"], ["18-oficina-3d", `/agencia/oficina-3d?cliente=${ids.multi}`], ["19-celular", "/celular"], ...(NEW ? [["33-asistente", "/agencia/asistente"], ["34-agregar-empleado-agencia", "/agencia/contratar"], ["35-crear-tarea", "/agencia/tarea"], ["36-conexiones-agencia", "/agencia/conexiones"]] : [])]) await snap(n, u, { wait: n === "18-oficina-3d" ? 2500 : 700 });
  await p.goto(base + "/agencia/clientes"); await p.locator("tr, [data-testid^=client-]", { hasText: "Multiárea" }).locator("button").first().click(); await p.waitForURL("**/oficina");
  const emp = await p.evaluate(async (c) => 0, 0); await snap("20-oficina-cliente", "/oficina");
  await snap("21-departamentos", "/departamentos"); await p.goto(base + "/departamentos"); const href = await p.locator("a[href^='/empleados/']").first().getAttribute("href");
  for (const [n, u] of [["22-ficha-empleado", href], ["23-editar-skill", NEW ? href + "/ensenar" : href + "/skill"], ["24-editar-skill-avanzado", href + "/skill?modo=avanzado"], ["25-conexiones", "/conexiones"], ["26-construir-paso1", NEW ? "/empezar?paso=1" : "/construir?paso=1"], ["27-construir-paso3", NEW ? "/agregar-empleado" : "/construir?paso=3"], ["28-conocimiento", "/conocimiento"], ["29-automatizaciones", "/automatizaciones"], ["30-actividad", "/actividad"], ["31-aprobaciones", "/aprobaciones"], ["32-ayuda", "/ayuda"]]) await snap(n, u);
  fs.writeFileSync(`${OUT}/metricas.json`, JSON.stringify(rows, null, 1)); await b.close();
  const tot = rows.reduce((a, r) => a + r.jergaTotal, 0); console.log(`pantallas: ${rows.length} · menciones de jerga: ${tot} · con scroll horizontal: ${rows.filter((r) => r.scrollX).map((r) => r.pantalla).join(", ") || "ninguna"}`);
  console.table(rows.map((r) => ({ pantalla: r.pantalla, palabras: r.palabras, campos: r.campos, botones: r.botones, jerga: r.jergaTotal })));
})().catch((e) => { console.error("FALLÓ", e.message); process.exit(1); });
