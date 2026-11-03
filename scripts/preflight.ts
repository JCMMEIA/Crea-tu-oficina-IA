// Revisión antes de arrancar:  npm run preflight   (lee las variables del entorno; no imprime valores secretos)
import { preflight, preflightOk } from "../src/server/ops/preflight";
(async () => {
  const c = preflight(); const icon = { OK: "✅", FALTA: "❌", AVISO: "⚠️ " };
  for (const x of c) console.log(`${icon[x.level]} ${x.name.padEnd(26)} ${x.detail}`);
  if (/^postgres/.test(process.env.DATABASE_URL ?? "")) {
    try { const { getDb } = await import("../src/server/db"); const db = await getDb(); await db.query("SELECT 1"); const n = (await db.query("SELECT count(*) n FROM information_schema.tables WHERE table_schema = current_schema()"))[0].n; console.log(`✅ ${"Base de datos".padEnd(26)} conecta y el esquema está creado (${n} tablas)`); await db.close(); }
    catch (e: any) { console.log(`❌ ${"Base de datos".padEnd(26)} no conecta: ${String(e.message).replace(/postgres(ql)?:\/\/\S+/g, "<url>")}`); process.exit(1); }
  }
  const ok = preflightOk(c); console.log(ok ? "\nTODO LO OBLIGATORIO ESTÁ BIEN." : "\nFALTAN COSAS OBLIGATORIAS (las ❌)."); process.exit(ok ? 0 : 1);
})();
