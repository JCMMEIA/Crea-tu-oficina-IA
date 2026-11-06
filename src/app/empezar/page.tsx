import Link from "next/link";
import { requireAgency } from "@/lib/session";
import { Flash, Steps, Tip, Help } from "@/lib/ui";
import { STEPS, getOnboarding, ensureDemoOffice } from "@/server/onboarding";
import { getAgency } from "@/server/agency";
import { SERVICE_CARDS, employeesForServices, industryDefaults } from "@/server/guide/services";
import { INDUSTRIES } from "@/server/agency/industries";
import { getTemplate } from "@/server/catalog/data";
import { companyScene } from "@/server/office3d";
import { actAs } from "@/server/auth";
import { practiceExample } from "@/server/guide/practice";
import { getProvider } from "@/server/models";
import { getToolkit } from "@/server/connectors/catalog";
import { PersonalizeOffice } from "@/components/office3d/PersonalizeOffice";
import { getOfficeDesign } from "@/server/office3d/design_store";
import { OfficeViewer } from "@/components/office3d/OfficeViewer";
import { nameStep, servicesStep, employeesStep, identityStep, officeStep, practiceStep, finishStep } from "./actions";
import { StatusChip } from "@/lib/ui";

export const metadata = { title: "Vamos a crear tu negocio" };
export const dynamic = "force-dynamic";
const COLORS = [["#4f46e5", "Azul"], ["#0a7d5a", "Verde"], ["#d9480f", "Naranja"], ["#c2255c", "Rosa"], ["#7048e8", "Morado"], ["#1c1c1a", "Negro"]] as const;
const STYLES = [["moderno", "Moderno", "Limpio y neutro", "#eceae4"], ["calido", "Cálido", "Tonos de madera y arena", "#f0e3cf"], ["fresco", "Fresco", "Tonos claros y azulados", "#e2eef0"]] as const;

export default async function Empezar({ searchParams }: { searchParams: Promise<{ paso?: string; error?: string; ok?: string; emp?: string; tarea?: string; ejemplo?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency();
  const ob = await getOnboarding(db, agency); const ag = await getAgency(db, agency);
  const paso = Math.min(6, Math.max(1, Number(sp.paso) || ob.step || 1));
  const demoId = await ensureDemoOffice(db, agency);
  const mine = await db.query("SELECT id,name,role_title,template_key,status FROM employees WHERE company_id=$1 ORDER BY created_at", [demoId]);
  const hiredKeys = new Set(mine.map((m) => m.template_key as string));
  return (<div className="land" style={{ maxWidth: 880 }}>
    <header><b>🏛️ Vamos a crear tu negocio</b><Link href="/agencia" data-testid="skip-wizard">Omitir por ahora</Link></header>
    <Steps labels={STEPS} current={paso} />
    <Flash sp={sp} />

    {paso === 1 && <form action={nameStep}><h1>¿Cómo se llamará tu negocio?</h1><p className="lead">Elige el nombre que verán tus clientes. Podrás cambiarlo cuando quieras.</p>
      <label htmlFor="name">Nombre de tu negocio</label><Help>Por ejemplo: «Estudio Nova» o «Marketing con Ana».</Help>
      <input id="name" name="name" defaultValue={ag.name} required maxLength={120} style={{ fontSize: "1.2rem" }} autoFocus />
      <label htmlFor="biz">¿A qué se dedica tu negocio?</label><Help>Con esto te sugerimos la plantilla, los servicios y los empleados. Puedes cambiarlos después.</Help>
      <select id="biz" name="negocio" defaultValue={ag.business_type ?? ""} data-testid="wizard-negocio"><option value="">Prefiero elegir yo mismo después</option>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}</select>
      <p><button className="big" data-testid="next">Siguiente →</button></p></form>}

    {paso === 2 && <form action={servicesStep}><h1>¿Qué quieres ofrecer a otras empresas?</h1><p className="lead">Toca las tarjetas que te interesen. Puedes elegir varias.</p>
      <div className="pick">{SERVICE_CARDS.map((c) => <label className="card" key={c.id}><input type="checkbox" name="servicio" value={c.id} defaultChecked={(ob.services.length ? ob.services : ag.business_type ? industryDefaults(ag.business_type) : []).includes(c.id)} data-testid={`servicio-${c.id}`} /><span className="ic" aria-hidden="true">{c.icon}</span><b>{c.title}</b><span className="muted">{c.plain}</span><span className="muted" style={{ fontSize: ".85rem" }}>Ejemplo: {c.example}</span></label>)}</div>
      <Tip>Elegir no cuesta nada ni publica nada: solo prepara tu lista de servicios.</Tip>
      <p className="row"><Link className="btn ghost" href="/empezar?paso=1">← Atrás</Link><button className="big" data-testid="next">Siguiente →</button></p></form>}

    {paso === 3 && (() => { const rec = employeesForServices(ob.services.length ? ob.services : ["anuncios"]); return (<form action={employeesStep}><h1>Elige a tus empleados</h1><p className="lead">Te recomendamos estos según lo que quieres ofrecer. Entrarán a tu <b>oficina de práctica</b>, donde puedes probarlos sin riesgo.</p>
      <div className="pick">{rec.map((p) => <label className="card" key={p.key}><input type="checkbox" name="empleado" value={p.key} defaultChecked data-testid={`empleado-${p.key}`} /><span className="ic" aria-hidden="true">🧑‍💼</span><b>{p.name}</b>
        <span><b>Qué hace:</b> {p.que}</span><span><b>Para qué sirve:</b> {p.paraQue}</span><span><b>Qué necesita:</b> {p.necesita}</span><span><b>Qué entrega:</b> {p.entrega}</span>
        {p.needsApps.length > 0 && <span className="muted">Después podrás conectarle: {p.needsApps.map((a) => getToolkit(a)?.label ?? a).join(", ")}.</span>}{hiredKeys.has(p.key) && <span className="state ok">✅ Ya está en tu oficina</span>}</label>)}</div>
      <p className="row"><Link className="btn ghost" href="/empezar?paso=2">← Atrás</Link><button className="big" data-testid="next">Agregar a mi oficina →</button></p></form>); })()}

    {paso === 4 && <form action={identityStep} encType="multipart/form-data"><h1>Haz que se vea como tú</h1><p className="lead">Elige tu nombre, tus colores y un estilo. Es lo que verán tus clientes.</p>
      <input type="hidden" name="currentLogo" value={typeof ag.brand?.logo === "string" && ag.brand.logo.startsWith("data:") ? ag.brand.logo : ""} />
      <label htmlFor="n4">Nombre</label><input id="n4" name="name" defaultValue={ag.name} required maxLength={120} />
      <h3 style={{ marginTop: 18 }}>Color principal</h3><div className="pick" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))" }}>
        {COLORS.map(([c, n]) => <label className="card" key={c}><input type="radio" name="color" value={c} defaultChecked={(ag.brand?.primaryColor ?? "#4f46e5") === c} /><span style={{ background: c, width: 34, height: 34, borderRadius: "50%", display: "block" }} aria-hidden="true" /><b>{n}</b></label>)}
        <label className="card"><input type="radio" name="color" value="custom" /><input type="color" name="colorCustom" defaultValue="#4f46e5" aria-label="Elegir otro color" style={{ width: 44, height: 34, padding: 0 }} /><b>Otro</b></label></div>
      <h3 style={{ marginTop: 18 }}>Tono de colores</h3><div className="pick">{STYLES.map(([k, n, d, c]) => <label className="card" key={k}><input type="radio" name="estilo" value={k} defaultChecked={(ag.brand?.style ?? "moderno") === k} data-testid={`estilo-${k}`} /><span style={{ background: c, height: 38, borderRadius: 8, border: "1px solid var(--line)", display: "block" }} aria-hidden="true" /><b>{n}</b><span className="muted">{d}</span></label>)}</div>
      <div style={{ marginTop: 18 }}><PersonalizeOffice mode="embedded" scene={await companyScene(db, await actAs(db, agency, demoId))} initial={await getOfficeDesign(db, agency)} legacyStyle={ag.brand?.style ?? "moderno"} /></div>
      <label htmlFor="logo">Tu logo (opcional)</label><Help>Una imagen PNG, JPG o WEBP de hasta 150 KB. Si no tienes, déjalo vacío.</Help><input id="logo" type="file" name="logoFile" accept="image/png,image/jpeg,image/webp" />
      <p className="row"><Link className="btn ghost" href="/empezar?paso=3">← Atrás</Link><button className="big" data-testid="next">Guardar y ver mi oficina →</button></p></form>}

    {paso === 5 && await (async () => { const scene = await companyScene(db, await actAs(db, agency, demoId)); return (<div><h1>Conoce tu oficina</h1><p className="lead">Así se ve tu oficina con tus empleados. Puedes girarla, acercarla y tocar a cada empleado para conocerlo.</p>
      <OfficeViewer scene={scene} testId="office-wizard" height={440} emptyCta={{ href: "/empezar?paso=3", label: "Elegir empleados" }} />
      <form action={officeStep}><p className="row"><Link className="btn ghost" href="/empezar?paso=4">← Atrás</Link><button className="big" data-testid="next">¡Quiero probarla! →</button></p></form></div>); })()}

    {paso === 6 && await (async () => {
      const chosen = sp.emp && mine.find((m) => m.id === sp.emp);
      const tarea = sp.tarea ? (await db.query("SELECT t.status,t.result,t.error FROM tasks t JOIN companies c ON c.id=t.company_id WHERE t.id=$1 AND c.id=$2", [sp.tarea, demoId]))[0] : null;
      const ex = chosen ? practiceExample(chosen.template_key ?? "") : null;
      return (<div><h1>Haz tu primera prueba</h1><p className="lead">Elige un empleado y mira cómo trabaja. Es una <b>práctica con datos inventados</b> del negocio «Café Luna»: no usa cuentas reales ni cuesta dinero.</p>
        {!chosen && <form action={practiceStep}><div className="pick">{mine.map((m, i) => <label className="card" key={m.id}><input type="radio" name="empleado" value={m.id} defaultChecked={i === 0} data-testid={`prueba-${m.template_key}`} /><span className="ic" aria-hidden="true">🧑‍💼</span><b>{m.name}</b><span className="muted">Pedido de ejemplo: {practiceExample(m.template_key ?? "").pedido}</span></label>)}</div>
          {!getProvider() && <Tip icon="ℹ️">La inteligencia artificial todavía no está activada en esta instalación, así que verás un <b>ejemplo ilustrativo</b> escrito por nosotros. Cuando se active, esta misma prueba la hará un empleado de verdad.</Tip>}
          <p className="row"><Link className="btn ghost" href="/empezar?paso=5">← Atrás</Link><button className="big" data-testid="practice">▶ Hacer la prueba</button></p></form>}
        {chosen && ex && <div data-testid="practice-result"><div className="card"><h3>📝 Lo que pediste</h3><p>{ex.pedido}</p><p className="muted">Negocio inventado: {ex.negocio}</p></div>
          {tarea ? (<div className="card" style={{ marginTop: 12 }}><h3>🧑‍💼 Lo que hizo {chosen.name} <StatusChip s={tarea.status} /></h3>{tarea.result ? <pre>{tarea.result}</pre> : <p>{tarea.error ? "No pudo terminar: " + tarea.error : "Todavía trabajando…"}</p>}<div className="notice ok">Resultado real de la inteligencia artificial, con datos inventados de práctica.</div></div>)
            : (<div className="card" style={{ marginTop: 12, borderColor: "var(--warn)" }}><h3>🧑‍💼 Así se vería lo que entrega {chosen.name}</h3><pre>{ex.entrega}</pre><div className="notice" data-testid="demo-label">🧪 Ejemplo ilustrativo escrito por nosotros con datos inventados. No lo hizo una inteligencia artificial ni es trabajo real.</div></div>)}
          <Tip>En el trabajo de verdad, antes de publicar o enviar algo, siempre te pedirán permiso.</Tip>
          <form action={finishStep} className="row"><button className="big" data-testid="finish">¡Terminé! Ir a mi oficina</button><button className="ghost" name="next" value="cliente">Agregar mi primer cliente</button><Link className="btn ghost" href="/empezar?paso=6">Probar con otro empleado</Link></form></div>}
      </div>); })()}
  </div>);
}
