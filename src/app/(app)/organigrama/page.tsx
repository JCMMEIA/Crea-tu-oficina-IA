import Link from "next/link";
import { requireActor } from "@/lib/session";
import { Empty } from "@/lib/ui";
import { listOffice } from "@/server/catalog/office";
export default async function Organigrama() {
  const { db, actor } = await requireActor();
  const office = await listOffice(db, actor); const co = (await db.query("SELECT name FROM companies WHERE id=$1", [actor.companyId]))[0];
  return (<><h1>Organigrama</h1>{!office.length ? <Empty>Aún no has contratado empleados.</Empty> :
    <div className="org"><div className="node"><b>{co.name}</b><div className="muted">Propietario</div></div>
      <div className="lvl">{office.map((d) => (<div key={d.id} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}><div className="node" style={{ borderColor: "var(--brand)" }}><b>{d.name}</b></div>
        {d.employees.map((e: any) => <Link key={e.id} href={`/empleados/${e.id}`} className="node" style={{ color: "inherit", opacity: e.status === "active" ? 1 : 0.55 }}>{e.name}<div className="muted">{e.status !== "active" ? "en pausa" : e.role_title}</div></Link>)}</div>))}</div></div>}</>);
}
