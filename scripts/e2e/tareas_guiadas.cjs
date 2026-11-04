// E2E de TAREAS GUIADAS + CEREBRO + RESULTADOS + CONSUMO, con dos clientes distintos. La IA es una SIMULACIÓN local (scripts/e2e/mocks.cjs): prueba NUESTRO código de punta a punta,
// NO la calidad de la IA real (eso lo cubre `npm run tareas:verificar` cuando hay credenciales). Ver docs/cerebro-tareas/PRUEBAS.md.
const { chromium } = require("playwright"); const { Client } = require("pg"); const fs = require("fs");
const APP = process.env.E2E_APP || "http://127.0.0.1:3113", OUT = process.argv[2] || "/var/tmp/tareas_out"; fs.mkdirSync(OUT + "/capturas", { recursive: true });
const check = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) process.exitCode = 1; };
const PW = "clave-larga-123";
(async () => {
  const db = new Client({ connectionString: process.env.E2E_DB }); await db.connect(); const q = async (s, p) => (await db.query(s, p)).rows;
  const b = await chromium.launch(); const errs = [];
  const ctxOf = async (vp = { width: 1280, height: 900 }) => { const c = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && !/favicon|403|404/.test(m.text()) && errs.push(m.text())); return { c, p }; };
  const text = (p) => p.locator("body").innerText();
  const registrar = async (p, negocio, email) => { await p.goto(APP + "/registro"); await p.fill("#a", negocio); await p.fill("#n", "Dueño " + negocio); await p.fill("#e", email); await p.fill("#p", PW); await p.click("form.card button[type=submit], form.card button"); await p.waitForURL(/empezar|agencia|oficina/); };
  const abrirCliente = async (p, nombre) => { await p.goto(APP + "/agencia/clientes"); await p.fill("[data-testid=client-name], #nc", nombre); await p.click("[data-testid=client-add]"); await p.waitForTimeout(800);
    await p.waitForURL(/\/agencia\/clientes\/.+/); await p.locator("button", { hasText: "Abrir su oficina" }).first().click(); await p.waitForURL(/\/oficina|\/agregar-empleado/); };
  const guardarCerebro = async (p, d) => { await p.goto(APP + "/cerebro"); for (const [k, v] of Object.entries(d)) await p.fill(`#b_${k}`, v); await p.click("[data-testid=brain-save]"); await p.waitForURL(/ok=/); };

  // ======== CLIENTE A: Café Luna (escritorio) ========
  let A = await ctxOf(); let p = A.p; await registrar(p, "Agencia Luna", "laura@e2e.test"); await abrirCliente(p, "Café Luna"); check(true, "1. Configurar negocio: cuenta creada y oficina «Café Luna» abierta");
  await p.goto(APP + "/cerebro"); check(/0 de 6 datos clave/.test(await text(p)), "Cerebro vacío al inicio: 0 de 6 datos clave"); await p.screenshot({ path: `${OUT}/capturas/cerebro-vacio-escritorio.png`, fullPage: true });
  await guardarCerebro(p, { sector: "Cafetería de especialidad en Guadalajara", products: "Café de filtro $45, croissant $38, desayuno completo $99", clients: "Oficinistas jóvenes de 22 a 35 años", valueProp: "Café de productores locales tostado cada semana", tone: "Cercano, cálido y sencillo", goals: "Vender 20% más entre semana", rules: "No prometer entregas el mismo día" });
  check(/6 de 6 datos clave/.test(await text(p)), "1. Cerebro guardado: 6 de 6 datos clave"); await p.screenshot({ path: `${OUT}/capturas/cerebro-escritorio.png`, fullPage: true });
  await p.goto(APP + "/tareas"); check((await p.locator("[data-testid^=tarea-]").count()) === 8, "3. Catálogo: 8 tareas guiadas"); await p.screenshot({ path: `${OUT}/capturas/tareas-escritorio.png`, fullPage: true });
  await p.click("[data-testid=usar-anuncios-3-variantes]"); await p.waitForURL(/tareas\/anuncios/);
  check(await p.locator("[data-testid=guided-run]").isDisabled(), "2. Sin empleado contratado: el botón de ejecutar está bloqueado y pide contratar");
  await p.click("[data-testid=contratar]"); await p.waitForURL(/tareas\/anuncios.*ok=/); check(!(await p.locator("[data-testid=guided-run]").isDisabled()), "2. Empleado contratado desde la propia tarea");
  check((await p.inputValue("#a_publico")) === "Oficinistas jóvenes de 22 a 35 años", "4. Pregunta «¿A quién le quieres hablar?» PRELLENADA desde el perfil"); check((await text(p)).includes("Prellenado desde tu Cerebro"), "4. Se marca qué viene prellenado");
  await p.fill("#a_oferta", "Desayuno completo a $99 de lunes a viernes"); await p.selectOption("#a_plataforma", "Instagram"); await p.screenshot({ path: `${OUT}/capturas/tarea-formulario-escritorio.png`, fullPage: true });
  await p.click("[data-testid=guided-run]"); await p.waitForURL(/\/resultados\//, { timeout: 60000 }); const rid = p.url().split("/resultados/")[1].split("?")[0];
  const body = await p.locator("[data-testid=result-body]").innerText();
  check(body.includes("Propuesta 1") && body.includes("Propuesta 3") && body.includes("Qué revisar antes de publicar"), "6. Resultado con las secciones pedidas"); check(body.includes("Café Luna"), "5. El modelo recibió el contexto de ESTE negocio (su nombre llegó en el prompt)");
  check((await p.locator("[data-testid=proposal-notice]").innerText()).includes("No se publicó, envió ni contactó a nadie"), "Aviso honesto: es una propuesta; no se publicó nada"); check((await p.locator("[data-testid=sections-warning]").count()) === 0, "Sin advertencia de secciones faltantes");
  await p.screenshot({ path: `${OUT}/capturas/resultado-escritorio.png`, fullPage: true });
  const dl = await p.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, d: r.headers.get("content-disposition"), t: await r.text() }; }, `/api/resultados/${rid}/descargar?formato=md`);
  check(dl.s === 200 && /attachment; filename=".+\.md"/.test(dl.d || "") && dl.t.includes("Propuesta 1") && dl.t.includes("No se publicó"), "7. Descarga .md real con aviso de propuesta"); const dh = await p.evaluate(async (u) => (await (await fetch(u)).text()), `/api/resultados/${rid}/descargar?formato=html`); check(dh.includes("<h2>Propuesta 1</h2>"), "7. Descarga .html imprimible");
  await p.click("[data-testid=editar]"); await p.fill("[data-testid=edit-text]", "## Propuesta 1\nTexto corregido por Laura"); await p.click("[data-testid=edit-save]"); await p.waitForURL(/ok=/);
  check((await text(p)).includes("Texto corregido por Laura") && (await text(p)).includes("editado por ti"), "7. Edición guardada (y marcada como editada)"); const dl2 = await p.evaluate(async (u) => (await (await fetch(u)).text()), `/api/resultados/${rid}/descargar?formato=md`); check(dl2.includes("Texto corregido por Laura"), "7. La descarga usa el texto editado");
  const row = (await q("SELECT result, result_edited, input_tokens, output_tokens, cost_usd::float c, context_used FROM guided_runs WHERE id=$1", [rid]))[0]; check(row.result.includes("Propuesta 1") && row.result_edited.includes("Laura"), "El original de la IA se conserva aparte de la edición"); check(row.context_used.profileFields.includes("tone"), "Se registró qué datos del Cerebro usó el empleado");
  await p.goto(APP + "/consumo"); const ct = await text(p); check(ct.includes("1,600") || ct.includes("1 600") || ct.includes("1600"), "8. Consumo: tokens totales (1,200 entrada + 400 salida)"); check(/0\.0096/.test(ct), "8. Consumo: costo estimado 0.0096 USD (1200×3 + 400×15 por millón)"); check(/10\.00/.test(ct) && /ejecuciones por hora/.test(ct), "8. Límites separados: presupuesto mensual y tope por hora"); await p.screenshot({ path: `${OUT}/capturas/consumo-escritorio.png`, fullPage: true });
  await p.goto(APP + "/agencia/consumo"); check(/Café Luna/.test(await text(p)) && /Consumo de la oficina/.test(await text(p)), "Consumo por cliente en la vista de la oficina"); await p.screenshot({ path: `${OUT}/capturas/consumo-oficina-escritorio.png`, fullPage: true });
  // repetir lo mismo no gasta de nuevo
  const aiBefore = Number((await (await fetch((process.env.E2E_MOCK || "http://127.0.0.1:3199") + "/__calls")).json().catch(() => ({}))).ai ?? -1);
  await p.goto(APP + "/tareas/anuncios-3-variantes"); await p.fill("#a_oferta", "Desayuno completo a $99 de lunes a viernes"); await p.selectOption("#a_plataforma", "Instagram"); await p.click("[data-testid=guided-run]"); await p.waitForURL(/\/resultados\//); check(p.url().includes(rid), "Repetir exactamente lo mismo lleva al resultado existente (no gasta de nuevo)");
  // límite
  const cid = (await q("SELECT id FROM companies WHERE name='Café Luna'"))[0].id; await db.query("UPDATE companies SET monthly_budget_usd=0.005 WHERE id=$1", [cid]);
  await p.goto(APP + "/tareas/anuncios-3-variantes"); check((await p.locator("[data-testid=limit-banner]").innerText()).includes("límite mensual") && await p.locator("[data-testid=guided-run]").isDisabled(), "Al llegar al límite: mensaje comprensible y ejecución bloqueada"); await p.screenshot({ path: `${OUT}/capturas/limite-escritorio.png`, fullPage: true });
  await db.query("UPDATE companies SET monthly_budget_usd=10 WHERE id=$1", [cid]);

  // ======== CLIENTE B: Taller Ruiz (otra cuenta, otro navegador) ========
  let B = await ctxOf(); const pb = B.p; await registrar(pb, "Agencia Ruiz", "beto@e2e.test"); await abrirCliente(pb, "Taller Ruiz");
  await guardarCerebro(pb, { sector: "Taller mecánico en Monterrey", products: "Afinación $900", clients: "Dueños de autos con más de 10 años", valueProp: "Garantía por escrito", tone: "Serio y técnico", goals: "Más citas", rules: "No dar diagnósticos por mensaje" });
  const cb = await ctxOf(); void cb;
  await pb.goto(APP + "/tareas/anuncios-3-variantes"); await pb.click("[data-testid=contratar]"); await pb.waitForURL(/ok=/); check((await pb.inputValue("#a_publico")) === "Dueños de autos con más de 10 años", "B: su formulario se prellena con SU perfil, no con el de Café Luna");
  await pb.fill("#a_oferta", "Afinación completa con garantía"); await pb.selectOption("#a_plataforma", "Facebook"); await pb.click("[data-testid=guided-run]"); await pb.waitForURL(/\/resultados\//, { timeout: 60000 }); const rb = pb.url().split("/resultados/")[1].split("?")[0];
  const bb = await pb.locator("[data-testid=result-body]").innerText(); check(bb.includes("Taller Ruiz") && !bb.includes("Café Luna"), "B: su resultado usa SU negocio y nada de Café Luna");
  check((await pb.goto(APP + `/resultados/${rid}`)).status() === 404, "AISLAMIENTO: B no puede abrir el resultado de A (404)"); const x = await pb.evaluate(async (u) => (await fetch(u)).status, `/api/resultados/${rid}/descargar?formato=md`); check(x === 404, "AISLAMIENTO: B no puede descargar el resultado de A (404)");
  await pb.goto(APP + "/resultados"); check(!(await text(pb)).includes("Café Luna") && (await pb.locator("a[href^='/resultados/']").count()) === 1, "B: su lista de resultados solo tiene lo suyo"); await pb.goto(APP + "/consumo"); check((await text(pb)).match(/1,?\s?600/) !== null, "B: su consumo es el suyo (1,600 tokens)");
  await pb.goto(APP + "/cerebro"); check(!(await text(pb)).includes("Cafetería de especialidad"), "B: su Cerebro no muestra datos de A");
  const nA = (await q("SELECT count(*)::int n FROM guided_runs WHERE company_id=$1", [cid]))[0].n, nB = (await q("SELECT count(*)::int n FROM guided_runs WHERE id=$1 AND company_id<>$2", [rb, cid]))[0].n; check(nA === 1 && nB === 1, "Base de datos: cada resultado pertenece a una sola oficina");

  // ======== MÓVIL ========
  const M = await ctxOf({ width: 390, height: 844 }); const pm = M.p; await pm.goto(APP + "/recuperar"); await pm.close(); await M.c.close();
  const M2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await A.c.storageState() }); const pm2 = await M2.newPage();
  for (const [u, n] of [["/cerebro", "cerebro"], ["/tareas", "tareas"], ["/tareas/anuncios-3-variantes", "tarea-formulario"], [`/resultados/${rid}`, "resultado"], ["/consumo", "consumo"]]) { await pm2.goto(APP + u); await pm2.waitForTimeout(300); check(await pm2.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `móvil ${n}: sin scroll horizontal`); await pm2.screenshot({ path: `${OUT}/capturas/${n}-movil.png`, fullPage: true }); }
  check(errs.length === 0, "sin errores de consola/página" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : "")); await b.close(); await db.end();
})().catch((e) => { console.error("ERROR E2E:", e); process.exit(1); });
