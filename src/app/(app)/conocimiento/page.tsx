import { requireActor, when } from "@/lib/session";
import { Flash, EmptyState } from "@/lib/ui";
import { listDocs } from "@/server/knowledge";
import { docAction } from "../../actions";
export default async function Conocimiento({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams; const { db, actor } = await requireActor();
  const docs = await listDocs(db, actor); const emps = await db.query("SELECT id,name FROM employees WHERE company_id=$1", [actor.companyId]);
  const nm = (ids: string[] | null) => ids === null ? "Todos" : ids.map((i) => emps.find((e) => e.id === i)?.name ?? "—").join(", ") || "Ninguno";
  return (<><h1>Lo que debe saber mi negocio</h1><p className="lead">Guarda aquí lo que tus empleados necesitan saber: tus productos, precios, políticas, cómo hablas con tus clientes. Cada empleado solo lee lo que tú permitas.</p><Flash sp={sp} />
    <div className="card"><h2>➕ Agregar información</h2><form action={docAction}><label>¿Cómo se llama?</label><input name="title" required /><label>¿Qué tipo de información es?</label><select name="kind">{["documento", "catálogo", "producto", "manual", "política", "proveedor", "estrategia", "identidad de marca", "resultados"].map((k) => <option key={k}>{k}</option>)}</select>
      <label>Escribe o pega la información</label><textarea name="content" rows={6} required />
      <label>¿Quién puede leerla?</label><span className="help">Si no marcas a nadie, la podrán leer todos tus empleados.</span><div>{emps.map((e) => <label key={e.id} style={{ fontWeight: 400, display: "inline-block", marginRight: 12 }}><input type="checkbox" name="allowed" value={e.id} style={{ width: "auto" }} /> {e.name}</label>)}</div>
      <p><button className="big">Guardar</button></p></form></div>
    <div className="card" style={{ marginTop: 12 }}><h2>📚 Lo que ya guardaste</h2>{docs.length ? <table><tbody>{docs.map((d: any) => <tr key={d.id}><td><b>{d.title}</b> <span className="chip">{d.kind}</span><div className="muted">Pueden leerlo: {nm(d.allowed_employee_ids)} · {when(d.updated_at)} · {d.size} caracteres</div></td><td><form action={docAction}><input type="hidden" name="op" value="delete" /><input type="hidden" name="id" value={d.id} /><button className="ghost">Eliminar</button></form></td></tr>)}</tbody></table> : <EmptyState icon="📚" title="Todavía no guardaste nada" text="Cuéntales qué vendes y cómo te gusta tratar a tus clientes. Con eso trabajarán mucho mejor." />}</div></>);
}
