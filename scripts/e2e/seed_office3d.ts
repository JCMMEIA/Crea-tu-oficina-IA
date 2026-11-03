// Datos de demostración para la prueba E2E de la Oficina 3D. Uso (base VACÍA, con el servidor detenido):
//   rm -rf .data && npx tsx scripts/e2e/seed_office3d.ts /ruta/ids.json
import fs from "node:fs";
import { getDb } from "../../src/server/db";
import { signupAgency, login, agencyActorFromToken, actAs } from "../../src/server/auth";
import { createClient, addClientUser, applyIndustryTemplate } from "../../src/server/agency";
import { deployServiceToClient } from "../../src/server/agency/deploy";
import { hireFromTemplate, setEmployeeStatus } from "../../src/server/catalog/office";
import { createAutomation } from "../../src/server/automations";

async function main() {
const db = await getDb();
const mk = async (email: string, name: string) => { await signupAgency(db, { email, name: "Dueño", password: "clave-muy-larga-1", agencyName: name, specialty: "Marketing con IA" }); return (await agencyActorFromToken(db, await login(db, email, "clave-muy-larga-1")))!; };
const A = await mk("ana@demo.test", "Agencia Demo Nova");
await db.query("UPDATE agencies SET plan='avanzado', monthly_budget_usd=500, brand=$2 WHERE id=$1", [A.agencyId, JSON.stringify({ primaryColor: "#0a7d5a", tagline: "Resultados medibles con IA" })]);
const hire = async (c: string, keys: string[]) => { const act = await actAs(db, A, c); const ids: string[] = []; for (const k of keys) ids.push(await hireFromTemplate(db, act, k)); return ids; };

const empty = await createClient(db, A, { name: "Cliente Vacío (demo)" });
const one = await createClient(db, A, { name: "Cliente Un Área (demo)" });
await hire(one, ["analista-meta-ads", "creador-anuncios"]);
const multi = await createClient(db, A, { name: "Cliente Multiárea (demo)" });
const mkt = await hire(multi, ["analista-meta-ads", "creador-anuncios", "guionista-storytelling", "director-creativo", "estratega-contenido", "investigador-mercado"]);
await hire(multi, ["vendedor-conversacional", "seguimiento-prospectos", "admin-crm", "analista-conversiones", "especialista-ofertas"]);
await hire(multi, ["controlador-inventario", "coordinador-pedidos", "agente-soporte", "analista-satisfaccion", "analista-flujo", "asistente-ejecutivo", "supervisor-tareas"]);
await setEmployeeStatus(db, await actAs(db, A, multi), mkt[5], "paused");
const [svc] = await applyIndustryTemplate(db, A, "ecommerce");
await deployServiceToClient(db, A, svc, multi); // vincula servicios y suma empleados
await createAutomation(db, await actAs(db, A, multi), { name: "Reporte diario de inventario", trigger: { type: "interval", everyMinutes: 1440 }, employeeId: mkt[0], instruction: "Prepara el reporte" });
await addClientUser(db, A, multi, { email: "cliente@multi.test", name: "Cliente Demo", password: "clave-muy-larga-3", role: "viewer" });

const R = await mk("rival@demo.test", "Agencia Rival");
await db.query("UPDATE agencies SET plan='avanzado' WHERE id=$1", [R.agencyId]);
const secret = await createClient(db, R, { name: "Cliente Secreto del Rival" });
const ract = await actAs(db, R, secret); await hireFromTemplate(db, ract, "agente-soporte"); await hireFromTemplate(db, ract, "analista-gastos");

const count = async (c: string) => Number((await db.query<{ n: string }>("SELECT count(*) n FROM employees WHERE company_id=$1", [c]))[0].n);
fs.writeFileSync(process.argv[2], JSON.stringify({ empty, one, multi, secret, counts: { empty: await count(empty), one: await count(one), multi: await count(multi), secret: await count(secret) } }));
console.log("seed ok", await count(multi), "empleados en el cliente multiárea");
await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
