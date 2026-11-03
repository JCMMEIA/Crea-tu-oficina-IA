import { requireAgency } from "@/lib/session";
import { Flash, Tip, EmptyState } from "@/lib/ui";
import { listClients } from "@/server/agency";
import { enterClientAction } from "../../../agency_actions";
import { SIMPLE_APPS } from "@/server/connectors/simple";

export const metadata = { title: "Conecta tus aplicaciones" };
export default async function Conexiones({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams; const { db, agency } = await requireAgency(); const clients = await listClients(db, agency);
  return (<><h1>Conecta tus aplicaciones</h1><p className="lead">Las aplicaciones (WhatsApp, Instagram, Shopify, Gmail…) se conectan en la cuenta de <b>cada cliente</b>, con su permiso. Elige de quién.</p><Flash sp={sp} />
    <Tip>Conectar una aplicación es opcional: tus empleados ya pueden trabajar con lo que les cuentes. Conectarla les deja ver datos reales, siempre con permiso.</Tip>
    <p className="muted">Disponibles: {SIMPLE_APPS.map((a) => `${a.icon} ${a.title}`).join(" · ")}</p>
    {clients.length ? <div className="grid">{clients.map((c: any) => <div className="card" key={c.id}><h3>{c.is_demo ? "🧪 Oficina de práctica" : c.name}</h3><p className="muted">{c.employees} empleado(s)</p>
      <form action={enterClientAction}><input type="hidden" name="companyId" value={c.id} /><input type="hidden" name="next" value="/conexiones" /><button className="big" style={{ width: "100%" }} data-testid={`conectar-${c.id}`}>Conectar aplicaciones</button></form></div>)}</div>
      : <EmptyState icon="🔌" title="Primero agrega un cliente" text="Las aplicaciones se conectan por cliente. Agrega el primero y vuelve aquí." href="/agencia/clientes" cta="Agregar cliente" />}</>);
}
