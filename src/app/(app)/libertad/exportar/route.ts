import { NextResponse } from "next/server";
import { requireActor } from "@/lib/session";
import { exportAll, getPlan, resultsOf } from "@/server/libertad/service";
import { ORIGIN_LABEL, actionPlan, goalsFrom, mxn, pct } from "@/features/libertad/plan";

export const dynamic = "force-dynamic";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export async function GET(req: Request) {
  const { db, actor } = await requireActor(); const fmt = new URL(req.url).searchParams.get("formato") === "json" ? "json" : "html";
  let plan; try { plan = await getPlan(db, actor); } catch { return new NextResponse("No disponible.", { status: 403 }); }
  if (!plan) return new NextResponse("Aún no tienes un plan.", { status: 404 });
  const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" };
  if (fmt === "json") return new NextResponse(JSON.stringify(await exportAll(db, actor), null, 1), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="mi-plan-de-libertad.json"' } });
  const r = resultsOf(plan); const a = plan.data.answers; const goals = goalsFrom(a, r), acts = actionPlan(r, a);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Mi Mapa de Libertad</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1c1c1a}h1{margin-bottom:0}h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #eee;padding:6px;text-align:left}.m{color:#666;font-size:.85rem}.n{border:1px solid #d9b36c;background:#fff8e6;padding:10px;border-radius:8px}@media print{body{margin:0}.noprint{display:none}}</style></head><body>
<p class="noprint"><button onclick="window.print()">Imprimir o guardar como PDF</button></p><h1>Mi Mapa de Libertad</h1><p class="m">Generado el ${esc(new Date().toLocaleDateString("es-MX"))} · Documento personal y confidencial · Cantidades en MXN netos.</p>
<p class="n"><b>Importante:</b> herramienta de orientación, no asesoría financiera, fiscal ni legal. Los escenarios son ilustrativos y no garantizan resultados. Cálculos con fórmulas fijas a partir de tus respuestas y supuestos editables.</p>
<h2>Mi definición de libertad</h2><p>${esc(a.c_libre ?? "—")}</p><h2>Mis números (${esc(ORIGIN_LABEL.calculo)})</h2><table><tr><td>Costo de mi vida hoy</td><td>${esc(mxn(r.currentMonthly.value))}</td></tr><tr><td>Costo de la vida que quiero</td><td>${esc(mxn(r.desiredMonthly.value))}</td></tr><tr><td>Ingreso neto</td><td>${esc(mxn(r.incomeMonthly.value))}</td></tr><tr><td>Flujo mensual</td><td>${esc(mxn(r.freeCashFlow.value))}</td></tr><tr><td>Brecha</td><td>${esc(mxn(r.incomeGap.value))}</td></tr><tr><td>Fondo de emergencia</td><td>${r.emergency.fundMonths.value === null ? "—" : esc(r.emergency.fundMonths.value.toFixed(1))} meses (referencia: ${r.emergency.recommendedMonths})</td></tr><tr><td>Ingreso que no depende de mis horas</td><td>${esc(mxn(r.incomeSustainable.value))} (${esc(pct(r.sustainableCoverage.desired.value))} de la vida deseada)</td></tr><tr><td>Horas por semana: hoy / deseadas</td><td>${esc(r.time.hoursNow.value ?? "—")} / ${esc(r.time.hoursDesired.value ?? "—")}</td></tr></table>
<h2>Escenarios de independencia (ilustrativos)</h2><table><tr><th>Tasa de retiro</th><th>Patrimonio necesario</th><th>Avance</th></tr>${r.withdrawal.map((w) => `<tr><td>${(w.rate * 100).toFixed(1)}%</td><td>${esc(mxn(w.goalNet.value))}</td><td>${w.progress.value === null ? "—" : esc(pct(w.progress.value))}</td></tr>`).join("")}</table>
<h2>Metas</h2><ul>${goals.map((g) => `<li>${esc(g.text)} <span class="m">(${esc(ORIGIN_LABEL[g.origin])})</span></li>`).join("")}</ul><h2>Plan de acción (recomendaciones generales)</h2>${([30, 90, 365] as const).map((w) => `<h3>${w} días</h3><ul>${acts.filter((x) => x.when === w).map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>`).join("")}
<h2>Supuestos y confianza</h2><p>Inflación ${esc(pct(r.assumptions.inflation))} · tasas de retiro ${esc(r.assumptions.withdrawalRates.map((x) => (x * 100).toFixed(1) + "%").join(", "))} · confianza en los datos: ${esc(r.confidence.level)}. ${esc(r.confidence.note)}</p></body></html>`;
  return new NextResponse(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
