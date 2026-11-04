// E2E de MI PLAN DE LIBERTAD: consentimiento, diagnóstico corto y profundo, mapa, tareas, compartir objetivos, exportar, borrar, aislamiento entre dos clientes, móvil y accesibilidad básica.
const { chromium } = require("playwright"); const { Client } = require("pg"); const fs = require("fs");
const APP = process.env.E2E_APP, OUT = process.argv[2] || "/var/tmp/libertad_out"; fs.mkdirSync(OUT + "/capturas", { recursive: true });
const check = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) process.exitCode = 1; }; const PW = "clave-larga-123";
const VAL = { c_libre: "Elegir cómo uso mi tiempo y viajar con mi familia", c_cambio: "Dejaría de contestar mensajes de noche", c_trabajo: "reducir", c_plazo: "5", f_gasto_total: "30000", f_gasto_esencial: "18000", i_neto_total: "35000", i_pct_depende: "100", a_liquido: "90000", a_fondo: "40000", t_horas_sem: "55", t_horas_deseadas: "35", d_total: "50000" };
(async () => {
  const db = new Client({ connectionString: process.env.E2E_DB }); await db.connect(); const b = await chromium.launch(); const errs = [];
  const mk = async (vp) => { const c = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(p.url() + " → " + String(e).slice(0, 80))); return { c, p }; };
  const login = async (p, email) => { await p.goto(APP + "/login"); await p.fill("#e", email); await p.fill("#p", PW); await p.click("button[type=submit], form button"); await p.waitForURL(/\/oficina|\/empezar|\/agregar|\/panel|\/agencia/, { timeout: 20000 }).catch(() => {}); };
  const body = (p) => p.locator("body").innerText();
  // Responde preguntas hasta terminar; devuelve cuántas contestó
  const responder = async (p, vals, omit = []) => { let n = 0; for (let i = 0; i < 120; i++) { const q = p.locator("[data-testid=lb-question]"); if (!(await q.count())) break; const id = await p.inputValue("input[name=qid]"); n++;
    if (omit.includes(id)) { await p.click("[data-testid=lb-skip]"); await p.waitForTimeout(400); continue; }
    if (await p.locator("textarea[name=value]").count()) await p.fill("textarea[name=value]", vals[id] || "x"); else if (await p.locator("input[type=radio]").count()) { const want = vals[id]; const t = want ? p.locator(`input[type=radio][value="${want}"]`) : p.locator("input[type=radio]").first(); await t.check(); } else await p.fill("input[name=value]", vals[id] || "10");
    await p.click("[data-testid=lb-next]"); await p.waitForTimeout(450); } return n; };
  // ===== Cliente A (escritorio) =====
  const A = await mk(); let p = A.p; await login(p, "ana@libertad.test"); await p.goto(APP + "/libertad");
  check((await body(p)).includes("Antes de empezar") && (await body(p)).includes("no envía tus datos a ningún modelo de IA"), "1. Entrada: explica privacidad y límites antes de pedir datos"); await p.screenshot({ path: `${OUT}/capturas/01-entrada-escritorio.png`, fullPage: true });
  check((await db.query("SELECT count(*)::int n FROM libertad_plans")).rows[0].n === 0, "Sin consentimiento no se guarda nada");
  await p.click("[data-testid=lb-begin]", { trial: false }).catch(() => {}); await p.waitForTimeout(600); check((await db.query("SELECT count(*)::int n FROM libertad_plans")).rows[0].n === 0, "Sin marcar el consentimiento no se crea el plan (el navegador lo exige)");
  await p.check("input[name=consent]"); await p.click("[data-testid=lb-begin]"); await p.waitForURL(/libertad\/diagnostico/);
  check((await p.locator("[data-testid=lb-question] label.lb-prompt").innerText()).includes("¿Qué significa para ti ser libre?"), "2. Una sola pregunta a la vez, la primera es la de claridad de vida"); await p.screenshot({ path: `${OUT}/capturas/02-pregunta-escritorio.png`, fullPage: true });
  await p.fill("textarea[name=value]", VAL.c_libre); await p.click("[data-testid=lb-next]"); await p.waitForTimeout(500); await p.click("[data-testid=lb-skip]"); await p.waitForTimeout(500);
  check((await db.query("SELECT count(*)::int n FROM libertad_plans")).rows[0].n === 1, "3. Plan creado tras consentimiento"); const raw = JSON.stringify((await db.query("SELECT data_enc FROM libertad_plans")).rows); check(!/viajar|familia/.test(raw), "3. Lo guardado está cifrado (no aparece la respuesta en la base)");
  await p.goto(APP + "/libertad"); check(await p.locator("[data-testid=lb-resume]").count() === 1, "4. Guardar y reanudar: el panel ofrece continuar el diagnóstico"); await p.click("text=Continuar mi diagnóstico"); await p.waitForURL(/diagnostico/);
  check((await p.inputValue("input[name=qid]")) === "c_trabajo", "4. Retoma donde se quedó: la omitida se salta y sigue la siguiente pregunta");
  const nq = await responder(p, VAL, []); check(nq >= 8 && nq < 20, `5. Diagnóstico corto completo con ${nq} preguntas (no pide todo el detalle)`);
  check((await body(p)).includes("Terminaste este diagnóstico"), "5. Pantalla de cierre con invitación a ver el mapa o profundizar"); await p.screenshot({ path: `${OUT}/capturas/03-terminado-escritorio.png`, fullPage: true });
  await p.goto(APP + "/libertad"); let t = await body(p);
  check(t.includes("$30,000") && t.includes("$50,000") && t.includes("$35,000"), "6. Mapa: costo actual, costo deseado e ingreso con los números aportados"); check(/Faltan \$15,000/.test(t) && /\$5,000/.test(t), "6. Brecha de $15,000 y sobrante de $5,000 calculados por fórmula");
  check(t.includes("escenarios ilustrativos") && /no son (promesas|el rendimiento)|no es el rendimiento/.test(t) || t.includes("no es el rendimiento"), "6. El mapa aclara que los escenarios son ilustrativos y que la tasa de retiro no es rendimiento");
  check(/Dato que tú aportaste/.test(t) && /Cálculo matemático/.test(t) && /Recomendación general/.test(t) && /Supuesto sin confirmar/.test(t), "6. Se distingue dato, cálculo, estimación, recomendación y supuesto");
  check(!/garantiz|asegura(do)? (libertad|que)|serás libre/i.test(t.replace(/no (está )?garantiz\w*|no garantiz\w*|ninguna tasa está garantizada|no aseguran/gi, "")), "6. Sin promesas de libertad garantizada"); check(await p.locator("[data-testid=lb-goals] li").count() >= 3, "6. Metas concretas generadas");
  await p.screenshot({ path: `${OUT}/capturas/04-mapa-escritorio.png`, fullPage: true });
  // Supuestos editables
  await p.fill("input[name=stress]", "60"); await p.fill("input[name=rates]", "3, 5"); await p.click("[data-testid=lb-assumptions] button"); await p.waitForURL(/ok=/); t = await body(p); check(/estrés: baja 60%/.test(t) && !/4\.0%/.test(t.split("Patrimonio y escenarios")[1].split("Mi tiempo")[0]), "7. Supuestos editables: el estrés y las tasas de retiro cambian el resultado");
  // Versiones
  await p.fill("input[name=label]", "Inicio"); await p.click("[data-testid=lb-versions] button"); await p.waitForTimeout(1500); check((await body(p)).includes("Versión 1"), "8. Versión guardada" + ((await body(p)).includes("Versión 1") ? "" : " | " + decodeURIComponent(p.url()) )); 
  // Profundizar: ramificación
  await p.goto(APP + "/libertad/diagnostico"); await p.click("text=Profundizar con más preguntas").catch(() => {}); await p.waitForTimeout(600); await p.goto(APP + "/libertad/diagnostico");
  const deep = { s_dependientes: "2", s_deuda_alta: "0", t_h_atencion: "8", t_d_atencion: "asistir_ia", t_h_administracion: "5", t_d_administracion: "delegar_persona", t_h_marketing: "0", t_h_ventas: "0", t_h_equipo: "0", t_h_operacion: "0" };
  const seen = []; for (let i = 0; i < 120; i++) { if (!(await p.locator("[data-testid=lb-question]").count())) break; const id = await p.inputValue("input[name=qid]"); seen.push(id); const v = { ...VAL, ...deep }[id];
    if (await p.locator("textarea[name=value]").count()) await p.fill("textarea[name=value]", v || "x"); else if (await p.locator("input[type=radio]").count()) { const w = v; if (w && await p.locator(`input[type=radio][value="${w}"]`).count()) await p.locator(`input[type=radio][value="${w}"]`).check(); else if (id === "s_variable" || id === "s_seguro_salud" || id.endsWith("_indep")) await p.locator("input[type=radio][value=no]").check(); else await p.locator("input[type=radio]").first().check(); } else await p.fill("input[name=value]", v || "100");
    await p.click("[data-testid=lb-next]"); await p.waitForTimeout(350); }
  check(seen.length > 40, `9. Diagnóstico profundo: ${seen.length} preguntas adicionales`); check(seen.includes("s_seguro_vida") && !seen.includes("s_deuda_tasa"), "9. Ramificación: pregunta de seguro de vida porque hay dependientes; sin tasa de deuda porque no hay deuda");
  check(seen.includes("t_d_atencion") && !seen.includes("t_d_marketing"), "9. Ramificación: solo clasifica las áreas donde declaró horas");
  await p.goto(APP + "/libertad"); t = await body(p); check(/Preguntas|Cálculos incompletos|Convertir mi plan/.test(t), "10. Mapa con detalle profundo");
  const of = p.locator("[data-testid=lb-office]"); check((await of.innerText()).includes("Responder la duda de un cliente") || (await of.innerText()).includes("Responder"), "11. «Convertir mi plan en tareas»: propone tareas guiadas reales para atención"); check(/ningún empleado IA lo sustituye|no hay una tarea/.test(await of.innerText()), "11. Reconoce lo que aún no cubre ninguna tarea (delegar a persona)"); check(/solo se considera real cuando lo mides/.test(await of.innerText()), "11. No afirma ahorros sin medirlos");
  await p.fill("[data-testid=lb-office] input[name=text]", "Necesito ganar $80,000"); await p.click("[data-testid=lb-office] form button"); await p.waitForURL(/error=/); check(/cifras de dinero/.test(decodeURIComponent(p.url())), "12. Bloquea compartir cifras de dinero con la oficina");
  await p.fill("[data-testid=lb-office] input[name=text]", "Recuperar 10 horas semanales de atención a clientes"); await p.click("[data-testid=lb-office] form button"); await p.waitForTimeout(1500);
  await p.goto(APP + "/cerebro"); await p.click("summary:has-text(\"texto exacto\")"); const brainTxt = await body(p); check(brainTxt.includes("Recuperar 10 horas semanales"), "12. El Cerebro Empresarial recibe SOLO el objetivo autorizado"); check(!/30000|35000|90000|Elegir cómo uso mi tiempo/.test(brainTxt), "12. El Cerebro NO contiene cifras ni textos personales del plan");
  // Seguimiento
  await p.goto(APP + "/libertad"); await p.fill("[data-testid=lb-track] input[name=ingreso]", "36000"); await p.fill("[data-testid=lb-track] input[name=horas]", "50"); await p.click("[data-testid=lb-track] button"); await p.waitForTimeout(1500); check((await body(p)).includes("$36,000"), "13. Seguimiento mensual guardado");
  // Exportación
  const ex = await p.evaluate(async () => { const h = await fetch("/libertad/exportar?formato=html"); const j = await fetch("/libertad/exportar?formato=json"); return { hs: h.status, ht: await h.text(), hc: h.headers.get("cache-control"), js: j.status, jd: j.headers.get("content-disposition"), jt: await j.text() }; });
  check(ex.hs === 200 && ex.ht.includes("Mi Mapa de Libertad") && ex.ht.includes("no asesoría financiera") && /no-store/.test(ex.hc), "14. HTML imprimible con aviso y sin caché"); check(ex.js === 200 && /attachment/.test(ex.jd) && JSON.parse(ex.jt).respuestas.f_gasto_total === 30000, "14. JSON descargable con todas las respuestas");
  // Aislamiento: cliente B
  const B = await mk(); await login(B.p, "beto@libertad.test"); await B.p.goto(APP + "/libertad"); const tb = await body(B.p); check(tb.includes("Antes de empezar") && !tb.includes("30,000"), "15. Otro cliente no ve nada del plan de Ana (empieza vacío)");
  const crossB = await B.p.evaluate(async () => { const r = await fetch("/libertad/exportar?formato=json"); return r.status; }); check(crossB === 404, "15. Otro cliente no puede exportar un plan que no tiene (404)");
  // Móvil
  const M = await mk({ width: 390, height: 844 }); await login(M.p, "ana@libertad.test"); await M.p.goto(APP + "/libertad"); await M.p.screenshot({ path: `${OUT}/capturas/05-mapa-movil.png`, fullPage: true });
  const ovf = await M.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ovf <= 2, `16. Móvil: sin desborde horizontal (${ovf}px)`); await M.p.goto(APP + "/libertad/diagnostico"); await M.p.screenshot({ path: `${OUT}/capturas/06-pregunta-movil.png`, fullPage: true });
  // Accesibilidad básica
  if (fs.existsSync("/var/tmp/axe/node_modules/axe-core/axe.min.js")) { await p.goto(APP + "/libertad"); await p.addScriptTag({ path: "/var/tmp/axe/node_modules/axe-core/axe.min.js" }); const ax = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }); return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id + ":" + v.nodes.length + ":" + v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0] && n.any[0].message)).join(" ; ").slice(0, 400)); }); check(ax.length === 0, "17. Accesibilidad (axe, serio/crítico): " + (ax.join(", ") || "sin hallazgos")); }
  // Borrado
  await p.fill("[data-testid=lb-privacy] input[name=confirm]", "no"); await p.click("[data-testid=lb-privacy] button.danger"); await p.waitForURL(/error=/); check((await db.query("SELECT count(*)::int n FROM libertad_plans")).rows[0].n === 1, "18. Borrar exige escribir BORRAR");
  await p.fill("[data-testid=lb-privacy] input[name=confirm]", "BORRAR"); await p.click("[data-testid=lb-privacy] button.danger"); await p.waitForURL(/ok=/); const cnt = async (t) => (await db.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  check((await cnt("libertad_plans")) === 0 && (await cnt("libertad_versions")) === 0 && (await cnt("libertad_checkins")) === 0 && (await cnt("libertad_shared_goals")) === 0, "18. Borrado total: plan, versiones, seguimiento y objetivos compartidos eliminados");
  await p.goto(APP + "/cerebro"); check(!(await body(p)).includes("Recuperar 10 horas semanales"), "18. El objetivo compartido desaparece también del Cerebro");
  check((await cnt("usage_events")) === 0, "19. El módulo no consumió tokens de IA"); check(errs.length === 0, "20. Sin errores de JavaScript en el navegador" + (errs.length ? ": " + errs[0] : ""));
  await b.close(); await db.end();
})().catch((e) => { console.error("✗ EXCEPCIÓN", e); process.exit(1); });
