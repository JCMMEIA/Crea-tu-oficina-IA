import { NextRequest } from "next/server";
import { requireActor } from "@/lib/session";
import { getRun, renderDownload } from "@/features/tasks/service";

export const dynamic = "force-dynamic";
/** Descarga del resultado de una ejecución. Solo para la oficina dueña (sesión + company_id); si no, 404 sin dar pistas. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await requireActor();
  const run = await getRun(db, actor, id); if (!run || run.status !== "listo") return new Response("No encontrado", { status: 404 });
  const co = (await db.query("SELECT name FROM companies WHERE id=$1", [actor.companyId]))[0];
  const f = req.nextUrl.searchParams.get("formato") === "html" ? "html" : "md"; const d = renderDownload(run, co?.name ?? "Mi oficina", f);
  return new Response(d.body, { headers: { "Content-Type": d.type, "Content-Disposition": `attachment; filename="${d.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
