/** Demostración CONCEPTUAL de colaboración entre empleados. Hoy no existen recetas de workflow predefinidas (estado «Próximamente» en disponibilidad.ts); lo que sí existe es que un empleado pueda delegar trabajo a otro con tu aprobación. */
export interface Paso { id: string; etapa: string; empleado: string; entrada: string; salida: string; humano?: boolean }
export interface Flujo { id: string; nombre: string; area: string; pasos: Paso[] }
export const FLUJOS: Flujo[] = [
  { id: "campana", nombre: "De la idea a la propuesta", area: "Marketing y ventas", pasos: [
    { id: "inv", etapa: "Investigación", empleado: "Investigador de mercado", entrada: "Tu negocio y tu cliente ideal", salida: "Resumen de qué busca tu cliente y qué hace la competencia" },
    { id: "est", etapa: "Estrategia", empleado: "Analista estratégico", entrada: "El resumen de la investigación", salida: "Enfoque y mensajes principales" },
    { id: "gui", etapa: "Guion", empleado: "Guionista de storytelling", entrada: "El enfoque elegido", salida: "Guion o textos listos para revisar" },
    { id: "pro", etapa: "Propuesta", empleado: "Creador de presupuestos", entrada: "Guion y alcance", salida: "Propuesta con alcance y condiciones" },
    { id: "rev", etapa: "Revisión humana", empleado: "Tú", entrada: "La propuesta completa", salida: "Apruebas, corriges o rechazas. Nada sale sin tu decisión.", humano: true }] },
  { id: "atencion", nombre: "De la duda al seguimiento", area: "Atención al cliente", pasos: [
    { id: "rec", etapa: "Recepción", empleado: "Asistente de soporte", entrada: "El mensaje del cliente", salida: "Qué pregunta y con qué datos puede responderse" },
    { id: "res", etapa: "Respuesta", empleado: "Asistente de soporte", entrada: "Tus políticas y horarios", salida: "Respuesta lista para copiar" },
    { id: "rev", etapa: "Revisión humana", empleado: "Tú", entrada: "La respuesta sugerida", salida: "Apruebas o ajustas antes de enviarla", humano: true },
    { id: "seg", etapa: "Seguimiento", empleado: "Asistente de seguimiento posventa", entrada: "La compra y la fecha", salida: "Mensaje para volver a contactar al cliente" }] },
];
