/** Testimonios REALES. Mientras esta lista esté vacía, la sección NO se muestra en la landing (no se inventan clientes, fotos, calificaciones ni cifras).
 *  Para publicar uno: agrega { name, role, quote } con el permiso escrito de la persona. */
export interface Testimonial { name: string; role: string; quote: string }
export const TESTIMONIALS: Testimonial[] = [];
