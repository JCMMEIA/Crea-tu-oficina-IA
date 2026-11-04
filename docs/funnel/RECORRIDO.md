# Recorrido del cliente

1. **Anuncio** (Meta) con `utm_*`/`fbclid` → `/`.
2. **Landing**: se registra `visita` (anónimo, sin cookies; la fuente se guarda en `sessionStorage`).
3. **Clic en comprar** (`comprar-hero`, `comprar-oferta`…): evento `cta_click`; el enlace `/comprar?fuente=…&utm_*` conserva la atribución.
4. **Oferta/Checkout**: `/comprar` crea un `checkout_intent` y una sesión de Stripe Checkout.
5. **Pago confirmado**: webhook firmado → `orders` (idempotente por `checkout_session_id`) → `office_rights`.
6. **Oficina creada** automáticamente (`createOfficeFromRight`).
7. **Correos**: confirmación de compra + bienvenida u oficina entregada; el acceso llega por enlace temporal de un solo uso.
8. **Panel** (`/mis-oficinas`, panel de la oficina). Si falla algo, el pedido queda en `error` y se ve en `/admin/conversion` (pedidos recientes).

Cada etapa se mide en `/admin/conversion`: visitas, clics, checkouts iniciados, pagos, oficinas entregadas, oficinas activadas (con empleado y tarea completada), ingresos, gasto y CAC.
