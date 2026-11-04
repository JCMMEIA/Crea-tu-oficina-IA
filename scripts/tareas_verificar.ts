// Verificación REAL de las tareas guiadas con la IA configurada en el servidor (hace llamadas reales: cuestan centavos).
//   npm run tareas:verificar            → necesita ANTHROPIC_API_KEY y MODEL_INPUT_USD_PER_MTOK / MODEL_OUTPUT_USD_PER_MTOK en el entorno
// Usa una base de datos en MEMORIA (no toca la real) con dos oficinas ficticias y comprueba que: (1) la IA responde, (2) el resultado trae las secciones pedidas,
// (3) usa datos de SU negocio, (4) no menciona al otro negocio, (5) el consumo se registra con tokens reales. No imprime claves.
import { createPgliteDb } from "../src/server/db";
import { signup, login, actorFromToken } from "../src/server/auth";
import { hireFromTemplate, updateProfile } from "../src/server/catalog/office";
import { getProvider } from "../src/server/models";
import { getGuided } from "../src/features/tasks/catalog";
import { getRun, runGuidedTask } from "../src/features/tasks/service";
import { officeUsage } from "../src/server/usage/report";

(async () => {
  process.env.APP_SECRET ??= Buffer.alloc(32, 7).toString("base64");
  const provider = getProvider();
  if (!provider || !provider.pricing()) { console.log("❌ Falta ANTHROPIC_API_KEY o la tarifa del modelo (MODEL_INPUT_USD_PER_MTOK / MODEL_OUTPUT_USD_PER_MTOK). No se ejecutó nada: esto NO es una verificación real."); process.exit(2); }
  const db = await createPgliteDb(); let fails = 0; const check = (c: boolean, m: string) => { console.log(c ? "✅" : "❌", m); if (!c) fails++; };
  const mk = async (email: string, co: string, profile: any) => { await signup(db, { email, name: "Dueño", password: "clave-larga-123", companyName: co }); const a = (await actorFromToken(db, await login(db, email, "clave-larga-123")))!; await updateProfile(db, a, profile); return a; };
  const A = await mk("a@v.test", "Café Luna", { sector: "Cafetería de especialidad en Guadalajara", products: "Café de filtro $45, desayuno completo $99", clients: "Oficinistas jóvenes", valueProp: "Café de productores locales", tone: "Cercano y cálido", rules: "No prometer entregas el mismo día", goals: "Vender más entre semana" });
  const B = await mk("b@v.test", "Taller Ruiz", { sector: "Taller mecánico en Monterrey", products: "Afinación $900", clients: "Dueños de autos viejos", valueProp: "Garantía por escrito", tone: "Serio y técnico", goals: "Más citas" });
  await hireFromTemplate(db, A, "creador-anuncios"); await hireFromTemplate(db, A, "agente-soporte"); await hireFromTemplate(db, B, "creador-anuncios");
  const jobs: [typeof A, string, Record<string, string>, string, string][] = [
    [A, "anuncios-3-variantes", { oferta: "Desayuno completo a $99 de lunes a viernes", publico: "Oficinistas jóvenes", plataforma: "Instagram" }, "Café Luna", "Taller"],
    [A, "responder-cliente", { mensaje: "Hola, ¿tienen café sin cafeína y cuánto cuesta el desayuno?", datos: "Desayuno completo $99", canal: "WhatsApp" }, "99", "Taller"],
    [B, "anuncios-3-variantes", { oferta: "Afinación completa con garantía", publico: "Dueños de autos viejos", plataforma: "Facebook" }, "garantía", "Café"],
  ];
  for (const [who, key, answers, must, mustNot] of jobs) {
    console.log(`\n== ${getGuided(key)!.title} (${who === A ? "Café Luna" : "Taller Ruiz"}) ==`);
    const id = await runGuidedTask(db, who, key, answers, { provider }); const r = await getRun(db, who, id);
    check(r.status === "listo", `La IA real respondió (estado: ${r.status}${r.error ? " — " + r.error : ""})`); if (r.status !== "listo") continue;
    check(r.sections_ok === true, `Trae todas las secciones pedidas${r.sections_ok ? "" : " (faltan: " + JSON.stringify(r.sections_missing) + ")"}`);
    check(String(r.result).toLowerCase().includes(must.toLowerCase()), `Usa datos del negocio correcto («${must}»)`); check(!String(r.result).includes(mustNot), `No menciona al otro negocio («${mustNot}»)`);
    check(r.input_tokens > 0 && r.output_tokens > 0, `Consumo real registrado: ${r.input_tokens} tokens de entrada, ${r.output_tokens} de salida, costo ${Number(r.cost_usd).toFixed(4)} USD`);
    console.log("   --- primeras líneas del resultado ---\n   " + String(r.result).split("\n").slice(0, 6).join("\n   "));
  }
  const ua = await officeUsage(db, A.companyId), ub = await officeUsage(db, B.companyId);
  console.log(`\nConsumo Café Luna: ${ua.totals.tin + ua.totals.tout} tokens · Taller Ruiz: ${ub.totals.tin + ub.totals.tout} tokens`);
  check(ua.totals.calls === 2 && ub.totals.calls === 1, "El consumo se reparte por oficina");
  console.log(fails ? `\n❌ ${fails} comprobaciones fallaron` : "\n✅ Verificación real completa"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
