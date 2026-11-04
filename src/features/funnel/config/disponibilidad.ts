/**
 * ÚNICO lugar donde se declara qué funciones están disponibles. La landing lee de aquí para etiquetar cada cosa («Disponible», «En revisión», «Próximamente»)
 * y NUNCA anuncia como disponible lo que no lo está. Cuando una función se fusione y se verifique con la IA real, cambia su estado aquí y la landing se actualiza sola.
 *   disponible   → está en la aplicación publicada y verificada.
 *   en_revision  → construida en una rama (PR) y probada con IA simulada; falta fusionar y verificar con la IA real.
 *   proximamente → solo diseño/demostración conceptual.
 */
export type Estado = "disponible" | "en_revision" | "proximamente";
export const ESTADO_LABEL: Record<Estado, string> = { disponible: "Disponible", en_revision: "En revisión", proximamente: "Próximamente" };
export const FEATURES: Record<string, Estado> = {
  oficinas: "disponible",            // oficinas propias, panel, empleados, aprobaciones (en la aplicación actual)
  empleados: "disponible",           // catálogo de 41 empleados que se pueden contratar y configurar
  fichaNegocio: "disponible",        // la ficha del negocio y los documentos autorizados existen
  cerebro: "en_revision",            // el contexto del negocio llega a la IA en cada tarea (PR #3)
  tareasGuiadas: "en_revision",      // 8 tareas con formulario (PR #3)
  resultados: "en_revision",         // resultados guardados, editables y descargables (PR #3)
  consumo: "en_revision",            // consumo con límites visibles (PR #3)
  workflows: "proximamente",         // recetas multi-empleado predefinidas
  integraciones: "proximamente",     // publicar/enviar en plataformas externas
};
export const estadoDe = (k: keyof typeof FEATURES | string): Estado => FEATURES[k] ?? "proximamente";
/** ¿Se puede decir que ya funciona? Solo si está «disponible». */
export const esDisponible = (k: string) => estadoDe(k) === "disponible";
