import { getDb } from "@/server/db";
import { affiliateByCode, AFFILIATE_TERMS } from "@/server/affiliates";

/** Enlace de referencia: /r/CODIGO. Guarda el código en una cookie propia (30 días) y lleva a la landing. Un código desconocido o de un afiliado no aprobado no guarda nada. Sin IP ni identificadores: solo cuenta la visita. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const u = new URL(req.url); const site = (process.env.NEXT_PUBLIC_SITE_URL || u.origin).replace(/\/$/, ""); const dest = `${site}/`;
  const c = /^[A-Za-z0-9]{6,16}$/.test(code) ? code.toUpperCase() : null; const headers = new Headers({ Location: dest });
  try { const db = await getDb(); const a = c ? await affiliateByCode(db, c) : null;
    if (a && a.status === "aprobada") { await db.query("INSERT INTO events(name,path,props) VALUES('ref_visita','/r',$1)", [JSON.stringify({ code: c })]); headers.append("Set-Cookie", `cto_ref=${c}; Max-Age=${AFFILIATE_TERMS.cookieDays * 86400}; Path=/; HttpOnly; SameSite=Lax${site.startsWith("https") ? "; Secure" : ""}`); } } catch {}
  return new Response(null, { status: 303, headers });
}
