import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Flash } from "@/lib/ui";
import { DEPARTMENTS, EMPLOYEES } from "@/server/catalog/data";
import { getToolkit } from "@/server/connectors/catalog";
import { customDepartmentAction, hireAction, profileAction } from "../../actions";
import { getProvider } from "@/server/models";

const FIELDS: [string, string, boolean][] = [["sector", "Sector o industria", false], ["products", "Productos y servicios", true], ["clients", "Tipo de clientes", false], ["country", "País y mercado", false], ["website", "Sitio web", false], ["social", "Redes sociales", false], ["competitors", "Competidores principales", true], ["goals", "Objetivos empresariales", true], ["problems", "Problemas actuales", true], ["apps", "Aplicaciones que utilizas", false]];

export default async function Construir({ searchParams }: { searchParams: Promise<{ paso?: string; dep?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams; const paso = Math.min(4, Math.max(1, Number(sp.paso) || 1));
  const { db, actor } = await requireActor();
  const co = (await db.query("SELECT name,profile FROM companies WHERE id=$1", [actor.companyId]))[0];
  const myDeps = await db.query("SELECT id,key,name,custom FROM departments WHERE company_id=$1", [actor.companyId]);
  const myEmps = await db.query("SELECT template_key FROM employees WHERE company_id=$1", [actor.companyId]);
  const conns = new Set((await db.query("SELECT toolkit FROM connections WHERE company_id=$1 AND status='conectado'", [actor.companyId])).map((c) => c.toolkit as string));
  const hired = new Set(myEmps.map((e) => e.template_key as string));
  const aiOn = !!getProvider();
  return (<>
    <h1>Construye tu oficina</h1><p className="muted">Solo contratas lo que necesitas. Puedes omitir pasos y volver después.</p>
    <div className="steps">{["1 · Perfil", "2 · Departamentos", "3 · Empleados", "4 · Tu oficina"].map((l, i) => <Link key={l} href={`/construir?paso=${i + 1}`} className={paso === i + 1 ? "on" : ""}>{l}</Link>)}</div>
    <Flash sp={sp} />
    {paso === 1 && <form action={profileAction} className="card"><h2>Perfil de {co.name}</h2>
      {FIELDS.map(([k, l, big]) => (<div key={k}><label htmlFor={k}>{l}</label>{big ? <textarea id={k} name={k} defaultValue={co.profile[k] ?? ""} /> : <input id={k} name={k} defaultValue={co.profile[k] ?? ""} />}</div>))}
      <p className="row"><button>Guardar y continuar</button><Link className="btn ghost" href="/construir?paso=2">Omitir por ahora</Link></p></form>}
    {paso === 2 && <>
      <div className="grid">{DEPARTMENTS.map((d) => { const mine = myDeps.find((x) => x.key === d.key); const n = EMPLOYEES.filter((e) => e.department === d.key).length; return (
        <div className="card" key={d.key}><h3>{d.icon} {d.name}</h3><p className="muted">{d.description}</p><p className="muted">{n} empleados disponibles{mine ? " · ya en tu oficina" : ""}</p>
          <Link className="btn" href={`/construir?paso=3&dep=${d.key}`}>Ver empleados</Link></div>); })}
        {myDeps.filter((d) => d.custom).map((d) => <div className="card" key={d.id}><h3>🧩 {d.name}</h3><p className="muted">Departamento personalizado</p><Link className="btn ghost" href="/departamentos">Agregar puestos</Link></div>)}
      </div>
      <form action={customDepartmentAction} className="card" style={{ marginTop: 12 }}><h2>Crear un departamento propio</h2><div className="row"><input name="name" placeholder="Ej. Taller, Eventos, Importaciones" required style={{ flex: 1 }} /><button>Crear</button></div></form></>}
    {paso === 3 && <>
      {!aiOn && <div className="notice">La IA aún no está configurada (falta la clave de Claude). Puedes armar tu oficina, pero los empleados no ejecutarán tareas hasta configurarla. Ver <Link href="/ayuda">Ayuda</Link>.</div>}
      <p className="row"><Link className="chip" href="/construir?paso=3">Todos</Link>{DEPARTMENTS.map((d) => <Link key={d.key} className="chip" href={`/construir?paso=3&dep=${d.key}`}>{d.name}</Link>)}</p>
      <div className="grid">{EMPLOYEES.filter((e) => !sp.dep || e.department === sp.dep).map((e) => {
        const missing = e.connections.filter((c) => c.required && !conns.has(c.toolkit));
        return (<div className="card" key={e.key}><h3>{e.name}</h3><p className="muted">{DEPARTMENTS.find((d) => d.key === e.department)!.name}</p><p>{e.mission}</p>
          <details><summary>Ver ficha completa</summary>
            <h4>Responsabilidades</h4><ul>{e.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
            <h4>Conexiones</h4><p>{e.connections.length ? e.connections.map((c) => <span className="chip" key={c.toolkit}>{getToolkit(c.toolkit)?.label ?? c.toolkit} · {c.required ? "requerida" : "opcional"}</span>) : "No necesita conexiones."}</p>
            <h4>Entrega</h4><ul>{e.deliverables.map((r) => <li key={r}>{r}</li>)}</ul>
            <h4>Skill incluida</h4><p>{e.skillName}</p>
            <h4>Permisos</h4><p>Inicialmente solo lectura. {e.writeActions?.length ? "Los cambios (presupuesto, pausas, envíos, publicación) requieren tu autorización." : "No ejecuta acciones externas."}</p></details>
          <p>{missing.length ? <span className="chip warn">Requiere configuración: conectar {missing.map((m) => getToolkit(m.toolkit)?.label).join(", ")}</span> : <span className="chip ok">{aiOn ? "Listo para trabajar" : "Falta configurar la IA"}</span>}</p>
          <form action={hireAction}><input type="hidden" name="template" value={e.key} /><input type="hidden" name="next" value={`/construir?paso=3${sp.dep ? "&dep=" + sp.dep : ""}`} />
            <button disabled={hired.has(e.key)}>{hired.has(e.key) ? "Ya en tu oficina" : "Agregar a mi oficina"}</button></form></div>);
      })}</div></>}
    {paso === 4 && <p><Link className="btn" href="/organigrama">Ver el organigrama de mi oficina</Link> <Link className="btn ghost" href="/oficina">Ir al panel de dirección</Link></p>}
  </>);
}
