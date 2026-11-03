import { Db } from "../db";
import { AgencyActor } from "../auth";
import { hireFromTemplate } from "../catalog/office";
import { deployService } from "./index";

/** Despliega un servicio del catálogo en la oficina de un cliente (contrata sus agentes con la skill de la agencia). */
export const deployServiceToClient = (db: Db, a: AgencyActor, serviceId: string, companyId: string) =>
  deployService(db, a, serviceId, companyId, (actor, key) => hireFromTemplate(db, actor, key));
