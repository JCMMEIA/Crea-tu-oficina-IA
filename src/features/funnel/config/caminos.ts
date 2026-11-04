/**
 * LOS DOS CAMINOS COMERCIALES + el servicio secundario. Texto editable en un solo lugar.
 * A) Oficina IA = el producto (software que se compra y se usa).  B) Afiliado = recomendar; HOY solo existe como lista de interés (no hay enlaces, atribución ni comisiones).
 * Servicio gestionado = solicitud de diagnóstico por contacto; NO es una tercera plataforma.
 */
export const CAMINOS = {
  titulo: "¿Qué quieres hacer con la IA?",
  lead: "Dos caminos: usar una oficina de IA en tu negocio, o recomendarla a otros.",
  oficina: {
    nombre: "Quiero mi Oficina IA", para: "Para empresarios y negocios que quieren usar el software.",
    texto: "Una oficina con empleados IA especializados para marketing, ventas, atención al cliente, operaciones y más. Configuras tu negocio una vez, eliges tareas guiadas y recibes resultados que puedes editar y descargar.",
    puntos: ["41 puestos para distintas áreas, con nombre y especialidad", "Cerebro Empresarial y tareas guiadas, con su estado real", "Tú apruebas antes de publicar o enviar"],
  },
  afiliado: {
    nombre: "Quiero ser afiliado", para: "Para personas que recomendarán nuestras oficinas y recibirán comisiones.",
    texto: "Estamos preparando un programa de recomendación con comisiones. Todavía no hay inscripción, enlaces ni condiciones publicadas: déjanos tu interés y te avisamos cuando esté listo.",
    puntos: ["Programa en preparación: condiciones por definir", "Los clientes siempre son de la plataforma", "Sin acceso a datos de clientes"],
  },
  gestionado: {
    nombre: "Nosotros administramos tu oficina", texto: "¿Prefieres no configurarla tú? Solicita un diagnóstico y conversamos qué podemos hacer por tu negocio. Es un servicio secundario por contacto: usa la misma plataforma, no una aparte.",
  },
};
export const AFILIADOS_PAGE = {
  titulo: ["Recomienda una oficina IA", "y recibe comisión por tus recomendaciones."], estado: "Programa en preparación",
  lead: "Estamos diseñando el programa de afiliados de Crea tu Oficina IA. Todavía no hay inscripción abierta ni condiciones publicadas; la comisión, los plazos y las reglas se anunciarán cuando estén aprobadas.",
  principios: [["Recomiendas, no revendes", "El cliente, el cobro, el soporte y sus datos son de Crea tu Oficina IA. No es una licencia para crear plataformas propias."], ["Reglas claras antes de empezar", "Publicaremos las condiciones (comisión, plazos, reembolsos y prácticas no permitidas) antes de aceptar a nadie."], ["Privacidad de los clientes", "Un afiliado nunca verá datos, documentos ni conversaciones de los clientes que recomiende."], ["Sin promesas de ingresos", "No mostramos ejemplos de ganancias: dependen de planes y precios que todavía no están aprobados."]] as [string, string][],
};
export const COMISIONES = {
  titulo: "Cómo funcionarían las comisiones", aviso: "Propuesta inicial, sin aprobar: puede cambiar antes de publicarse. No es una oferta ni una promesa de ingresos.",
  items: [["Qué se comisiona", "Un porcentaje del cobro neto elegible de cada mensualidad que pague un cliente que tú recomendaste (después de impuestos y reembolsos)."], ["Propuesta inicial", "20 % del cobro neto elegible, durante hasta 12 meses por cada cliente recomendado.", "prop"], ["Qué no cuenta", "Compras con tu propio correo, clientes que ya lo eran, y cobros reembolsados o disputados."], ["Cuándo se paga", "En una liquidación mensual, después de un periodo de espera para cubrir reembolsos, con un pago mínimo."], ["Quién es el cliente", "Crea tu Oficina IA: tú recomiendas; nosotros cobramos, atendemos y cuidamos sus datos."], ["Sin ejemplos de ganancias", "Dependen de cuántos clientes contraten, de su plan y de reglas que todavía no están aprobadas."]] as [string, string, string?][],
};
export const GESTIONADO_PAGE = { titulo: "Nosotros administramos tu oficina", lead: "Cuéntanos de tu negocio y solicita un diagnóstico. Revisamos tu caso y te decimos, sin compromiso, qué podemos hacer por ti. Servicio secundario: usa la misma plataforma de oficinas IA.", nota: "Todavía no hay un paquete ni un precio definidos: el diagnóstico sirve para ver si tiene sentido y cómo." };
