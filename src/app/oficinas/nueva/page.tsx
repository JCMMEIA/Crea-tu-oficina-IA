import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Flash, Steps } from "@/lib/ui";
import { INDUSTRIES, getIndustry } from "@/server/agency/industries";
import { SERVICE_CARDS, employeesForServices, getCard, industryDefaults } from "@/server/guide/services";
import { getTemplate, getDepartment } from "@/server/catalog/data";
import { availableRights } from "@/server/commerce/offices";
import { newOfficePlan, purchasesOpen } from "@/server/commerce/gate";
import { formatPrice, planOf, planPriceInfo } from "@/server/agency/plans";
import { newOfficeCheckoutAction, newOfficeWithRightAction } from "../../commerce_actions";

const PASOS = ["Tu negocio", "Qué ofrece", "Tu equipo", "Confirmar"] as const;
type SP = { paso?: string; error?: string; nombre?: string; negocio?: string; servicio?: string | string[]; empleado?: string | string[] };
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
/** Flujo SIN guardar nada hasta confirmar: el estado viaja en la dirección. La oficina se crea solo con un pago confirmado o un derecho disponible. */
export default async function NuevaOficina({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams; const { db, user } = await requireUser(); const paso = Math.min(4, Math.max(1, Number(sp.paso) || 1));
  const nombre = (sp.nombre ?? "").slice(0, 120); const negocio = getIndustry(sp.negocio ?? "") ? sp.negocio! : "";
  const servicios = arr(sp.servicio).filter((s) => getCard(s)); const sel = servicios.length ? servicios : negocio ? industryDefaults(negocio) : [];
  const rec = employeesForServices(sel); const empleados = arr(sp.empleado).filter((k) => getTemplate(k)); const emps = empleados.length ? empleados : rec.map((r) => r.key);
  const rights = await availableRights(db, user.userId, user.email); const gate = await purchasesOpen(db); const price = planPriceInfo(newOfficePlan());
  const hidden = (<><input type="hidden" name="nombre" value={nombre} /><input type="hidden" name="negocio" value={negocio} />{sel.map((s) => <input key={s} type="hidden" name="servicio" value={s} />)}{emps.map((k) => <input key={k} type="hidden" name="empleado" value={k} />)}</>);
  return (<><p><Link href="/oficinas">← Mis oficinas</Link></p><h1>Nueva oficina IA</h1><Steps labels={PASOS} current={paso} /><Flash sp={{ error: sp.error }} />
    {paso === 1 && <form method="get"><input type="hidden" name="paso" value="2" /><h2>¿Cómo se llamará y a qué se dedica?</h2>
      <label htmlFor="n">Nombre de la oficina</label><input id="n" name="nombre" defaultValue={nombre} required maxLength={120} placeholder="Ej.: Mi tienda de ropa" data-testid="nueva-nombre" />
      <label htmlFor="g">Tipo de negocio</label><select id="g" name="negocio" required defaultValue={negocio} data-testid="nueva-negocio"><option value="" disabled>Elige uno</option>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select>
      <p><button className="big" data-testid="nueva-next">Siguiente →</button></p></form>}
    {paso === 2 && <form method="get"><input type="hidden" name="paso" value="3" /><input type="hidden" name="nombre" value={nombre} /><input type="hidden" name="negocio" value={negocio} /><h2>¿Qué quieres que haga tu oficina?</h2><p className="muted">Marcamos lo recomendado para {getIndustry(negocio)?.name ?? "tu negocio"}. Cambia lo que quieras.</p>
      <div className="pick">{SERVICE_CARDS.map((c) => <label className="card" key={c.id}><input type="checkbox" name="servicio" value={c.id} defaultChecked={sel.includes(c.id)} data-testid={`nueva-servicio-${c.id}`} /><span className="ic" aria-hidden="true">{c.icon}</span><b>{c.title}</b><span className="muted">{c.plain}</span></label>)}</div>
      <p className="row"><Link className="btn ghost" href={`?paso=1&nombre=${encodeURIComponent(nombre)}&negocio=${negocio}`}>← Atrás</Link><button className="big" data-testid="nueva-next">Siguiente →</button></p></form>}
    {paso === 3 && <form method="get"><input type="hidden" name="paso" value="4" /><input type="hidden" name="nombre" value={nombre} /><input type="hidden" name="negocio" value={negocio} />{sel.map((s) => <input key={s} type="hidden" name="servicio" value={s} />)}<h2>Tu equipo de empleados IA</h2><p className="muted">Cada empleado queda en su departamento. Puedes agregar más después.</p>
      <div className="pick">{rec.map((p) => { const t = getTemplate(p.key)!; return (<label className="card" key={p.key}><input type="checkbox" name="empleado" value={p.key} defaultChecked={emps.includes(p.key)} data-testid={`nueva-empleado-${p.key}`} /><b>{p.name}</b><span className="muted">Departamento: {getDepartment(t.department)?.name ?? t.department}</span><span>{p.que}</span></label>); })}</div>
      <p className="row"><Link className="btn ghost" href={`?paso=2&nombre=${encodeURIComponent(nombre)}&negocio=${negocio}`}>← Atrás</Link><button className="big" data-testid="nueva-next">Revisar y confirmar →</button></p></form>}
    {paso === 4 && <div className="card"><h2>Confirma tu nueva oficina</h2>
      <p><b>{nombre || "Mi oficina IA"}</b> · {getIndustry(negocio)?.name ?? "Negocio sin definir"}</p><p className="muted">{emps.length} empleado(s) IA · plan {planOf(newOfficePlan()).label}</p>
      {rights.length > 0 ? (<><p className="tip" role="status" data-testid="usar-derecho">Tienes <b>{rights.length}</b> derecho(s) de creación disponible(s): esta oficina <b>no tiene costo nuevo</b>.</p>
          <form action={newOfficeWithRightAction}>{hidden}<p><button className="big" data-testid="crear-con-derecho">Crear mi oficina</button></p></form></>)
        : (<><p style={{ fontSize: "1.4rem" }} data-testid="precio-nueva"><b>{formatPrice(price)}</b></p><p className="muted">Es una suscripción <b>independiente</b> de tus otras oficinas. Se cobra al confirmar el pago; la oficina se crea cuando el pago queda confirmado. Puedes cancelarla cuando quieras al final del periodo.</p>
          {gate.open ? <form action={newOfficeCheckoutAction}>{hidden}<p><button className="big" data-testid="pagar-nueva">Pagar y crear mi oficina</button></p></form>
            : <p className="tip" role="note" data-testid="compras-cerradas">Las compras todavía no están abiertas. Cuando lo estén podrás crear tu oficina aquí.</p>}</>)}
      <p><Link href={`?paso=3&nombre=${encodeURIComponent(nombre)}&negocio=${negocio}${sel.map((s) => `&servicio=${s}`).join("")}`}>← Atrás</Link></p></div>}</>);
}
