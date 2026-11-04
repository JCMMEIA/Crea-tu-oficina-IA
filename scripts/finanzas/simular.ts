// SIMULACIÓN FINANCIERA (no es una medición). Todos los supuestos están en SUPUESTOS y se pueden cambiar; los precios de modelos NO están verificados (openrouter.ai no se pudo consultar desde este entorno).
//   npx tsx scripts/finanzas/simular.ts   → escribe docs/ia-router/FINANZAS_TABLAS.md
import fs from "node:fs";

export const SUPUESTOS = {
  fxMxnPorUsd: 18.5,                                   // HIPÓTESIS: tipo de cambio; verificar el vigente
  ivaIncluido: true, iva: 0.16,                        // HIPÓTESIS: el precio al cliente incluye IVA
  planes: { starter: { precioMxn: 499, tokens: 500_000, mezcla: 0.6 }, pro: { precioMxn: 999, tokens: 2_000_000, mezcla: 0.3 }, business: { precioMxn: 2499, tokens: 5_000_000, mezcla: 0.1 } } as Record<string, { precioMxn: number; tokens: number; mezcla: number }>, // PROVISIONAL, NO PUBLICADO
  utilizacion: { bajo: 0.25, medio: 0.5, alto: 0.9 },  // fracción de la cuota que realmente se consume
  mezclaEntrada: 0.8,                                  // 80 % tokens de entrada / 20 % de salida
  precios: { premium: { in: 3, out: 15 }, economico: { in: 0.3, out: 1.2 }, gratis: { in: 0, out: 0 } }, // USD por millón. PLACEHOLDERS no verificados (premium = valor usado en pruebas; económico = hipótesis)
  mezclaRouter: { gratis: 0.05, economico: 0.6, premium: 0.35 }, // % de TOKENS por categoría con el router (los gratuitos son pocos: casi toda tarea lleva datos internos)
  sobrecostoReintentos: 0.08,                          // HIPÓTESIS: 8 % de tokens extra por respuestas inválidas y fallbacks
  comisionOpenRouterSobreModelos: 0.055,               // RECORDATORIO NO VERIFICADO: comisión de OpenRouter al comprar créditos; confirmar en su página de precios
  stripe: { pct: 0.036, fijoMxn: 3 },                  // HIPÓTESIS: comisión típica en México; confirmar
  afiliado: { tasa: 0.2, proporcionReferidos: 0.3, fraccionEnVentana12m: 0.6 },
  infraestructuraUsdMes: { 10: 25, 100: 40, 1000: 250, 10000: 1800 } as Record<number, number>,   // HIPÓTESIS por escala (VPS, base de datos, correo, respaldos, monitoreo)
  soporteUsdPorClienteMes: 0.8, serviciosExternosUsdPorClienteMes: 0.1,                              // HIPÓTESIS
};
const S = SUPUESTOS; const mxn = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`; const usd = (n: number) => `US$${n.toFixed(2)}`; const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const costoPorToken = (p: { in: number; out: number }) => (S.mezclaEntrada * p.in + (1 - S.mezclaEntrada) * p.out) / 1e6;
export const costoPremium = costoPorToken(S.precios.premium);
export const costoRouter = (S.mezclaRouter.gratis * costoPorToken(S.precios.gratis) + S.mezclaRouter.economico * costoPorToken(S.precios.economico) + S.mezclaRouter.premium * costoPorToken(S.precios.premium)) * (1 + S.comisionOpenRouterSobreModelos);

export function escenario(clientes: number, util: number) {
  let ingresoBruto = 0, tokens = 0; for (const [, p] of Object.entries(S.planes)) { const n = clientes * p.mezcla; ingresoBruto += n * p.precioMxn; tokens += n * p.tokens * util; }
  const iva = S.ivaIncluido ? ingresoBruto - ingresoBruto / (1 + S.iva) : 0; const ingresoNeto = ingresoBruto - iva; const fx = S.fxMxnPorUsd;
  const tokensConReintentos = tokens * (1 + S.sobrecostoReintentos);
  const iaPremium = tokensConReintentos * costoPremium * fx, iaRouter = tokensConReintentos * costoRouter * fx;
  const stripe = ingresoBruto * S.stripe.pct + clientes * S.stripe.fijoMxn; const afiliado = ingresoNeto * S.afiliado.proporcionReferidos * S.afiliado.fraccionEnVentana12m * S.afiliado.tasa;
  const infra = (S.infraestructuraUsdMes[clientes] ?? 0) * fx, soporte = clientes * S.soporteUsdPorClienteMes * fx, ext = clientes * S.serviciosExternosUsdPorClienteMes * fx;
  const fila = (ia: number) => { const costos = ia + stripe + afiliado + infra + soporte + ext; return { ia, costos, margen: ingresoNeto - costos, pct: (ingresoNeto - costos) / ingresoNeto }; };
  return { clientes, util, ingresoBruto, iva, ingresoNeto, tokens, premium: fila(iaPremium), router: fila(iaRouter), stripe, afiliado, infra, soporte, ext };
}
export function cuotaPlan(plan: string, util = 1) { const p = S.planes[plan]; const neto = p.precioMxn / (S.ivaIncluido ? 1 + S.iva : 1); const iaP = p.tokens * util * costoPremium * S.fxMxnPorUsd, iaR = p.tokens * util * costoRouter * S.fxMxnPorUsd; return { plan, precio: p.precioMxn, neto, iaP, iaR, pctP: iaP / neto, pctR: iaR / neto }; }

if (process.argv[1]?.endsWith("simular.ts")) {
  let md = "<!-- Generado por scripts/finanzas/simular.ts. SIMULACIÓN con supuestos no verificados. -->\n\n";
  md += `## Costo por token (mezcla ${S.mezclaEntrada * 100} % entrada / ${(1 - S.mezclaEntrada) * 100} % salida)\n\n| Categoría | US$ por millón de tokens (mezcla) |\n|---|---|\n| Premium solo | ${usd(costoPremium * 1e6)} |\n| Router (mezcla ${JSON.stringify(S.mezclaRouter)} + comisión ${pct(S.comisionOpenRouterSobreModelos)} + reintentos ${pct(S.sobrecostoReintentos)} aparte) | ${usd(costoRouter * 1e6)} |\n\n`;
  md += "## ¿Son sostenibles las cuotas provisionales? (cliente que usa el 100 % de su cuota)\n\n| Plan | Precio | Ingreso neto (sin IVA) | IA solo premium | % del neto | IA con router | % del neto |\n|---|---|---|---|---|---|---|\n";
  for (const k of Object.keys(S.planes)) { const c = cuotaPlan(k); md += `| ${k} | ${mxn(c.precio)} | ${mxn(c.neto)} | ${mxn(c.iaP)} | ${pct(c.pctP)} | ${mxn(c.iaR)} | ${pct(c.pctR)} |\n`; }
  md += "\n";
  for (const [nombre, u] of Object.entries(S.utilizacion)) {
    md += `## Escenario de uso «${nombre}» (${pct(u)} de la cuota)\n\n| Clientes | Ingreso bruto/mes | Ingreso neto | IA premium | IA router | Ahorro del router | Stripe | Afiliados | Infra | Soporte+servicios | Margen (premium) | Margen (router) | % margen router |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const n of [10, 100, 1000, 10000]) { const e = escenario(n, u); md += `| ${n.toLocaleString("es-MX")} | ${mxn(e.ingresoBruto)} | ${mxn(e.ingresoNeto)} | ${mxn(e.premium.ia)} | ${mxn(e.router.ia)} | ${mxn(e.premium.ia - e.router.ia)} | ${mxn(e.stripe)} | ${mxn(e.afiliado)} | ${mxn(e.infra)} | ${mxn(e.soporte + e.ext)} | ${mxn(e.premium.margen)} | ${mxn(e.router.margen)} | ${pct(e.router.pct)} |\n`; }
    md += "\n";
  }
  fs.writeFileSync("docs/ia-router/FINANZAS_TABLAS.md", md); console.log(md.slice(0, 1400));
}
