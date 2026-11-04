"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";

export interface DemoIndustry { key: string; name: string; services: string[] }
export interface DemoService { id: string; title: string; plain: string; employees: { key: string; name: string; department: string }[] }
/** Simulación local: no envía nada, no guarda nada, no abre pagos. Solo muestra cómo se arma una oficina. */
export function DemoNewOffice({ industries, services, price }: { industries: DemoIndustry[]; services: DemoService[]; price: string }) {
  const [name, setName] = useState(""); const [biz, setBiz] = useState(""); const [chosen, setChosen] = useState<string[] | null>(null); const [off, setOff] = useState<string[]>([]);
  const sel = chosen ?? industries.find((i) => i.key === biz)?.services ?? [];
  const emps = useMemo(() => { const m = new Map<string, { key: string; name: string; department: string }>(); sel.forEach((id) => services.find((s) => s.id === id)?.employees.forEach((e) => m.set(e.key, e))); return [...m.values()].filter((e) => !off.includes(e.key)); }, [sel, services, off]);
  const depts = [...new Set(emps.map((e) => e.department))];
  const toggle = (id: string) => setChosen(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (<div className="panel-grid" data-testid="demo-nueva">
    <div className="card"><h2>1. Tu negocio</h2>
      <label htmlFor="dn">Nombre de la oficina</label><input id="dn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Mi tienda de ropa" maxLength={60} />
      <label htmlFor="db">Tipo de negocio</label><select id="db" value={biz} onChange={(e) => { setBiz(e.target.value); setChosen(null); setOff([]); }} data-testid="demo-negocio"><option value="">Elige uno</option>{industries.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select>
      <h2 style={{ marginTop: 20 }}>2. Qué quieres que haga</h2><p className="muted" style={{ marginTop: 0 }}>{biz ? "Marcamos lo recomendado; cámbialo si quieres." : "Elige un tipo de negocio para ver lo recomendado."}</p>
      <div className="row" style={{ gap: 8 }} role="group" aria-label="Servicios">{services.map((s) => <button key={s.id} type="button" className={sel.includes(s.id) ? "" : "ghost"} aria-pressed={sel.includes(s.id)} onClick={() => toggle(s.id)} title={s.plain} style={{ minHeight: 40 }}>{sel.includes(s.id) && <Icon name="check" size={16} />}{s.title}</button>)}</div></div>
    <div className="card"><h2>3. Tu equipo</h2>{emps.length ? <>{depts.map((d) => <div key={d} style={{ marginBottom: 12 }}><b style={{ fontSize: ".82rem", color: "var(--muted)" }}>{d}</b>{emps.filter((e) => e.department === d).map((e) => <div key={e.key} className="office-row" style={{ marginTop: 6 }}><span className="icon-box" style={{ width: 36, height: 36 }}><Icon name="user" size={18} /></span><span className="grow"><b>{e.name}</b></span><button type="button" className="ghost" style={{ minHeight: 34, padding: "0 10px" }} onClick={() => setOff([...off, e.key])} aria-label={`Quitar ${e.name}`}>Quitar</button></div>)}</div>)}</> : <p className="muted">Aún no hay empleados: elige un negocio y servicios.</p>}
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
      <p style={{ margin: 0 }}><b>{name || "Mi oficina IA"}</b> · {emps.length} empleado(s) · {depts.length} departamento(s)</p>
      <p style={{ fontSize: "1.3rem", margin: "8px 0" }}><b>{price}</b></p>
      <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()} data-testid="demo-confirmar" style={{ width: "100%" }}>Pagar y crear mi oficina</button>
      <p className="muted" role="note" style={{ fontSize: ".82rem" }}>En la demostración no se crea ninguna oficina ni se cobra. Así se ve el paso final; en tu panel real este botón abre el pago seguro.</p></div></div>);
}
