import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { enqueue } from "@/server/messaging/queue";
import { processJobs } from "@/server/messaging/jobs";
import { runtimeDeps } from "@/server/messaging/runtime";
import { processEmails } from "@/server/commerce/mail";

/** Lo llama un programador externo cada minuto: avisos pendientes, resúmenes y reintentos de la cola. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET, got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!(secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret)))) return new Response("No autorizado", { status: 401 });
  const db = await getDb();
  await enqueue(db, "scan_notifications", {}, { dedupeKey: `scan:${Math.floor(Date.now() / 60_000)}` });
  const emails = await processEmails(db); // correos transaccionales pendientes o por reintentar
  return Response.json({ ...(await processJobs(db, runtimeDeps())), emails });
}
