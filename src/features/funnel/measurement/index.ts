/** Medición de conversiones: visitas → clics de compra → pagos iniciados → pagos confirmados → oficinas activadas → costo de adquisición.
 *  La consulta vive en el servidor (reutilizada por /admin/conversion); aquí se expone para que el módulo del funnel sea autocontenido. */
export { conversionFunnel, addAdSpend, recentOrders } from "@/server/commerce/funnel";
export { FUNNEL_EVENTS, BUY_CTA, BUY_SPOTS } from "../tracking/events";
