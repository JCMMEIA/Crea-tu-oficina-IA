import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { renderProposal } from "@/server/agency";
import { proposalStatusAction } from "../../../../agency_actions";
export default async function Propuesta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { db, agency } = await requireAgency();
  let text: string; try { text = await renderProposal(db, agency, id); } catch { notFound(); }
  const st = (await db.query("SELECT status FROM proposals WHERE id=$1 AND agency_id=$2", [id, agency.agencyId]))[0].status;
  return (<><p><Link href="/agencia/propuestas">← Propuestas</Link></p><Flash sp={sp} /><p className="muted">Copia este texto o imprímelo (Ctrl+P). Estado: <b>{st}</b></p><pre style={{ fontSize: ".95rem" }}>{text}</pre>
    <form action={proposalStatusAction} className="row"><input type="hidden" name="id" value={id} />{["borrador", "enviada", "aceptada", "rechazada"].map((s) => <button key={s} name="status" value={s} className="ghost" disabled={s === st}>Marcar {s}</button>)}</form></>);
}
