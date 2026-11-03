// Datos para la E2E de mensajería. Uso (base vacía, servidor detenido): rm -rf .data && npx tsx scripts/e2e/seed_messaging.ts /ruta/ids.json
import fs from "node:fs";
import { getDb } from "../../src/server/db";
import { signupAgency, login, agencyActorFromToken, actAs } from "../../src/server/auth";
import { createClient } from "../../src/server/agency";
import { hireFromTemplate } from "../../src/server/catalog/office";
async function main() {
  const db = await getDb();
  const mk = async (email: string, name: string) => { await signupAgency(db, { email, name: "Dueña", password: "clave-muy-larga-1", agencyName: name, specialty: "Marketing con IA" }); const a = (await agencyActorFromToken(db, await login(db, email, "clave-muy-larga-1")))!; await db.query("UPDATE agencies SET plan='avanzado' WHERE id=$1", [a.agencyId]); return a; };
  const A = await mk("ana@demo.test", "Agencia Demo Nova"); const R = await mk("rival@demo.test", "Agencia Rival");
  const c1 = await createClient(db, A, { name: "Alquimia Demo" }), c2 = await createClient(db, A, { name: "Tienda Beta" }); const cr = await createClient(db, R, { name: "Cliente Secreto" });
  for (const k of ["analista-competidores", "investigador-mercado", "guionista-storytelling"]) await hireFromTemplate(db, await actAs(db, A, c1), k);
  await hireFromTemplate(db, await actAs(db, A, c2), "agente-soporte"); await hireFromTemplate(db, await actAs(db, R, cr), "analista-gastos");
  fs.writeFileSync(process.argv[2], JSON.stringify({ c1, c2, cr }));
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
