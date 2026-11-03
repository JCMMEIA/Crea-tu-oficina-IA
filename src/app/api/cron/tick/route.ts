import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { getProvider } from "@/server/models";
import { runDueAutomations } from "@/server/automations";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET, got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = !!secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return new Response("No autorizado", { status: 401 });
  return Response.json(await runDueAutomations(await getDb(), { provider: getProvider() }));
}
