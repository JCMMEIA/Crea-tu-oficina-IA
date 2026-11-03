import { after } from "next/server";
import { getDb } from "@/server/db";
import { getAdapter } from "@/server/connectors";
import { processWhatsAppWebhook, whatsappVerify } from "@/server/messaging/webhooks";
import { processJobs } from "@/server/messaging/jobs";
import { runtimeDeps } from "@/server/messaging/runtime";

export async function GET(req: Request) { const r = whatsappVerify(new URL(req.url).searchParams); return new Response(r.body, { status: r.status }); }
export async function POST(req: Request) {
  const db = await getDb();
  const raw = await req.text(); // la firma se calcula sobre el cuerpo CRUDO
  const r = await processWhatsAppWebhook(db, raw, req.headers.get("x-hub-signature-256"), getAdapter());
  if (r.status === 200) after(() => processJobs(db, runtimeDeps()));
  return new Response(r.body, { status: r.status });
}
