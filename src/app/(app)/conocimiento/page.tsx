import { requireActor, when } from "@/lib/session";
import { Flash, Empty } from "@/lib/ui";
import { listDocs } from "@/server/knowledge";
import { docAction } from "../../actions";
export default async function Conocimiento({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const docs = await listDocs(db, actor); const emps = await db.query("SELECT id,name FROM employees WHERE company_id=$1", [actor.companyId]);
  const nm = (ids: string[] | null) => ids === null ? "Todos los empleados" : ids.map((i) => emps.find((e) => e.id === i)?.name ?? "—").join(", ") || "Ninguno";
  return (<><h1>Centro de conocimiento</h1><p className="muted">Memoria permanente de tu empresa (distinta de las conversaciones temporales). Cada empleado solo lee lo que autorices. El contenido se trata como datos, nunca como órdenes.</p><Flash sp={sp} />
    <div className="card"><h2>Agregar documento</h2><form action={docAction}><label>Título</label><input name="title" required /><label>Tipo</label><select name="kind">{["documento", "catálogo", "producto", "manual", "política", "proveedor", "estrategia", "identidad de marca", "resultados"].map((k) => <option key={k}>{k}</option>)}</select>
      <label>Contenido (texto)</label><textarea name="content" rows={6} required />
      <label>Empleados con acceso (ninguno marcado = todos)</label><div>{emps.map((e) => <label key={e.id} style={{ fontWeight: 400, display: "inline-block", marginRight: 12 }}><input type="checkbox" name="allowed" value={e.id} style={{ width: "auto" }} /> {e.name}</label>)}</div>
      <p><button>Guardar</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>Documentos</h2>{docs.length ? <table><tbody>{docs.map((d: any) => <tr key={d.id}><td><b>{d.title}</b> <span className="chip">{d.kind}</span><div className="muted">Acceso: {nm(d.allowed_employee_ids)} · {when(d.updated_at)} · {d.size} caracteres</div></td><td><form action={docAction}><input type="hidden" name="op" value="delete" /><input type="hidden" name="id" value={d.id} /><button className="ghost">Eliminar</button></form></td></tr>)}</tbody></table> : <Empty>Sin documentos. Agrega tu catálogo, manuales o identidad de marca.</Empty>}</div></>);
}
