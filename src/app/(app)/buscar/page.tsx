import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Empty } from "@/lib/ui";
export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim(); const { db, actor } = await requireActor(); const like = `%${q.replace(/[%_]/g, "")}%`;
  const c = actor.companyId;
  const emps = q ? await db.query("SELECT id,name,role_title FROM employees WHERE company_id=$1 AND (name ILIKE $2 OR role_title ILIKE $2 OR description ILIKE $2) LIMIT 10", [c, like]) : [];
  const tasks = q ? await db.query("SELECT id,title FROM tasks WHERE company_id=$1 AND (title ILIKE $2 OR instruction ILIKE $2) ORDER BY created_at DESC LIMIT 10", [c, like]) : [];
  const docs = q ? await db.query("SELECT id,title FROM knowledge_docs WHERE company_id=$1 AND (title ILIKE $2 OR content ILIKE $2) LIMIT 10", [c, like]) : [];
  return (<><h1>Buscar</h1><p className="muted">Resultados para «{q}» en tu empresa.</p>
    {!emps.length && !tasks.length && !docs.length && <Empty>Sin resultados.</Empty>}
    {emps.length > 0 && <div className="card"><h2>Empleados</h2>{emps.map((e) => <div key={e.id}><Link href={`/empleados/${e.id}`}>{e.name}</Link> <span className="muted">{e.role_title}</span></div>)}</div>}
    {tasks.length > 0 && <div className="card" style={{ marginTop: 12 }}><h2>Tareas</h2>{tasks.map((t) => <div key={t.id}><Link href={`/actividad/${t.id}`}>{t.title}</Link></div>)}</div>}
    {docs.length > 0 && <div className="card" style={{ marginTop: 12 }}><h2>Conocimiento</h2>{docs.map((d) => <div key={d.id}><Link href="/conocimiento">{d.title}</Link></div>)}</div>}</>);
}
