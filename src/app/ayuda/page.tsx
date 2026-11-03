import Link from "next/link";
import { currentActor } from "@/lib/session";
import { getProvider } from "@/server/models";
import { channelStatus } from "@/server/messaging/runtime";

export const metadata = { title: "Ayuda" };
export const dynamic = "force-dynamic";
export default async function Ayuda() {
  const { actor, agency } = await currentActor(); const home = agency ? "/agencia" : actor ? "/oficina" : "/";
  const ai = !!getProvider(); const ch = channelStatus();
  const steps: [string, string, string][] = [["1", "Crea tu negocio", "Ponle nombre y elige qué quieres ofrecer."], ["2", "Elige a tus empleados", "Cada uno hace un trabajo: anuncios, mensajes, inventarios…"], ["3", "Enséñales", "Cuéntales cómo quieres que trabajen, con tus palabras."], ["4", "Pídeles una tarea", "Escribe qué necesitas. Ellos trabajan y te muestran el resultado."], ["5", "Tú decides", "Antes de publicar, enviar o cambiar algo importante, te piden permiso."]];
  return (<div className="land" style={{ maxWidth: 820 }}><header><b>❓ Ayuda</b><Link href={home}>← Volver</Link></header>
    <h1>¿Cómo funciona? En 5 pasos</h1><div className="cols">{steps.map(([n, t, d]) => <div className="card" key={n}><span className="num">{n}</span><h3>{t}</h3><p className="muted">{d}</p></div>)}</div>
    <div className="row" style={{ margin: "14px 0" }}>{!actor && !agency ? <Link className="btn big" href="/registro">Crear mi negocio</Link> : <Link className="btn big" href={agency ? "/empezar" : "/agregar-empleado"}>{agency ? "Hacer la prueba guiada" : "Agregar un empleado"}</Link>}</div>
    <h2>Lo que debes saber</h2>
    <details className="card" open><summary><b>¿Puedo probar sin conectar nada?</b></summary><p>Sí. La «prueba guiada» usa un negocio inventado (Café Luna). Si la inteligencia artificial no está activada, verás un ejemplo ilustrativo claramente marcado: no es trabajo real.</p></details>
    <details className="card"><summary><b>¿Se publica o se envía algo sin mi permiso?</b></summary><p>No. Publicar, enviar mensajes, cambiar precios o gastar dinero siempre esperan tu permiso. Lo verás en «Por aprobar».</p></details>
    <details className="card"><summary><b>¿Qué significa «Necesita que la activen»?</b></summary><p>Que quien instaló la plataforma todavía no activó esa parte. En «Conecta tus aplicaciones» te explicamos los pasos, uno por uno. No hace falta que tú los hagas.</p></details>
    <details className="card"><summary><b>¿Mis clientes ven los datos de otros clientes?</b></summary><p>No. Cada cliente tiene su propia oficina, separada. Y otras agencias no pueden ver la tuya.</p></details>
    <details className="card"><summary><b>¿Cuánto cuesta?</b></summary><p>Por ahora no se cobra nada. Si algún día se cobra, te lo diremos antes y nunca sin tu permiso. El uso de inteligencia artificial sí tiene un costo real cuando se activa; por eso puedes ponerle un tope mensual a cada cliente.</p></details>
    <h2>Estado de tu instalación</h2>
    <div className="card"><p>{ai ? "✅" : "🔧"} Inteligencia artificial: <b>{ai ? "activada" : "todavía no está activada"}</b>{ai ? "" : " (tus empleados practican con ejemplos hasta que se active)"}</p>
      <p>{ch.telegram ? "✅" : "🔧"} Telegram: <b>{ch.telegram ? "lista para conectar" : "necesita que la activen"}</b></p><p>{ch.whatsapp ? "✅" : "🔧"} WhatsApp: <b>{ch.whatsapp ? "lista para conectar" : "necesita que la activen"}</b></p>
      <p className="muted">Quien instaló la plataforma encuentra los pasos en los documentos «GUIA_CLAUDE_Y_COMPOSIO» y «MENSAJERIA».</p></div>
    <h2>Volver a ver la guía</h2><p>Toca el botón <b>❓ Ayuda</b> (abajo a la derecha) en cualquier pantalla para abrir la guía rápida.</p></div>);
}
