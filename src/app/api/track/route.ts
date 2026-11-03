import { getDb } from "@/server/db";
import { trackPublic } from "@/server/commercial/events";

/** Medición anónima (visitas, clics, planes vistos). No guarda IP ni cookies; solo acepta nombres permitidos. */
export async function POST(req: Request) {
  try { const b = await req.json(); await trackPublic(await getDb(), b); } catch {}
  return new Response(null, { status: 204 });
}
