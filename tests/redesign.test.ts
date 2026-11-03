import { describe, it, expect, beforeEach } from "vitest";
import { Db } from "@/server/db";
import { signupAgency, login, agencyActorFromToken, actAs, AgencyActor } from "@/server/auth";
import { friendlyError, roleLabel, TASK_STATUS } from "@/lib/lang";
import { buildTaughtSkill, previewTaught, TEACH_QUESTIONS, emptyTeach } from "@/lib/teach";
import { defaultSkill } from "@/server/skills";
import { EMPLOYEES, getTemplate } from "@/server/catalog/data";
import { SERVICE_CARDS, plainEmployee, employeesForServices, allPlainEmployees } from "@/server/guide/services";
import { assist, ASSISTANT_NOTE } from "@/server/guide/assistant";
import { practiceExample, practiceInstruction, DEMO_LABEL } from "@/server/guide/practice";
import { SIMPLE_APPS, OTHER_APPS, appView, employeesUsing } from "@/server/connectors/simple";
import { chooseServices, ensureDemoOffice, hireInDemo, saveIdentity, saveName, runPractice, getOnboarding, finish } from "@/server/onboarding";
import { createClient, listClients, listServices } from "@/server/agency";
import { companyScene, agencyScene } from "@/server/office3d";
import { listTasks } from "@/server/tasks";
import { newDb, ScriptedProvider, FakeAdapter } from "./helpers";

describe("lenguaje sencillo", () => {
  it("traduce mensajes técnicos a frases que dicen qué hacer", () => {
    expect(friendlyError("Falta configurar Composio (COMPOSIO_API_KEY). Consulta la guía")).not.toMatch(/COMPOSIO_API_KEY/);
    expect(friendlyError("La IA no está configurada (falta ANTHROPIC_API_KEY). No se ejecutó nada.")).toMatch(/inteligencia artificial/);
    expect(friendlyError("La IA no está configurada (falta ANTHROPIC_API_KEY).")).not.toMatch(/ANTHROPIC/);
    expect(friendlyError("Presupuesto mensual de IA agotado (gastado 1 de 2)")).toMatch(/presupuesto/i);
    expect(friendlyError("Tu plan Prueba permite hasta 2 clientes.")).toBe("Tu plan «Prueba» permite hasta 2 clientes. Para agregar más, hay que cambiar de plan.");
    expect(friendlyError("Empresa no encontrada.")).toMatch(/No encontramos/);
    expect(friendlyError("Algo que ya es claro")).toBe("Algo que ya es claro"); expect(friendlyError(null)).toBe("");
  });
  it("ningún mensaje traducido contiene jerga", () => {
    for (const m of ["COMPOSIO", "ANTHROPIC_API_KEY", "tarifa del modelo (MODEL_INPUT_USD_PER_MTOK)", "Fallo: Falló la IA: 429", "Tiempo máximo de 120s excedido."]) expect(friendlyError(m)).not.toMatch(/API|KEY|MODEL_|Composio|token|webhook/i);
  });
  it("roles y estados con palabras de uso, y los estados llevan icono (no solo color)", () => {
    expect(roleLabel("viewer")).toBe("Solo puede ver"); expect(roleLabel("agency_owner")).toBe("Dueño de la agencia");
    for (const s of Object.values(TASK_STATUS)) { expect(s.icon.length).toBeGreaterThan(0); expect(s.text.length).toBeGreaterThan(2); }
  });
});

describe("enseña a tu empleado", () => {
  const base = defaultSkill(getTemplate("creador-anuncios")!);
  const ans = { quiere: "Que escriba anuncios para mi cafetería", como: "Tono alegre", sabe: "Vendemos café y pan", nunca: "Prometer descuentos\nInventar opiniones", resultado: "Tres opciones numeradas" };
  it("5 preguntas con ayuda y ejemplo", () => { expect(TEACH_QUESTIONS.map((q) => q.key)).toEqual(["quiere", "como", "sabe", "nunca", "resultado"]); for (const q of TEACH_QUESTIONS) { expect(q.help.length).toBeGreaterThan(10); expect(q.example.length).toBeGreaterThan(5); } });
  it("genera instrucciones ordenadas y conserva la base; es repetible (no se acumula)", () => {
    const s = buildTaughtSkill(base, ans);
    expect(s.systemPrompt).toContain(base.systemPrompt.slice(0, 40)); expect(s.systemPrompt).toContain("Lo que NUNCA debes hacer:\n- Prometer descuentos\n- Inventar opiniones");
    expect(s.outputFormat).toBe("Tres opciones numeradas"); expect(s.actionConditions).toContain("Nunca: Prometer descuentos"); expect(s.autonomy.requireApprovalForWrites).toBe(true);
    const again = buildTaughtSkill(s, { ...ans, como: "Tono formal" }); expect((again.systemPrompt.match(/Lo que me enseñaron/g) ?? []).length).toBe(1); expect(again.systemPrompt).toContain("Tono formal"); expect(again.systemPrompt).not.toContain("Tono alegre");
  });
  it("vista previa en palabras sencillas con las 5 secciones", () => {
    const p = previewTaught(ans); expect(p.map((x) => x.titulo)).toEqual(["Lo que hará", "Cómo trabajará", "Lo que sabrá de tu negocio", "Lo que nunca hará", "Lo que recibirás"]);
    expect(previewTaught(emptyTeach).every((x) => x.texto.length > 0)).toBe(true);
  });
  it("no puede quitar la protección de pedir permiso", () => { expect(buildTaughtSkill(base, { ...emptyTeach, nunca: "pedir permiso" }).autonomy.requireApprovalForWrites).toBe(true); });
});

describe("tarjetas de servicios y empleados", () => {
  it("las 7 tarjetas existen y recomiendan empleados reales", () => {
    expect(SERVICE_CARDS.map((c) => c.title)).toEqual(["Crear anuncios", "Contestar mensajes", "Revisar inventarios", "Analizar ventas", "Organizar tareas", "Crear contenido", "Atender clientes"]);
    for (const c of SERVICE_CARDS) { expect(c.employees.length).toBeGreaterThan(0); for (const k of c.employees) expect(getTemplate(k), `${c.id}:${k}`).toBeTruthy(); }
  });
  it("cada empleado se explica en 4 frases cotidianas (qué hace, para qué sirve, qué necesita, qué entrega)", () => {
    for (const p of allPlainEmployees()) for (const f of [p.que, p.paraQue, p.necesita, p.entrega]) { expect(f.length, p.key).toBeGreaterThan(8); expect(f, p.key).not.toMatch(/\b(API|skill|token|webhook|CRM|JSON|KPI)\b/i); }
    expect(allPlainEmployees().length).toBe(EMPLOYEES.length);
  });
  it("recomienda sin repetir", () => { const e = employeesForServices(["anuncios", "contenido"]).map((x) => x.key); expect(new Set(e).size).toBe(e.length); expect(e).toContain("creador-anuncios"); expect(e).toContain("estratega-contenido"); });
});

describe("asistente guiado (por reglas, y lo dice)", () => {
  it("«marketing a restaurantes» → creador de anuncios, analista de campañas y creador de contenido, con botón y sin cambiar nada", () => {
    const r = assist("Quiero vender servicios de marketing a restaurantes");
    expect(r.understood).toBe(true); expect(r.employees).toEqual(["creador-anuncios", "analista-meta-ads", "estratega-contenido"]);
    expect(r.text).toMatch(/restaurantes/); expect(r.text).toMatch(/no se cambia nada hasta que tú lo confirmes/);
    expect(r.suggestions[0].hire).toEqual(r.employees); expect(r.note).toBe(ASSISTANT_NOTE); expect(r.note).toMatch(/no es inteligencia artificial/);
  });
  it("entiende servicios sueltos y acciones; lo que no entiende lo dice", () => {
    expect(assist("quiero contestar mensajes de whatsapp de clientes").services).toContain("mensajes");
    expect(assist("revisar el inventario de mi tienda").employees).toContain("controlador-inventario");
    expect(assist("quiero agregar un cliente nuevo").suggestions[0].href).toBe("/agencia/clientes");
    const lost = assist("blablabla xyz"); expect(lost.understood).toBe(false); expect(lost.text).toMatch(/No estoy seguro/); expect(lost.suggestions.length).toBe(7);
    expect(assist("").understood).toBe(false);
  });
  it("nunca promete ingresos ni afirma ser inteligente", () => { for (const t of ["quiero ganar dinero fácil", "marketing para clínicas", "ventas"]) { const r = assist(t); expect(r.text).not.toMatch(/garantiz|ganar[áa]s|dinero f[áa]cil/i); expect(r.note).toMatch(/no es inteligencia artificial/); } });
});

describe("conecta tus aplicaciones: estado real", () => {
  const env = (o: any = {}) => ({ composioReady: false, channels: { telegram: false, whatsapp: false }, connected: new Set<string>(), ...o });
  it("sin activar: «Necesita que la activen» con pasos uno por uno (nunca finge éxito)", () => {
    const v = appView(SIMPLE_APPS.find((a) => a.id === "shopify")!, env());
    expect(v.state).toBe("necesita"); expect(v.steps.length).toBe(3); expect(v.button).toBe("Ver cómo activarla");
  });
  it("lista, conectada y próximamente", () => {
    expect(appView(SIMPLE_APPS.find((a) => a.id === "gmail")!, env({ composioReady: true })).state).toBe("lista");
    expect(appView(SIMPLE_APPS.find((a) => a.id === "gmail")!, env({ composioReady: true, connected: new Set(["gmail"]) })).state).toBe("conectada");
    expect(appView(OTHER_APPS.find((a) => a.id === "tiktok")!, env()).state).toBe("proximamente");
    expect(appView(SIMPLE_APPS.find((a) => a.id === "telegram")!, env({ channels: { telegram: true, whatsapp: false } })).state).toBe("lista");
    expect(appView(SIMPLE_APPS.find((a) => a.id === "whatsapp")!, env()).steps[1]).toMatch(/costo/);
  });
  it("cada tarjeta explica para qué sirve, qué permisos pide y qué empleado la usa", () => {
    expect(SIMPLE_APPS.map((a) => a.title)).toEqual(["WhatsApp", "Telegram", "Instagram", "Facebook", "Shopify (tienda en línea)", "Google Drive", "Gmail", "Calendario"]);
    for (const a of SIMPLE_APPS) { expect(a.para.length).toBeGreaterThan(10); expect(a.permisos.length).toBeGreaterThan(10); expect(a.permisos).not.toMatch(/OAuth|scope|API/i); }
    expect(employeesUsing(SIMPLE_APPS.find((a) => a.id === "shopify")!)).toContain("Controlador de inventario");
  });
  it("los permisos que piden cambios dicen que solo se hacen con permiso", () => { for (const id of ["instagram", "facebook", "shopify", "gmail", "calendario"]) expect(SIMPLE_APPS.find((a) => a.id === id)!.permisos).toMatch(/solo con tu permiso/); });
});

describe("práctica con datos inventados", () => {
  it("todo ejemplo está rotulado como inventado", () => {
    expect(DEMO_LABEL).toMatch(/inventados/); expect(DEMO_LABEL).toMatch(/No lo hizo una inteligencia artificial/);
    for (const k of ["creador-anuncios", "agente-soporte", "controlador-inventario", "analista-gastos"]) { const e = practiceExample(k); expect(e.negocio).toBe("Café Luna"); expect(e.pedido.length).toBeGreaterThan(10); expect(practiceInstruction(k)).toMatch(/no existe/); }
  });
});

describe("«Vamos a crear tu negocio»: pasos reales", () => {
  let db: Db, A: AgencyActor, B: AgencyActor;
  const mk = async (email: string, name: string) => { await signupAgency(db, { email, name: "D", password: "clave-larga-123", agencyName: name, specialty: "" }); return (await agencyActorFromToken(db, await login(db, email, "clave-larga-123")))!; };
  beforeEach(async () => { db = await newDb(); A = await mk("a@x.com", "Agencia A"); B = await mk("b@x.com", "Agencia B"); });

  it("recorrido completo: nombre → servicios → empleados → marca → oficina → práctica", async () => {
    await saveName(db, A, "  Nova Digital  "); expect((await db.query("SELECT name FROM agencies WHERE id=$1", [A.agencyId]))[0].name).toBe("Nova Digital");
    await expect(saveName(db, A, "  ")).rejects.toThrow();
    const chosen = await chooseServices(db, A, ["anuncios", "contenido", "no-existe"]); expect(chosen).toEqual(["anuncios", "contenido"]);
    expect((await listServices(db, A)).map((s: any) => s.name).sort()).toEqual(["Crear anuncios", "Crear contenido"]);
    await chooseServices(db, A, ["anuncios"]); expect((await listServices(db, A)).length).toBe(2); // sin duplicar
    await expect(chooseServices(db, A, [])).rejects.toThrow(/al menos una/);
    const hired = await hireInDemo(db, A, ["creador-anuncios", "estratega-contenido", "creador-anuncios", "no-existe"]); expect(hired.length).toBe(2);
    expect((await hireInDemo(db, A, ["creador-anuncios"])).length).toBe(0); // ya contratado
    await saveIdentity(db, A, { name: "Nova Digital", color: "#0a7d5a", style: "calido", logo: null });
    await expect(saveIdentity(db, A, { name: "N", color: "verde", style: "moderno", logo: null })).rejects.toThrow();
    await expect(saveIdentity(db, A, { name: "N", color: "#112233", style: "raro", logo: null })).rejects.toThrow();
    const demo = await ensureDemoOffice(db, A); const scene = await companyScene(db, await actAs(db, A, demo));
    expect(scene.stats.employees).toBe(2); expect(scene.theme.key).toBe("calido"); expect(scene.brand.color).toBe("#0a7d5a");
    // práctica sin IA: ejemplo rotulado, NO crea tareas
    const e = (await db.query("SELECT id FROM employees WHERE company_id=$1 AND template_key='creador-anuncios'", [demo]))[0].id;
    const demoRes = await runPractice(db, A, e, { provider: null, connector: new FakeAdapter() });
    expect(demoRes.kind).toBe("demo"); if (demoRes.kind === "demo") { expect(demoRes.label).toMatch(/inventados/); expect(demoRes.entrega).toMatch(/Café Luna/); }
    expect((await db.query("SELECT 1 FROM tasks")).length).toBe(0);
    await finish(db, A); expect((await getOnboarding(db, A)).done).toBe(true);
  });
  it("con IA conectada la práctica es una tarea REAL en la oficina de práctica, etiquetada como datos inventados", async () => {
    await hireInDemo(db, A, ["creador-anuncios"]); const demo = await ensureDemoOffice(db, A);
    const e = (await db.query("SELECT id FROM employees WHERE company_id=$1", [demo]))[0].id;
    const p = new ScriptedProvider([{ text: "Anuncio 1: …" }]);
    const r = await runPractice(db, A, e, { provider: p, connector: new FakeAdapter() });
    expect(r.kind).toBe("real"); if (r.kind === "real") { expect(r.status).toBe("completed"); expect(r.result).toContain("Anuncio 1"); expect(r.label).toMatch(/datos inventados/); }
    expect((p.calls[0].messages[0] as any).content).toMatch(/PRÁCTICA con datos inventados/);
    expect((await listTasks(db, await actAs(db, A, demo)))[0].title).toMatch(/^Práctica/);
  });
  it("la oficina de práctica no cuenta para los límites del plan", async () => {
    await ensureDemoOffice(db, A); await ensureDemoOffice(db, A); expect((await db.query("SELECT 1 FROM companies WHERE agency_id=$1 AND is_demo", [A.agencyId])).length).toBe(1);
    await createClient(db, A, { name: "C1" }); await createClient(db, A, { name: "C2" }); // plan prueba: 2 clientes
    await expect(createClient(db, A, { name: "C3" })).rejects.toThrow(/permite hasta 2 clientes/);
    expect((await listClients(db, A)).filter((c: any) => c.is_demo).length).toBe(1);
  });
  it("aislamiento: la otra agencia no ve la oficina de práctica ni sus empleados", async () => {
    await hireInDemo(db, A, ["agente-soporte"]); const demoA = await ensureDemoOffice(db, A);
    await expect(actAs(db, B, demoA)).rejects.toThrow(/no encontrada/);
    const sc = await agencyScene(db, B); expect(JSON.stringify(sc)).not.toContain("Oficina de práctica");
    await expect(runPractice(db, B, (await db.query("SELECT id FROM employees"))[0].id, { provider: null, connector: new FakeAdapter() })).rejects.toThrow(/no está en tu oficina/);
  });
  it("máximo de empleados de práctica", async () => {
    await expect(hireInDemo(db, A, EMPLOYEES.slice(0, 13).map((e) => e.key))).rejects.toThrow(/hasta 12/);
  });
});
