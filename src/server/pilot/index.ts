import { Db } from "../db";
import { actAs, Actor, AgencyActor, agencyActorFromToken, login, signupAgency } from "../auth";
import { createClient } from "../agency";
import { hireFromTemplate } from "../catalog/office";
import { createAutomation } from "../automations";

/** Piloto privado: Nova AI Solutions → Verde Vivo → «Control inteligente de inventario». DATOS 100 % FICTICIOS. */
export const PILOT = { agency: "Nova AI Solutions", client: "Verde Vivo", automation: "Control inteligente de inventario", team: ["controlador-inventario", "analista-proveedores", "supervisor-general"] as const };
/** Resultado esperado del conjunto de datos de abajo: 3 productos bajo el mínimo y 66 unidades por reponer (hasta el máximo). */
export const EXPECTED = { bajoMinimo: 3, unidades: 66 };

/**
 * NOTA DE ORIGEN: el «inventario ficticio definido anteriormente» NO se encontró en ningún repositorio ni conversación.
 * Este conjunto lo definió el equipo técnico para el piloto, calibrado con el criterio de aceptación (3 bajo mínimo, 66 unidades).
 * Por eso el 66 prueba que el sistema CALCULA bien sobre estos datos, no que descubra un dato externo. Se puede sustituir cargando otro CSV.
 */
export const VERDE_VIVO_CSV = `sku,producto,stock,minimo,maximo,costo,proveedor
VV-MAC-20,Maceta de barro 20 cm,4,10,30,38.50,Barro y Tierra
VV-SUS-5,Sustrato universal 5 kg,2,8,20,72.00,Agro Sur
VV-FER-1,Fertilizante orgánico 1 L,3,6,25,95.00,Agro Sur
VV-POT-12,Pothos en maceta 12 cm,18,8,30,64.00,Vivero Las Palmas
VV-SUC-06,Suculenta surtida,25,10,40,28.00,Vivero Las Palmas
VV-HEL-01,Helecho Boston,9,6,20,85.00,Vivero Las Palmas
VV-TIJ-01,Tijeras de podar,7,5,15,120.00,Herramientas del Centro
VV-REG-2L,Regadera 2 L,12,4,12,55.00,Herramientas del Centro
VV-SEM-ALB,Semillas de albahaca,30,15,60,18.00,Agro Sur
VV-GRA-2K,Grava decorativa 2 kg,6,6,18,32.00,Barro y Tierra
`;

export const AUTOMATION_INSTRUCTION = "Revisa el inventario de Verde Vivo. Si hay productos bajo el mínimo, pídele al Analista de proveedores que prepare el borrador de resurtido (hasta el máximo de cada producto) y que lo lleve a aprobación del propietario. No envíes ninguna compra.";

export async function createPilotAgency(db: Db, o: { email: string; password: string; ownerName?: string }): Promise<AgencyActor> {
  await signupAgency(db, { email: o.email, name: o.ownerName ?? "Propietaria Nova", password: o.password, agencyName: PILOT.agency, specialty: "Soluciones de inteligencia artificial para negocios" });
  const a = (await agencyActorFromToken(db, await login(db, o.email, o.password)))!;
  await db.query("UPDATE agencies SET plan='emprendedor', monthly_budget_usd=20 WHERE id=$1", [a.agencyId]);
  return a;
}
export async function createPilotClient(db: Db, a: AgencyActor): Promise<{ companyId: string; actor: Actor }> {
  const companyId = await createClient(db, a, { name: PILOT.client, industry: "vivero y jardinería", monthlyBudgetUsd: 5 });
  return { companyId, actor: await actAs(db, a, companyId) };
}
export async function hirePilotTeam(db: Db, actor: Actor): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}; for (const k of PILOT.team) ids[k] = await hireFromTemplate(db, actor, k); return ids;
}
export const createPilotAutomation = (db: Db, actor: Actor, controladorId: string, now = new Date()) =>
  createAutomation(db, actor, { name: PILOT.automation, trigger: { type: "interval", everyMinutes: 1440 }, employeeId: controladorId, instruction: AUTOMATION_INSTRUCTION, maxRunsPerDay: 3, maxRetries: 1 }, now);
