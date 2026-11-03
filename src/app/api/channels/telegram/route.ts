import { after } from "next/server";
import { getDb } from "@/server/db";
import { getAdapter } from "@/server/connectors";
import { processTelegramWebhook } from "@/server/messaging/webhooks";
import { processJobs } from "@/server/messaging/jobs";
import { runtimeDeps } from "@/server/messaging/runtime";

export async function POST(req: Request) {
  const db = await getDb();
  let body: unknown = null; try { body = await req.json(); } catch { /* cuerpo inválido: se rechaza abajo si no hay secreto correcto */ }
  const r = await processTelegramWebhook(db, req.headers, body, getAdapter());
  if (r.status === 200) after(() => processJobs(db, runtimeDeps())); // responde rápido; el trabajo largo corre después
  return new Response(r.body, { status: r.status });
}
