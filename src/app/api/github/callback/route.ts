import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { completeGithub } from "@/server/github";

/** «Setup URL» de la GitHub App: GitHub vuelve aquí con installation_id, code y state. Exige sesión y valida todo en el servidor. */
export async function GET(req: NextRequest) {
  const base = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin; const { db, actor } = await currentActor(); const q = req.nextUrl.searchParams;
  const go = (k: "ok" | "error", m: string) => NextResponse.redirect(new URL(`/conexiones?${k}=${encodeURIComponent(m)}#github`, base));
  if (!actor) return NextResponse.redirect(new URL("/recuperar", base));
  try {
    await completeGithub(db, actor, { installationId: q.get("installation_id") ?? "", code: q.get("code") ?? "", state: q.get("state") ?? "" });
    return go("ok", "GitHub conectado. Elige ahora qué repositorios y carpetas de documentación usar.");
  } catch (e: any) { return go("error", e?.message ?? "No se pudo conectar GitHub."); }
}
