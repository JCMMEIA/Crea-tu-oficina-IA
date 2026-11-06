"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { deleteGithubKnowledge, disconnectGithub, selectSources, setEmployeeAccess, startGithub, syncGithub } from "@/server/github";

const back = (msg: string, ok: boolean) => redirect(`/conexiones?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}#github`);
const SKIP_LABEL: Record<string, string> = { ruta_bloqueada: "ruta bloqueada", nombre_sospechoso: "nombre sospechoso", posible_secreto: "posible secreto", binario: "no es texto", muy_grande: "muy grande", limite_de_archivos: "fuera de límite" };

/** Acciones de la tarjeta «Conectar GitHub». Cada una exige permiso en el servidor (assertCan) y trabaja solo con la empresa de la sesión. */
export async function githubAction(f: FormData) {
  const { db, actor } = await requireActor(); const op = String(f.get("op") ?? "");
  let url: string | undefined, msg = "", ok = true;
  try {
    if (op === "connect") url = (await startGithub(db, actor)).url;
    else if (op === "select") {
      const repos = f.getAll("repo").map(String);
      await selectSources(db, actor, repos.map((repo) => ({ repo, paths: String(f.get(`paths:${repo}`) ?? "").split(/\r?\n|,/) })));
      msg = repos.length ? "Listo: guardamos los repositorios. Ahora pulsa «Sincronizar»." : "Quitamos todos los repositorios.";
    } else if (op === "access") { await setEmployeeAccess(db, actor, f.getAll("employee").map(String)); msg = "Listo: guardamos qué empleados pueden consultar la documentación."; }
    else if (op === "sync") {
      const rs = await syncGithub(db, actor);
      msg = rs.length ? rs.map((r) => `${r.repo}: ${r.status === "omitido" ? r.message : `${r.files} documentos${Object.keys(r.skipped).length ? ` (se saltaron: ${Object.entries(r.skipped).map(([k, n]) => `${n} ${SKIP_LABEL[k] ?? k}`).join(", ")})` : ""}. ${r.message}`}`).join(" · ") : "Primero elige repositorios.";
      ok = !rs.some((r) => r.status === "error");
    } else if (op === "disconnect") { const r = await disconnectGithub(db, actor, { deleteKnowledge: false }); msg = "GitHub quedó desconectado. Tus empleados ya no lo consultan." + (r.revoked === false ? " No pudimos quitar la App en GitHub: revísalo en Settings → Applications." : ""); }
    else if (op === "disconnect_delete") { const r = await disconnectGithub(db, actor, { deleteKnowledge: true }); msg = "GitHub quedó desconectado y se borró lo importado." + (r.revoked === false ? " No pudimos quitar la App en GitHub: revísalo en Settings → Applications." : ""); }
    else if (op === "delete_knowledge") { await deleteGithubKnowledge(db, actor); msg = "Listo: borramos todo lo importado de GitHub."; }
  } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; ok = false; msg = e?.message ?? "Error inesperado."; }
  revalidatePath("/", "layout");
  if (url) redirect(url);
  back(msg, ok);
}
