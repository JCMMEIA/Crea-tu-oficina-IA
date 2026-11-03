// Prueba de aceptación del piloto Nova AI Solutions → Verde Vivo. Dos fases:
//   fase=a        (base persistente .data, base VACÍA): pasos 1-7; deja la aprobación PENDIENTE para revisarla en la interfaz.
//   fase=telegram (base en memoria): cadena completa + aprobación por Telegram con adaptador REAL sobre un servidor Telegram SIMULADO.
// Uso: npx tsx scripts/pilot/acceptance.ts <fase> <salida.json>
import fs from "node:fs";
import http from "node:http";
import { createPgliteDb, getDb } from "../../src/server/db";
import { createPilotAgency, createPilotClient, hirePilotTeam, createPilotAutomation, PILOT, EXPECTED, VERDE_VIVO_CSV } from "../../src/server/pilot";
import { importInventory, listInventory, listDrafts } from "../../src/server/inventory";
import { companyScene } from "../../src/server/office3d";
import { runDueAutomations } from "../../src/server/automations";
import { listTasks, getTask, listApprovals } from "../../src/server/tasks";
import { FakeAdapter } from "../../tests/helpers";
import { PilotSimProvider } from "./sim_provider";
import { createLinkCode } from "../../src/server/messaging/link";
import { scanNotifications, processJobs } from "../../src/server/messaging/jobs";
import { processTelegramWebhook } from "../../src/server/messaging/webhooks";
import { TelegramAdapter } from "../../src/server/messaging/adapters/telegram";

type Estado = "real" | "simulado" | "mixto" | "no_verificado";
const pasos: { n: string; nombre: string; estado: Estado; resultado: "OK" | "FALLÓ" | "PENDIENTE"; evidencia: unknown }[] = [];
async function paso(n: string, nombre: string, estado: Estado, fn: () => Promise<unknown>) {
  try { const evidencia = await fn(); pasos.push({ n, nombre, estado, resultado: estado === "no_verificado" ? "PENDIENTE" : "OK", evidencia }); console.log(`✓ ${n} ${nombre} [${estado}]`); }
  catch (e: any) { pasos.push({ n, nombre, estado, resultado: "FALLÓ", evidencia: e.message }); console.error(`✗ ${n} ${nombre}: ${e.message}`); }
}
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const DAY = 86400_000;

async function chain(db: any, owner: any, team: Record<string, string>, sim: PilotSimProvider, connector: any) {
  const t0 = new Date(); await createPilotAutomation(db, owner, team["controlador-inventario"], t0);
  await runDueAutomations(db, { provider: sim, adapter: connector, retryDelayMs: 0 }, new Date(t0.getTime() + DAY + 60_000));
}
const summarize = async (db: any, owner: any) => {
  const tasks = await listTasks(db, owner); const draft = (await listDrafts(db, owner))[0]; const ap = (await listApprovals(db, owner))[0];
  const events = [] as unknown[]; for (const t of tasks) { const g = await getTask(db, owner, t.id); events.push({ tarea: t.employee_name, estado: t.status, nivel: t.depth, padre: t.parent_task_id ? tasks.find((x: any) => x.id === t.parent_task_id)?.employee_name : null, eventos: g!.events.map((e: any) => e.kind) }); }
  return { tareas: events, borrador: draft && { id: draft.id, estado: draft.status, unidades: draft.total_units, productos: (draft.items as any[]).map((i) => `${i.nombre} +${i.unidades}`) }, aprobacion: ap && { estado: ap.status, resumen: ap.summary, datos: ap.args } };
};

async function faseA(out: string) {
  const db = await getDb(); const connector = new FakeAdapter(); const sim = new PilotSimProvider();
  let A: any, owner: any, companyId = "", team: Record<string, string> = {};
  await paso("1", "Crear agencia y empresa cliente", "real", async () => {
    A = await createPilotAgency(db, { email: "nova@piloto.test", password: "clave-piloto-123" }); ({ companyId, actor: owner } = await createPilotClient(db, A));
    const r = (await db.query("SELECT a.name agencia, c.name cliente FROM companies c JOIN agencies a ON a.id=c.agency_id WHERE c.id=$1", [companyId]))[0]; assert(r.agencia === PILOT.agency && r.cliente === PILOT.client, "nombres"); return r;
  });
  await paso("2", "Contratar los tres empleados", "real", async () => {
    team = await hirePilotTeam(db, owner); const rows = await db.query("SELECT e.name, d.name area FROM employees e JOIN departments d ON d.id=e.department_id WHERE e.company_id=$1 ORDER BY e.created_at", [companyId]); assert(rows.length === 3, "no son 3"); return rows;
  });
  await paso("3", "Oficina 3D generada con los empleados reales (escena)", "real", async () => {
    const s = await companyScene(db, owner); assert(s.stats.employees === 3, "empleados en escena"); return { zonas: s.zones.map((z) => ({ area: z.label, empleados: z.desks.map((d) => d.label), estado: z.statusLabel })), marca: s.brand.name, nota: "La captura visual se toma en la prueba de navegador" };
  });
  await paso("4", "Cargar inventario ficticio y comprobar el cálculo", "real", async () => {
    await importInventory(db, owner, VERDE_VIVO_CSV); const { analysis } = await listInventory(db, owner);
    const sql = (await db.query("SELECT count(*)::int n, sum(max_stock-stock)::int u FROM inventory_items WHERE company_id=$1 AND stock<min_stock", [companyId]))[0];
    assert(analysis.bajo_minimo.length === EXPECTED.bajoMinimo && analysis.total_unidades === EXPECTED.unidades && sql.n === 3 && sql.u === 66, "cálculo distinto del esperado");
    return { bajo_minimo: analysis.bajo_minimo.map((l) => `${l.nombre}: ${l.stock}/${l.minimo} → +${l.unidades}`), total_unidades: analysis.total_unidades, verificacion_independiente_sql: sql, origen_de_los_datos: "ficticios, definidos por el equipo técnico (el inventario «definido anteriormente» no se encontró)" };
  });
  await paso("5", "Ejecutar la automatización con el programador", "mixto", async () => {
    await chain(db, owner, team, sim, connector); const runs = await db.query("SELECT status,attempt FROM automation_runs"); assert(runs.length === 1 && runs[0].status === "completed", "ejecución"); return { ejecucion_programador: runs[0], real: "programador, motor de tareas, herramientas de inventario, base de datos", simulado: "las decisiones del modelo de IA (guion), NO Claude", llamadas_simuladas: sim.calls.map((c) => `${c.role}${c.tool ? " → " + c.tool : ""}`) };
  });
  const s = await summarize(db, owner);
  await paso("6", "Delegación y resultados (3 empleados, 3 niveles)", "mixto", async () => { assert(s.tareas.length === 3 && (s.borrador as any)?.unidades === 66, "cadena"); return s; });
  await paso("7", "Solicitud de aprobación registrada, sin ejecutar ninguna compra", "real", async () => { assert((s.aprobacion as any)?.estado === "pending" && (s.borrador as any)?.estado === "borrador" && connector.executed.length === 0, "estado"); return { ...s.aprobacion, borrador: (s.borrador as any).estado, acciones_externas_ejecutadas: connector.executed.length }; });
  fs.writeFileSync(out, JSON.stringify({ fase: "a", pasos }, null, 1)); await db.close();
}

async function faseTelegram(out: string) {
  const db = await createPgliteDb(); const connector = new FakeAdapter(); const sim = new PilotSimProvider(); const captured: any[] = [];
  const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { captured.push({ ruta: req.url!.replace(/bot[^/]+/, "bot***"), ...JSON.parse(b) }); res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, result: { message_id: captured.length } })); }); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r)); const port = (srv.address() as any).port;
  Object.assign(process.env, { TELEGRAM_API_BASE: `http://127.0.0.1:${port}`, TELEGRAM_BOT_TOKEN: "000:simulado", TELEGRAM_WEBHOOK_SECRET: "secreto-piloto" });
  const A = await createPilotAgency(db, { email: "nova@piloto.test", password: "clave-piloto-123" }); const { actor: owner } = await createPilotClient(db, A); const team = await hirePilotTeam(db, owner); await importInventory(db, owner, VERDE_VIVO_CSV);
  const deps = { provider: null, connector, adapters: { telegram: new TelegramAdapter() }, retryDelayMs: 0 }; let uid = 100;
  const send = (text: string, secret = "secreto-piloto") => processTelegramWebhook(db, { get: (k: string) => (k === "x-telegram-bot-api-secret-token" ? secret : null) }, { update_id: ++uid, message: { message_id: uid, date: 1, chat: { id: 5551, type: "private" }, from: { id: 5551, is_bot: false, first_name: "Propietaria" }, text } }, connector);
  await paso("8a", "Vincular Telegram del propietario (código de un solo uso)", "simulado", async () => { const { code } = await createLinkCode(db, A.userId, "telegram", true); assert((await send("hola", "mal")).status === 401, "debe rechazar secreto incorrecto"); await send(`/start ${code}`); await processJobs(db, deps as any); assert(captured.at(-1)?.text.includes("vinculado"), "bienvenida"); return { webhook_con_secreto_incorrecto: 401, bienvenida: captured.at(-1).text.split("\n")[0], destino: captured.at(-1).chat_id }; });
  await chain(db, owner, team, sim, connector); await scanNotifications(db); await processJobs(db, deps as any);
  const notice = captured.find((m) => /Aprobación pendiente/.test(m.text));
  await paso("8b", "Aviso de aprobación llega por Telegram con el resumen correcto", "simulado", async () => { assert(notice && /resurtir 3 productos \(66 unidades\)/.test(notice.text), "aviso"); return notice.text; });
  const code = notice?.text.match(/APROBAR ([A-Z0-9]{6})/)?.[1] ?? "";
  await paso("8c", "Aprobar por Telegram: «sí» no basta; APROBAR + CONFIRMAR", "simulado", async () => {
    await send("sí, apruébalo"); await send(`CONFIRMAR ${code}`); await processJobs(db, deps as any); assert((await listDrafts(db, owner))[0].status === "borrador", "no debía ejecutarse");
    await send(`APROBAR ${code}`); await processJobs(db, deps as any); assert((await listDrafts(db, owner))[0].status === "borrador", "debía pedir confirmación"); const aviso = captured.at(-1).text;
    await send(`CONFIRMAR ${code}`); await processJobs(db, deps as any); const d = (await listDrafts(db, owner))[0]; assert(d.status === "aprobado_sin_enviar", "estado final");
    return { tras_si_ok_o_confirmar_sin_aprobar: "borrador", aviso_de_confirmacion: aviso.split("\n")[0], estado_final: d.status, respuesta_final: captured.at(-1).text, compras_enviadas: connector.executed.length };
  });
  await paso("8d", "Telegram REAL (bot verdadero)", "no_verificado", async () => "No se probó: no hay token de bot autorizado. Ejecutar «npm run pilot:telegram» cuando exista (verifica el bot sin enviar mensajes).");
  await paso("9", "Claude REAL (API de Anthropic)", "no_verificado", async () => "No se probó: no hay ANTHROPIC_API_KEY. Ejecutar «npm run pilot:claude» cuando exista (usa datos ficticios y un tope de gasto).");
  fs.writeFileSync(out, JSON.stringify({ fase: "telegram", pasos, mensajes_recibidos_por_el_servidor_simulado: captured.length }, null, 1)); srv.close(); await db.close();
}
(async () => { const fase = process.argv[2], out = process.argv[3]; if (fase === "a") await faseA(out); else await faseTelegram(out); const bad = pasos.filter((p) => p.resultado === "FALLÓ").length; console.log(bad ? `\n${bad} PASO(S) FALLARON` : "\nTODOS LOS PASOS EJECUTADOS OK"); process.exit(bad ? 1 : 0); })();
